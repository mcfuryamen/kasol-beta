/**
 * Akun Kasol — adapter akun universal (WA + PIN) untuk aplikasi mitra.
 * =============================================================================
 * Konsep: satu akun (`global_identities`, kunci nomor WhatsApp) dipakai untuk
 * SELURUH ekosistem — jadi mitra, dan beli/aktivasi lisensi app apa pun.
 *
 * Kontrak lengkap: docs/ACCOUNT-KASOL.md
 *
 * Kredensial:
 *   · Browser hanya memakai ANON key (`__MKS_SUPABASE_*`, sama dengan api.ts).
 *   · Pembuatan akun dilakukan Edge Function `account-register` (service_role
 *     di server). Service key TIDAK PERNAH ada di file ini / bundle.
 *
 * Sesi:
 *   · Supabase Auth menyimpan sesi di localStorage + auto-refresh.
 *   · `account_my_profile`, `hub_my_licenses`, `account_become_partner` hanya
 *     bisa dipanggil dengan sesi login (grant `authenticated`).
 *
 * Kalau kredensial kosong / RPC belum ada → fungsi mengembalikan null dan UI
 * tetap jalan (pola yang sama dengan `api.ts`, tanpa banner merah).
 */
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

declare const __MKS_SUPABASE_URL__: string;
declare const __MKS_SUPABASE_ANON_KEY__: string;

const buildUrl = typeof __MKS_SUPABASE_URL__ === 'undefined' ? '' : __MKS_SUPABASE_URL__;
const buildAnon = typeof __MKS_SUPABASE_ANON_KEY__ === 'undefined' ? '' : __MKS_SUPABASE_ANON_KEY__;

export const accountUrl = (
  buildUrl || (import.meta.env.PUBLIC_SUPABASE_URL as string | undefined) || ''
).replace(/\/$/, '');
const anonKey =
  buildAnon || (import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined) || '';

/** False = akun belum bisa dipakai (env belum diset) — UI harus menampilkan
 *  keadaan "belum siap", bukan error. */
export const accountReady = Boolean(accountUrl && anonKey);

let _sb: SupabaseClient | null = null;

export function accountClient(): SupabaseClient | null {
  if (!accountReady) return null;
  if (!_sb) {
    _sb = createClient(accountUrl, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'ksr_account_session',
      },
    });
  }
  return _sb;
}

/**
 * Email sintetis untuk Supabase Auth — pola yang sama dengan TPA
 * (`tpa/services/auth.js:122-123`): 08xx / +62xx / 8xx → 62xx.
 * Return null bila nomor tidak valid.
 */
export function normWa(input: string): string | null {
  let v = String(input || '').replace(/[^0-9]/g, '');
  if (!v) return null;
  if (v.startsWith('0')) v = '62' + v.slice(1);
  else if (v.startsWith('8')) v = '62' + v;
  if (v.length < 9 || v.length > 15) return null;
  return v;
}

export function emailForWa(wa: string): string | null {
  const n = normWa(wa);
  return n ? `${n}@accounts.kasirsolo.local` : null;
}

/** Pesan login SELALU generik — jangan bocorkan nomor terdaftar/tidak. */
export const LOGIN_ERROR = 'Nomor WhatsApp atau PIN tidak valid.';

export interface HasilDaftar {
  ok: boolean;
  code?: string;
  reason?: string;
  licensesAttached?: number;
  referralCode?: string | null;
}

/**
 * Daftar akun baru → lalu langsung login.
 * 1) POST Edge Function (membuat auth user + global_identities + menautkan
 *    lisensi perangkat lama yang nomornya sama)
 * 2) signInWithPassword dengan PIN yang sama.
 */
