import { signal } from "@preact/signals";
import { supabase, isDemoMode } from "@/data/supabase";
import { currentUser, activeOutletId, businessId } from "@/logic/state/app-state";
import { generateId } from "@/logic/utils/format";
import { normalizeWhatsApp } from "@/logic/utils/phone";
import { localDb, kvGet, kvSet } from "@/data/db/local-db";

export type UserRole = "owner" | "manager" | "cashier" | "stock";

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Owner",
  manager: "Manager",
  cashier: "Kasir",
  stock: "Gudang",
};

export const ROLE_ORDER: UserRole[] = ["owner", "manager", "cashier", "stock"];

export interface User {
  id: string;
  name: string;
  /** Legacy email, retained for existing accounts. */
  email: string;
  /** Canonical WhatsApp identifier for new accounts. */
  phone?: string;
  role: UserRole;
  avatar?: string;
  active: boolean;
  /** "cloud" = baris berasal dari tabel profiles (bisa login); "local" = hanya perangkat ini. */
  source?: "cloud" | "local";
}

export const demoUsers: User[] = [
  { id: "demo-owner",  name: "Budi Santoso",  email: "owner@demo.com",   phone: "+628111111111", role: "owner",   active: true },
  { id: "demo-manager", name: "Sari Dewi",     email: "manager@demo.com", phone: "+628122222222", role: "manager", active: true },
  { id: "demo-kasir",  name: "Andi Prasetyo",  email: "kasir@demo.com",   phone: "+628133333333", role: "cashier", active: true },
  { id: "demo-stock",  name: "Rini Wulandari", email: "gudang@demo.com",  phone: "+628144444444", role: "stock",   active: true },
];

const STAFF_STORE = "staff";

/**
 * Akun hasil registrasi di MODE DEMO — disimpan di perangkat supaya alur
 * daftar→login bisa dicoba tanpa server. Tidak dipakai saat mode online
 * (di sana akun dibuat sungguhan lewat Supabase Auth).
 */
const DEMO_ACCOUNTS_KEY = "demo_registered_accounts";
interface DemoAccount { id: string; name: string; phone: string; password: string; }

function normalizeProfile(row: any): User {
  return {
    id: row.id,
    name: row.name || row.email || "",
    email: row.email || "",
    phone: row.phone_e164 || row.phone || undefined,
    role: (["owner", "manager", "cashier", "stock"] as UserRole[]).includes(row.role)
      ? (row.role as UserRole)
      : "cashier",
    avatar: row.avatar_url || undefined,
    active: row.is_active !== false,
    source: "cloud",
  };
}

class AuthService {
  /** Pulihkan sesi Supabase yang masih hidup setelah refresh halaman (mode online). */
  async restoreSession(): Promise<User | null> {
    if (isDemoMode) return null;
    const { data } = await supabase.auth.getSession();
    const sessionUser = data.session?.user;
    if (!sessionUser) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, name, email, phone_e164, role, avatar_url, is_active")
      .eq("id", sessionUser.id)
      .maybeSingle();
    if (!profile || profile.is_active === false) {
      await supabase.auth.signOut();
      return null;
    }
    const user = normalizeProfile(profile);
    currentUser.value = user;
    await this.loadStaff();
    return user;
  }

  async login(identifier: string, password: string): Promise<{ user: User | null; error: string | null }> {
    const phone = normalizeWhatsApp(identifier);
    if (isDemoMode) {
      const demo = phone ? demoUsers.find(u => u.phone === phone) : demoUsers.find(u => u.email === identifier.trim().toLowerCase());
      if (demo && password === "demo123") {
        currentUser.value = demo;
        await this.loadStaff();
        return { user: demo, error: null };
      }
      const accounts = (await kvGet<DemoAccount[]>(DEMO_ACCOUNTS_KEY)) ?? [];
      const acc = phone
        ? accounts.find(a => a.phone === phone && a.password === password)
        : undefined;
      if (acc) {
        const user: User = { id: acc.id, name: acc.name, email: "", phone: acc.phone, role: "owner", active: true, source: "local" };
        currentUser.value = user;
        await this.loadStaff();
        return { user, error: null };
      }
      return { user: null, error: "Nomor WhatsApp atau kata sandi salah" };
    }

    const email = phone ? `owner.${phone.slice(1)}@accounts.kasirsolo.local` : identifier.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return { user: null, error: error?.message || "Login gagal" };

    // Role & nama WAJIB dibaca dari tabel profiles (server-side),
    // bukan dari user_metadata yang bisa dimanipulasi klien.
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, name, email, phone_e164, role, avatar_url, is_active")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!profile) {
      await supabase.auth.signOut();
      return { user: null, error: "Profil pengguna tidak ditemukan. Hubungi owner." };
    }
    if (profile.is_active === false) {
      await supabase.auth.signOut();
      return { user: null, error: "Akun dinonaktifkan." };
    }

