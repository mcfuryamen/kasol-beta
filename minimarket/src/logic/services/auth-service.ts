import { signal } from "@preact/signals";
import { supabase, isDemoMode } from "@/data/supabase";
import { currentUser } from "@/logic/state/app-state";
import { generateId } from "@/logic/utils/format";
import { localDb } from "@/data/db/local-db";

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
  email: string;
  role: UserRole;
  avatar?: string;
  active: boolean;
}

export const demoUsers: User[] = [
  { id: "demo-owner",  name: "Budi Santoso",  email: "owner@demo.com",   role: "owner",   active: true },
  { id: "demo-manager", name: "Sari Dewi",     email: "manager@demo.com", role: "manager", active: true },
  { id: "demo-kasir",  name: "Andi Prasetyo",  email: "kasir@demo.com",   role: "cashier", active: true },
  { id: "demo-stock",  name: "Rini Wulandari", email: "gudang@demo.com",  role: "stock",   active: true },
];

const STAFF_STORE = "staff";

function normalizeProfile(row: any): User {
  return {
    id: row.id,
    name: row.name || row.email || "",
    email: row.email || "",
    role: (["owner", "manager", "cashier", "stock"] as UserRole[]).includes(row.role)
      ? (row.role as UserRole)
      : "cashier",
    avatar: row.avatar_url || undefined,
    active: row.is_active !== false,
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
      .select("id, name, email, role, avatar_url, is_active")
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

  async login(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
    if (isDemoMode) {
      const demo = demoUsers.find(u => u.email === email);
      if (demo && password === "demo123") {
        currentUser.value = demo;
        await this.loadStaff();
        return { user: demo, error: null };
      }
      return { user: null, error: "Email atau password salah" };
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return { user: null, error: error?.message || "Login gagal" };

    // Role & nama WAJIB dibaca dari tabel profiles (server-side),
    // bukan dari user_metadata yang bisa dimanipulasi klien.
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, name, email, role, avatar_url, is_active")
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
    return { user, error: null };
  }

  async loginAsDemo(userId: string): Promise<User | null> {
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
    } else if (!isDemoMode) {
      const { data } = await supabase.from("profiles").select("*");
      if (data && data.length > 0) {
        const users = data.map(normalizeProfile);
        staffList.value = users;
        await Promise.all(users.map(u => localDb.put(STAFF_STORE, u)));
      }
    }
  }

  addStaff(user: Omit<User, "id">): User {
    const newUser: User = { ...user, id: generateId() };
    staffList.value = [...staffList.value, newUser];
    void localDb.put(STAFF_STORE, newUser);
    return newUser;
  }

  updateStaff(id: string, updates: Partial<User>) {
    staffList.value = staffList.value.map(u => (u.id === id ? { ...u, ...updates } : u));
    const updated = staffList.value.find(u => u.id === id);
    if (updated) void localDb.put(STAFF_STORE, updated);
  }

  deleteStaff(id: string) {
    staffList.value = staffList.value.filter(u => u.id !== id);
    void localDb.remove(STAFF_STORE, id);
  }
}

export const staffList = signal<User[]>([...demoUsers]);
export const authService = new AuthService();