export async function daftar(input: { wa: string; pin: string; nama: string }): Promise<HasilDaftar> {
  const sb = accountClient();
  if (!sb || !accountReady) return { ok: false, code: 'not_ready', reason: 'Akun belum tersedia di server ini.' };

  const email = emailForWa(input.wa);
  if (!email) return { ok: false, code: 'invalid_wa', reason: 'Nomor WhatsApp nggak valid.' };
  if (!/^[0-9]{6,}$/.test(input.pin)) return { ok: false, code: 'invalid_pin', reason: 'PIN minimal 6 digit angka.' };
  if (String(input.nama || '').trim().length < 2) return { ok: false, code: 'invalid_nama', reason: 'Nama minimal 2 huruf.' };

  try {
    const res = await fetch(`${accountUrl}/functions/v1/account-register`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ wa: input.wa, pin: input.pin, nama: input.nama }),
    });

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (!res.ok || !data.ok) {
      return {
        ok: false,
        code: String(data.code || (res.status === 409 ? 'already_registered' : 'failed')),
        reason: String(data.reason || (res.status === 409
          ? 'Nomor ini sudah punya akun. Coba masuk ya.'
          : 'Pendaftaran gagal. Coba lagi sebentar.')),
      };
    }

    const login = await sb.auth.signInWithPassword({ email, password: input.pin });
    if (login.error) {
      // Akun sudah terbuat; user tinggal masuk manual.
      return { ok: false, code: 'created_login_failed', reason: 'Akun dibuat, tapi login otomatis gagal. Coba masuk manual.' };
    }

    return { ok: true, licensesAttached: Number(data.licenses_attached || 0), referralCode: (data.referral_code as string) ?? null };
  } catch {
    return { ok: false, code: 'network', reason: 'Gagal menghubungi server. Periksa koneksi.' };
  }
}

export async function masuk(wa: string, pin: string): Promise<{ ok: boolean; reason?: string }> {
  const sb = accountClient();
  if (!sb) return { ok: false, reason: 'Akun belum tersedia di server ini.' };
  const email = emailForWa(wa);
  if (!email) return { ok: false, reason: LOGIN_ERROR };
  const { error } = await sb.auth.signInWithPassword({ email, password: pin });
  if (error) return { ok: false, reason: LOGIN_ERROR };
  return { ok: true };
}

export async function keluar(): Promise<void> {
  await accountClient()?.auth.signOut().catch(() => {});
}

export async function sesiSekarang(): Promise<Session | null> {
  const sb = accountClient();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session ?? null;
}

export interface ProfilAkun {
  gid: string;
  nama: string | null;
  wa: string | null;
  status: string;
  phoneVerified: boolean;
  licenseCount: number;
  mitra: null | {
    partnerId: string;
    status: string;
    code: string;
    kota: string | null;
    provinsi: string | null;
    tier: string | null;
    registeredVia: string | null;
  };
  /** Registri app klien terhubung (repo control) — untuk prefill Data Diri. */
  client: null | {
    unitId: string;
    appType: string;
    namaUsaha: string | null;
    namaPemilik: string | null;
    kabkota: string | null;
    provinsi: string | null;
    kecamatan: string | null;
    desa: string | null;
    alamatDetail: string | null;
  };
}

export async function profil(): Promise<ProfilAkun | null> {
  const sb = accountClient();
  if (!sb) return null;
  const { data, error } = await sb.rpc('account_my_profile');
  if (error || !data || (data as { ok?: boolean }).ok === false) return null;
  const d = data as Record<string, unknown>;
  const m = d.mitra as Record<string, unknown> | null | undefined;
  const c = d.client as Record<string, unknown> | null | undefined;
  return {
    gid: String(d.gid || ''),
    nama: (d.nama as string) ?? null,
    wa: (d.wa as string) ?? null,
    status: String(d.status || 'pending'),
    phoneVerified: Boolean(d.phone_verified),
    licenseCount: Number(d.license_count || 0),
    mitra: m && m.partner_id ? {
      partnerId: String(m.partner_id),
      status: String(m.status || ''),
      code: String(m.code || ''),
      kota: (m.kota as string) ?? null,
      provinsi: (m.provinsi as string) ?? null,
      tier: (m.tier as string) ?? null,
      registeredVia: (m.registered_via as string) ?? null,
    } : null,
    client: c && c.unit_id ? {
      unitId: String(c.unit_id),
      appType: String(c.app_type || ''),
      namaUsaha: (c.nama_usaha as string) ?? null,
      namaPemilik: (c.nama_pemilik as string) ?? null,
      kabkota: (c.kabkota as string) ?? null,
      provinsi: (c.provinsi as string) ?? null,
      kecamatan: (c.kecamatan as string) ?? null,
      desa: (c.desa as string) ?? null,
      alamatDetail: (c.alamat_detail as string) ?? null,
    } : null,
  };
}