    const user = normalizeProfile(profile);
    currentUser.value = user;
    await this.loadStaff();
    // Boot berjalan SEBELUM login: initLocalData/pull di-skip tanpa sesi.
    // Tarik data cloud sekarang agar aplikasi tidak kosong sampai reload (F13).
    // Dynamic import menghindari siklus modul auth ↔ hydrate.
    const { loadDataAfterLogin } = await import("@/data/db/hydrate");
    await loadDataAfterLogin();
    return { user, error: null };
  }

  /**
   * Registrasi akun baru.
   * - MODE DEMO: akun disimpan di perangkat ini (email+password) supaya alur
   *   daftar → login bisa dicoba tanpa server. Sesi TIDAK langsung dibuat —
   *   pemilik diminta login manual agar alurnya terasa nyata.
   * - MODE ONLINE: buat akun Supabase Auth, tulis baris `profiles` (role owner,
   *   karena yang mendaftar adalah pemilik baru), lalu pulihkan sesi admin lama
   *   bila registrasi dilakukan dari dalam aplikasi (menu Staf).
   */
  async register(data: { name: string; phone: string; password: string }): Promise<{ ok: boolean; error: string | null }> {
    const name = data.name.trim();
    const phone = normalizeWhatsApp(data.phone);
    if (!name) return { ok: false, error: "Nama wajib diisi" };
    if (!phone) return { ok: false, error: "Nomor WhatsApp tidak valid (contoh: 081234567890)" };
    if (data.password.length < 6) return { ok: false, error: "Kata sandi minimal 6 karakter" };

    if (isDemoMode) {
      const accounts = (await kvGet<DemoAccount[]>(DEMO_ACCOUNTS_KEY)) ?? [];
      if (demoUsers.some(u => u.phone === phone) || accounts.some(a => a.phone === phone)) {
        return { ok: false, error: "Nomor WhatsApp sudah terdaftar" };
      }
      const acc: DemoAccount = { id: generateId(), name, phone, password: data.password };
      await kvSet(DEMO_ACCOUNTS_KEY, [...accounts, acc]);
      const user: User = { id: acc.id, name, email: "", phone, role: "owner", active: true, source: "local" };
      staffList.value = [...staffList.value, user];
      await localDb.put(STAFF_STORE, user);
      return { ok: true, error: null };
    }

    try {
      const { data: sessData } = await supabase.auth.getSession();
      const adminSession = sessData?.session ?? null;

      // Phone auth/OTP is intentionally disabled for now. Use a synthetic internal
      // email so registration works immediately without an SMS provider.
      const signupEmail = `owner.${phone.slice(1)}@accounts.kasirsolo.local`;
      const { data: signUp, error } = await supabase.auth.signUp({
        email: signupEmail,
        password: data.password,
        options: { data: { name, phone_e164: phone } },
      });
      if (error) return { ok: false, error: error.message };
      if (!signUp.user) return { ok: false, error: "Registrasi gagal — coba lagi" };
      if (!signUp.session && !adminSession) {
        return { ok: false, error: "Akun dibuat, tetapi email belum dikonfirmasi oleh Supabase. Nonaktifkan email confirmation atau gunakan email yang bisa menerima konfirmasi." };
      }

      // Profile dibuat oleh trigger on_auth_user_created agar tidak terbentur RLS.
      // signUp menimpa sesi aktif (bila ada admin yang mendaftarkan staf) — pulihkan.
      if (adminSession) {
        try { await supabase.auth.setSession(adminSession); } catch { /* sesi admin tetap berlaku sampai expired */ }
      }
      return { ok: true, error: null };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Registrasi gagal" };
    }
  }

  async loginAsDemo(userId: string): Promise<User | null> {
    if (!isDemoMode) return null;
    const demo = demoUsers.find(u => u.id === userId);
    if (demo) {
      currentUser.value = demo;
      await this.loadStaff();
      return demo;
    }
    return null;
  }

  async logout() {
    if (!isDemoMode) await supabase.auth.signOut();
    currentUser.value = null;
  }

  private async loadStaff() {
    const saved = await localDb.getAll<User>(STAFF_STORE);
    if (saved.length > 0) {
      staffList.value = saved;
    } else if (isDemoMode) {
      // Hanya mode demo yang memakai user contoh. Dulunya daftar ini di-seed
      // global, jadi mode online sempat menampilkan "Budi Santoso" dsb.
      staffList.value = [...demoUsers];
    } else {
      const { data } = await supabase.from("profiles").select("id, name, email, phone_e164, role, avatar_url, is_active");
      if (data && data.length > 0) {
        const users = data.map(normalizeProfile);
        staffList.value = users;
        await Promise.all(users.map(u => localDb.put(STAFF_STORE, u)));
      }
    }
  }

  /**
   * Tambah staf. Mode online + password diisi → coba buat akun Supabase Auth
   * (signUp) lalu tulis baris profiles, dan pulihkan sesi admin yang tertimpa
   * proses signUp. Mode demo / tanpa password → tersimpan lokal saja (ditandai
   * "Lokal" — TIDAK bisa dipakai login; dulu UI mengklaim sukses padahal staf
   * tak akan pernah bisa masuk dari perangkat mana pun).
   */
  async addStaff(user: Omit<User, "id"> & { password?: string }): Promise<{ cloudOk: boolean; message?: string }> {
    const phone = normalizeWhatsApp(user.phone || "");
    const newUser: User = { ...user, phone: phone || user.phone, id: generateId(), source: "local" };
    let cloudOk = false;
    let message: string | undefined;

    if (!isDemoMode && user.password) {
      try {
        const { data: sessData } = await supabase.auth.getSession();
        const adminSession = sessData?.session ?? null;

        // Sama dengan register(): akun dibuat via email sintetis berbasis nomor
        // (phone auth/OTP dimatikan) supaya login nomor WhatsApp membaca email
        // yang sama. signUp({ phone }) akan gagal 400 tanpa SMS provider.
        const staffEmail = `owner.${(phone || "").slice(1)}@accounts.kasirsolo.local`;
        const { data, error } = await supabase.auth.signUp({
          email: staffEmail,
          password: user.password,
          options: { data: { name: user.name, role: user.role, phone_e164: phone } },
        });
        if (error) throw error;

        if (data.user) {
          newUser.id = data.user.id;
          newUser.source = "cloud";
          cloudOk = true;
          // Trigger DB biasanya membuat baris profiles; pastikan datanya lengkap.
          const { error: pErr } = await supabase.from("profiles").upsert(
            { id: data.user.id, name: user.name, phone_e164: newUser.phone, role: user.role, is_active: user.active },
            { onConflict: "id" }
          );
          if (pErr) {
            cloudOk = true;
            message = `akun login dibuat, tapi profil gagal ditulis (${pErr.message}) — role/nama mungkin belum sinkron`;
          }
          // Tugaskan staf ke outlet aktif — tanpa membership ia tak bisa baca data outlet.
          if (activeOutletId.value) {
            const { error: mErr } = await supabase.from("outlet_memberships").upsert(
              { business_id: businessId.value, user_id: data.user.id, outlet_id: activeOutletId.value, role: user.role },
              { onConflict: "user_id,outlet_id" }
            );
            if (mErr && !message) {
              message = `akun dibuat, tapi assignment outlet gagal (${mErr.message})`;
            }
          }
        }
        // signUp menimpa sesi aktif dengan sesi user baru — kembalikan sesi admin.
        if (adminSession) {
          try { await supabase.auth.setSession(adminSession); } catch { /* sesi admin tetap berlaku sampai expired */ }
        }
      } catch (e: any) {
        message = e?.message || "gagal membuat akun server";
      }
    }

    staffList.value = [...staffList.value, newUser];
    void localDb.put(STAFF_STORE, newUser);
    return { cloudOk, message };
  }

  /**
   * Ubah data staf. Staf cloud (profiles) ikut ditulis ke server — dulu hanya
   * lokal sehingga role/nama yang diedit tidak pernah terbaca saat login
   * (login membaca role dari profiles, bukan dari perangkat).
   */
  async updateStaff(id: string, updates: Partial<User>): Promise<{ cloudOk: boolean; message?: string }> {
    staffList.value = staffList.value.map(u => (u.id === id ? { ...u, ...updates } : u));
    const updated = staffList.value.find(u => u.id === id);
    if (updated) void localDb.put(STAFF_STORE, updated);

    if (!isDemoMode && updated?.source === "cloud") {
      const payload: Record<string, unknown> = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.role !== undefined) payload.role = updates.role;
      if (updates.active !== undefined) payload.is_active = updates.active;
      if (Object.keys(payload).length > 0) {
        const { error } = await supabase.from("profiles").update(payload).eq("id", id);
        if (error) return { cloudOk: false, message: error.message };
        return { cloudOk: true };
      }
    }
    return { cloudOk: true };
  }

  /**
   * Hapus staf. Akun auth tidak bisa dihapus dari klien — staf cloud cukup
   * DINONAKTIFKAN (is_active=false, ikut ke profiles); staf lokal dihapus biasa.
   */
  async deleteStaff(id: string): Promise<{ deactivated: boolean; message?: string }> {
    const target = staffList.value.find(u => u.id === id);
    if (!isDemoMode && target?.source === "cloud") {
      const { error } = await supabase.from("profiles").update({ is_active: false }).eq("id", id);
      if (error) return { deactivated: false, message: error.message };
      staffList.value = staffList.value.map(u => (u.id === id ? { ...u, active: false } : u));
      const updated = staffList.value.find(u => u.id === id);
      if (updated) void localDb.put(STAFF_STORE, updated);
      return { deactivated: true };
    }
    staffList.value = staffList.value.filter(u => u.id !== id);
    void localDb.remove(STAFF_STORE, id);
    return { deactivated: false };
  }
}

/** Kosong sampai loadStaff() mengisi sesuai mode (demo vs online). */
export const staffList = signal<User[]>([]);
export const authService = new AuthService();