export interface LisensiAkun {
  licenseId: string;
  appType: string;
  kodeProduk: string | null;
  // `plan` dihapus (2026-11-05): kuota perangkat = SATU angka global
  // `products.max_devices` di Katalog. Pakai `maxDevices` untuk tampilan.
  maxDevices: number;
  status: string;
  expired: boolean;
  txUsed: number;
  txQuota: number | null;
  devices: Array<{ deviceCode: string; label: string | null; status: string; lastSeen: string | null }>;
}

/** RPC `hub_my_licenses` — butuh sesi login (grant authenticated). */
export async function lisensiSaya(): Promise<LisensiAkun[]> {
  const sb = accountClient();
  if (!sb) return [];
  const { data, error } = await sb.rpc('hub_my_licenses');
  if (error || !Array.isArray(data)) return [];
  return (data as Array<Record<string, unknown>>).map((r) => ({
    licenseId: String(r.license_id || ''),
    appType: String(r.app_type || ''),
    kodeProduk: (r.kode_produk as string) ?? null,
    maxDevices: Number(r.max_devices || 2),
    status: String(r.status || ''),
    expired: Boolean(r.expired),
    txUsed: Number(r.tx_used || 0),
    txQuota: r.tx_quota == null ? null : Number(r.tx_quota),
    devices: Array.isArray(r.devices)
      ? (r.devices as Array<Record<string, unknown>>).map((d) => ({
          deviceCode: String(d.device_code || ''),
          label: (d.label as string) ?? null,
          status: String(d.status || ''),
          lastSeen: (d.last_seen as string) ?? null,
        }))
      : [],
  }));
}

export interface HasilJadiMitra {
  ok: boolean;
  code?: string;
  reason?: string;
  already?: boolean;
}

/** RPC `account_become_partner` — opt-in kemitraan dari sesi login. */
export async function jadiMitra(input: { kota?: string; provinsi?: string; catatan?: string }): Promise<HasilJadiMitra> {
  const sb = accountClient();
  if (!sb) return { ok: false, code: 'not_ready' };
  const { data, error } = await sb.rpc('account_become_partner', {
    p_kota: input.kota || null,
    p_provinsi: input.provinsi || null,
    p_catatan: input.catatan || null,
  });
  if (error) return { ok: false, code: 'rpc_failed', reason: 'Gagal menghubungi server.' };
  const d = (data || {}) as Record<string, unknown>;
  if (!d.ok) {
    return { ok: false, code: String(d.code || 'failed'), reason: String(d.reason || '') };
  }
  return { ok: true, code: String(d.code || ''), already: Boolean(d.already) };
}

export interface HasilGantiProfil {
  ok: boolean;
  code?: string;
  reason?: string;
  nama?: string | null;
  kota?: string | null;
  provinsi?: string | null;
  clientsUpdated?: number;
}

/** RPC `account_update_profile` — edit identitas akun (nama + wilayah + alamat). */
export async function gantiProfil(input: {
  nama?: string; kota?: string; provinsi?: string;
  kecamatan?: string; desa?: string; alamat_detail?: string;
}): Promise<HasilGantiProfil> {
  const sb = accountClient();
  if (!sb) return { ok: false, code: 'not_ready' };
  const { data, error } = await sb.rpc('account_update_profile', {
    p_nama: input.nama || null,
    p_kota: input.kota || null,
    p_provinsi: input.provinsi || null,
    p_alamat_detail: input.alamat_detail || null,
    p_kecamatan: input.kecamatan || null,
    p_desa: input.desa || null,
  });
  if (error) return { ok: false, code: 'rpc_failed', reason: 'Gagal menghubungi server.' };
  const d = (data || {}) as Record<string, unknown>;
  if (!d.ok) {
    return { ok: false, code: String(d.code || 'failed'), reason: String(d.reason || '') };
  }
  return {
    ok: true,
    nama: (d.nama as string) ?? null,
    kota: (d.kota as string) ?? null,
    provinsi: (d.provinsi as string) ?? null,
    clientsUpdated: Number(d.clients_updated || 0),
  };
}

export async function gantiPin(pinBaru: string): Promise<{ ok: boolean; reason?: string }> {
  const sb = accountClient();
  if (!sb) return { ok: false, reason: 'Akun belum tersedia.' };
  if (!/^[0-9]{6,}$/.test(pinBaru)) return { ok: false, reason: 'PIN minimal 6 digit angka.' };
  const { error } = await sb.auth.updateUser({ password: pinBaru });
  if (error) return { ok: false, reason: 'Gagal mengganti PIN. Coba lagi.' };
  return { ok: true };
}

/** Keluar dari SEMUA perangkat/sesi akun ini (Supabase Auth global sign-out). */
export async function keluarSemuaPerangkat(): Promise<{ ok: boolean; reason?: string }> {
  const sb = accountClient();
  if (!sb) return { ok: false, reason: 'Akun belum tersedia.' };
  const { error } = await sb.auth.signOut({ scope: 'global' });
  if (error) return { ok: false, reason: 'Gagal keluar dari semua perangkat.' };
  return { ok: true };
}

// ── Ringkasan dashboard (Fase A2) ────────────────────────────────────────────

export interface RingkasanAkun {
  licenses: number;
  devices: number;
  referrals: number;
  pointsReady: number;
  pointsPending: number;
  rupiahBalance: number;
}

/** RPC `account_ensure_referral` — pastikan akun punya kode referal (idempoten).
 *  Dipanggil setiap dashboard dibuka: menambal akun lama yang belum punya kode. */
export async function pastikanReferral(): Promise<{ ok: boolean; code?: string; reason?: string }> {
  const sb = accountClient();
  if (!sb) return { ok: false, reason: 'Akun belum tersedia.' };
  const { data, error } = await sb.rpc('account_ensure_referral');
  if (error) return { ok: false, reason: 'Gagal menyiapkan kode referal.' };
  const d = (data || {}) as Record<string, unknown>;
  if (!d.ok) return { ok: false, code: String(d.code || ''), reason: String(d.reason || '') };
  return { ok: true, code: String(d.code || '') };
}

/** RPC `account_my_summary` — angka kartu ringkasan dashboard. */
export async function ringkasan(): Promise<RingkasanAkun | null> {
  const sb = accountClient();
  if (!sb) return null;
  const { data, error } = await sb.rpc('account_my_summary');
  if (error || !data || (data as { ok?: boolean }).ok === false) return null;
  const d = data as Record<string, unknown>;
  const s = (d.saldo || {}) as Record<string, unknown>;
  return {
    licenses: Number(d.licenses || 0),
    devices: Number(d.devices || 0),
    referrals: Number(d.referrals || 0),
    pointsReady: Number(s.points_ready || 0),
    pointsPending: Number(s.points_pending || 0),
    rupiahBalance: Number(s.rupiah_balance || 0),
  };
}

export interface RiwayatReferral {
  name: string;
  city: string;
  product: string;
  status: string;
  points: number;
  date: string;
}

/** RPC `account_my_referrals` — riwayat referral mitra. */
export async function riwayatReferral(limit = 5): Promise<RiwayatReferral[]> {
  const sb = accountClient();
  if (!sb) return [];
  const { data, error } = await sb.rpc('account_my_referrals', { p_limit: limit });
  if (error || !Array.isArray(data)) return [];
  return (data as Array<Record<string, unknown>>).map((r) => ({
    name: String(r.name || ''),
    city: String(r.city || ''),
    product: String(r.product || ''),
    status: String(r.status || ''),
    points: Number(r.points || 0),
    date: String(r.date || ''),
  }));
}

export interface RiwayatPencairan {
  id: string;
  date: string;
  points: number;
  amount: number;
  status: string;
  note: string;
}

/** RPC `account_my_payouts` — riwayat pencairan. */
export async function riwayatPencairan(): Promise<RiwayatPencairan[]> {
  const sb = accountClient();
  if (!sb) return [];
  const { data, error } = await sb.rpc('account_my_payouts');
  if (error || !Array.isArray(data)) return [];
  return (data as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id || ''),
    date: String(r.date || ''),
    points: Number(r.points || 0),
    amount: Number(r.amount || 0),
    status: String(r.status || ''),
    note: String(r.note || ''),
  }));
}

/** RPC `account_request_payout` — ajukan pencairan dari akun. */
export async function ajukanPencairan(input: {
  points: number; amount: number; bankInfo: string;
}): Promise<{ ok: boolean; code?: string; reason?: string }> {
  const sb = accountClient();
  if (!sb) return { ok: false, reason: 'Akun belum tersedia.' };
  if (!Number.isFinite(input.points) || input.points <= 0) return { ok: false, reason: 'Jumlah poin tidak valid.' };
  if (!input.bankInfo || input.bankInfo.trim().length < 4) return { ok: false, reason: 'Isi rekening tujuan dulu.' };
  const { data, error } = await sb.rpc('account_request_payout', {
    p_points: Math.round(input.points),
    p_amount: Math.round(input.amount),
    p_bank_info: input.bankInfo.trim(),
  });
  if (error) return { ok: false, code: 'rpc_failed', reason: 'Gagal menghubungi server.' };
  const d = (data || {}) as Record<string, unknown>;
  if (!d.ok) return { ok: false, code: String(d.code || 'failed'), reason: String(d.reason || '') };
  return { ok: true };
}

/** RPC `account_create_activation_code` — kode aktivasi perangkat (10 menit). */
export async function buatKodeAktivasi(licenseId: string): Promise<{ ok: boolean; code?: string; expiresAt?: string; reason?: string }> {
  const sb = accountClient();
  if (!sb) return { ok: false, reason: 'Akun belum tersedia.' };
  const { data, error } = await sb.rpc('account_create_activation_code', { p_license_id: licenseId });
  if (error) return { ok: false, reason: 'Gagal membuat kode aktivasi.' };
  const d = (data || {}) as Record<string, unknown>;
  if (!d.ok) return { ok: false, reason: String(d.reason || 'Kode aktivasi gagal dibuat.') };
  return { ok: true, code: String(d.code || ''), expiresAt: String(d.expires_at || '') };
}

/** `settings.app_links` — peta app_type → URL (dipakai launcher "buka app"). */
export async function appLinks(): Promise<Record<string, string>> {
  const sb = accountClient();
  if (!sb) return {};
  try {
    const { data, error } = await sb
      .from('settings')
      .select('value')
      .eq('key', 'app_links')
      .maybeSingle();
    if (error || !data?.value) return {};
    const v = data.value as unknown;
    if (!v || typeof v !== 'object') return {};
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === 'string' && /^https?:\/\//.test(val)) out[k] = val;
    }
    return out;
  } catch {
    return {};
  }
}