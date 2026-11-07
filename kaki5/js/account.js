/**
 * Akun Kasol + multi-role untuk kaki5 (tanpa DOM).
 * =============================================================================
 * Login memakai Akun Kasol (WA + PIN) — akun yang SAMA dengan mitra/HUB.
 * Role diambil dari `app_memberships` per-aplikasi (`app_key='kaki5'`) lewat
 * RPC `app_my_access`. Identitas = SESI (Supabase Auth), bukan parameter bebas.
 *
 * Prinsip (docs/HUB-DESIGN-DECISIONS.md §11): app klien tetap offline-first &
 * standalone. Sejak 2026-11-04 modal login = LAYER PERTAMA saat boot (gerbang).
 * Sejak 2026-11-07 jalan keluar "Lanjut tanpa akun" TIDAK lagi berupa tombol di
 * gerbang — pindah ke TAUTAN KHUSUS yang di-generate dashboard Akun Kasol
 * (situs mitra): buka `#akses-perangkat?k=...` → langsung mode Pemilik
 * perangkat. Tanpa login, peran efektif = 'owner' supaya app tetap jalan.
 *
 * Kredensial: HANYA anon key (window.KASIRSOLO_SUPABASE_ANON_KEY). Service key
 * tidak pernah ada di bundle. RPC app_* hanya grant ke `authenticated`.
 */
import { getSetting, setSetting } from './db.js';

const APP_KEY = 'kaki5';
const CACHE_KEY = 'akunKasolV1';

/** Pesan login SELALU generik — jangan bocorkan nomor terdaftar/tidak. */
export const LOGIN_ERROR = 'Nomor WhatsApp atau PIN tidak valid.';

let _client = null;
let _access = null;          // { gid, nama, wa, role, status, member_id, outlet_ref, has_access, apps }
let _cacheLoaded = false;

export const ROLE_RANK = { kasir: 1, manajer: 2, owner: 3 };
export const ROLE_LABEL = { owner: 'Pemilik', manajer: 'Manajer', kasir: 'Kasir' };

function ready() {
  const u = window.KASIRSOLO_SUPABASE_URL;
  const a = window.KASIRSOLO_SUPABASE_ANON_KEY;
  if (!window.supabase || !u || !a) return false;
  const s = String(a);
  return !(s.includes('***') || s.includes('...') || /^PASTE/i.test(s) || !s.includes('.'));
}

function client() {
  if (!ready()) return null;
  if (!_client) {
    _client = window.supabase.createClient(
      window.KASIRSOLO_SUPABASE_URL,
      window.KASIRSOLO_SUPABASE_ANON_KEY,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'ksr_kaki5_session' } }
    );
  }
  return _client;
}

/** Normalisasi WA: 08xx / 8xx / +62xx → 62xx (pola sama dengan mitra & server). */
export function normWa(input) {
  let v = String(input || '').replace(/[^0-9]/g, '');
  if (!v) return null;
  if (v.startsWith('0')) v = '62' + v.slice(1);
  else if (v.startsWith('8')) v = '62' + v;
  if (v.length < 9 || v.length > 15) return null;
  return v;
}

function emailForWa(wa) {
  const n = normWa(wa);
  return n ? `${n}@accounts.kasirsolo.local` : null;
}

export function akunSiap() { return ready(); }
export function aksesMemori() { return _access; }

/**
 * Klien Supabase yang menyimpan SESI AKUN (`storageKey: ksr_kaki5_session`).
 * Dipakai license.sync.js untuk RPC `app_my_license` — klien anon bawaan
 * license.sync.js memakai storageKey berbeda, jadi JWT-nya BUKAN sesi akun.
 * Diekspor read-only (instance yang sama, bukan klien baru).
 */
export function akunKlien() { return client(); }

/** Muat cache lokal (boot, sebelum jaringan). Idempoten per sesi halaman. */
export async function muatCache() {
  if (_cacheLoaded) return _access;
  _cacheLoaded = true;
  try {
    const raw = await getSetting(CACHE_KEY, '');
    if (raw) _access = JSON.parse(raw);
  } catch { /* cache korup → abaikan, mulai dari kosong */ }
  return _access;
}

async function simpanCache(obj) {
  _access = obj || null;
  try { await setSetting(CACHE_KEY, obj ? JSON.stringify(obj) : ''); } catch { /* abaikan */ }
}

export async function sesi() {
  const sb = client(); if (!sb) return null;
  try { const { data } = await sb.auth.getSession(); return data.session || null; }
  catch { return null; }
}

/** Ambil akses dari server (butuh sesi login). Null kalau gagal/anon. */
export async function muatAkses() {
  const sb = client(); if (!sb) return null;
  try {
    const { data, error } = await sb.rpc('app_my_access', { p_app_key: APP_KEY });
    if (error || !data || data.ok === false) return null;
    await simpanCache(data);
    return data;
  } catch { return null; }
}

/** Login WA + PIN → sesi + akses. */
export async function masuk(wa, pin) {
  const sb = client();
  if (!sb) return { ok: false, reason: 'Akun belum tersedia di perangkat ini.' };
  const email = emailForWa(wa);
  if (!email) return { ok: false, reason: LOGIN_ERROR };
  if (!/^[0-9]{6,}$/.test(String(pin || ''))) return { ok: false, reason: 'PIN minimal 6 digit angka.' };
  const { error } = await sb.auth.signInWithPassword({ email, password: pin });
  if (error) return { ok: false, reason: LOGIN_ERROR };
  const access = await muatAkses();
  clearBypass();   // sudah punya akun → gerbang tak perlu dilewati lagi
  return { ok: true, access };
}

/**
 * Daftar akun baru (2026-11-06): POST Edge Function `account-register` —
 * backend SAMA dengan situs mitra (auth user + global_identities + auto-taut
 * lisensi lama + kode referral). Hanya anon key; service role tetap di server.
 * Setelah sukses, pemanggil (account.ui.js) menjalankan masuk() untuk sesi.
 * Kontrak respons: 201 {ok,gid,...} / 400 invalid_* / 409 already_registered /
 * 429 rate_limited / 500 server_error (docs/ACCOUNT-KASOL.md).
 */
export async function daftarAkun({ wa, pin, nama }) {
  const url = window.KASIRSOLO_SUPABASE_URL;
  const key = window.KASIRSOLO_SUPABASE_ANON_KEY;
  if (!ready() || !url || !key) return { ok: false, code: 'not_ready', reason: 'Akun belum tersedia di perangkat ini.' };
  const nw = normWa(wa);
  if (!nw) return { ok: false, code: 'invalid_wa', reason: 'Nomor WhatsApp tidak valid.' };
  const nm = String(nama || '').trim();
  if (nm.length < 2) return { ok: false, code: 'invalid_nama', reason: 'Nama minimal 2 huruf.' };
  const pinv = String(pin || '').trim();
  if (!/^[0-9]{6,}$/.test(pinv)) return { ok: false, code: 'invalid_pin', reason: 'PIN minimal 6 digit angka.' };
  try {
    const res = await fetch(`${String(url).replace(/\/$/, '')}/functions/v1/account-register`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ wa: nw, pin: pinv, nama: nm }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        code: String(data.code || (res.status === 409 ? 'already_registered' : 'failed')),
        reason: String(data.reason || (res.status === 409
          ? 'Nomor ini sudah punya akun. Coba masuk ya.'
          : 'Pendaftaran gagal. Coba lagi sebentar.')),
      };
    }
    return { ok: true, licensesAttached: Number(data.licenses_attached || 0), referralCode: data.referral_code ?? null };
  } catch {
    return { ok: false, code: 'network', reason: 'Gagal menghubungi server. Periksa koneksi.' };
  }
}

export async function keluar() {
  const sb = client();
  try { if (sb) await sb.auth.signOut(); } catch { /* abaikan */ }
  await simpanCache(null);
  clearBypass();   // keluar → gerbang login tampil lagi saat boot berikutnya
}

// ── Gerbang login (layer pertama) ───────────────────────────────────────────
// Gerbang diingat per perangkat (bypass) supaya tidak menagih tiap reload;
// bypass dihapus begitu pemilik login atau keluar. Pintu masuk mode Pemilik
// perangkat = tautan khusus dari dashboard Akun Kasol (lihat fungsi di bawah).
const GATE_KEY = 'akunKasolGateBypassV1';

export function gateBypassed() {
  try { return localStorage.getItem(GATE_KEY) === '1'; } catch { return false; }
}

export async function bypassGate() {
  try { localStorage.setItem(GATE_KEY, '1'); } catch { /* abaikan */ }
}

export function clearBypass() {
  try { localStorage.removeItem(GATE_KEY); } catch { /* abaikan */ }
}

/**
 * Tautan khusus dari dashboard Akun Kasol di situs mitra (konsep 2026-11-07):
 * `…/#akses-perangkat?k=<kunci>` → langsung mode Pemilik perangkat tanpa
 * gerbang. Kunci TIDAK divalidasi server — pintunya memang terbuka, setara
 * tombol "Lanjut tanpa akun" yang dulu ada di gerbang; kuncinya hanya supaya
 * tautan terlihat disengaja saat dibagikan.
 *
 * WAJIB dipanggil SINKRON di level modul app.js SEBELUM initRouter(): router
 * menormalkan hash tak dikenal ke '#beranda' (pushState di navigateTo), jadi
 * cek yang dijalankan di dalam init()/initAkun() selalu telat.
 * Return true kalau tautan valid dikonsumsi (dipakai untuk toast di app.js).
 */
export function applyAksesPerangkatLink() {
  let hash = '';
  try { hash = window.location.hash || ''; } catch { return false; }
  const m = /^#akses-perangkat(?:\?(.*))?$/i.exec(hash.trim());
  if (!m) return false;
  const params = new URLSearchParams(m[1] || '');
  const k = String(params.get('k') || '').trim();
  if (k.length < 8) return false;   // tautan tidak lengkap → gerbang normal
  try { localStorage.setItem(GATE_KEY, '1'); } catch { /* abaikan */ }
  try { history.replaceState(null, '', '#beranda'); }
  catch { try { window.location.hash = '#beranda'; } catch { /* abaikan */ } }
  return true;
}

// ── Kelola pegawai (ops di server dibatasi owner-only) ──────────────────────
export async function daftarPegawai() {
  const sb = client(); if (!sb) return { ok: false, reason: 'offline' };
  try {
    const { data, error } = await sb.rpc('app_list_members', { p_app_key: APP_KEY });
    if (error || !data) return { ok: false, reason: 'rpc' };
    return data; // { ok, role, members: [...] }
  } catch { return { ok: false, reason: 'network' }; }
}

export async function tambahPegawai({ wa, nama, role }) {
  const sb = client(); if (!sb) return { ok: false, code: 'offline', reason: 'Perlu koneksi internet.' };
  const nw = normWa(wa);
  if (!nw) return { ok: false, code: 'invalid_wa', reason: 'Nomor WhatsApp tidak valid.' };
  if (!ROLE_RANK[role]) return { ok: false, code: 'invalid_role', reason: 'Role tidak valid.' };
  try {
    const { data, error } = await sb.rpc('app_add_member', {
      p_app_key: APP_KEY, p_wa: nw, p_role: role, p_nama: nama || null,
    });
    if (error) return { ok: false, code: 'rpc', reason: error.message };
    return data || { ok: false, code: 'empty' };
  } catch { return { ok: false, code: 'network', reason: 'Gagal menghubungi server.' }; }
}

export async function ubahRolePegawai(memberId, role) {
  const sb = client(); if (!sb) return { ok: false, code: 'offline' };
  try {
    const { data, error } = await sb.rpc('app_set_member_role', { p_member_id: memberId, p_role: role });
    if (error) return { ok: false, code: 'rpc' };
    return data || { ok: false, code: 'empty' };
  } catch { return { ok: false, code: 'network' }; }
}

export async function hapusPegawai(memberId) {
  const sb = client(); if (!sb) return { ok: false, code: 'offline' };
  try {
    const { data, error } = await sb.rpc('app_remove_member', { p_member_id: memberId });
    if (error) return { ok: false, code: 'rpc' };
    return data || { ok: false, code: 'empty' };
  } catch { return { ok: false, code: 'network' }; }
}

// ── Peran & izin ────────────────────────────────────────────────────────────
/** Peran efektif: role sesi AKTIF, kalau tidak ada → 'owner' (pemilik perangkat). */
export function peran() {
  if (_access && _access.has_access && ROLE_RANK[_access.role]) return _access.role;
  return 'owner';
}

/** true bila peran sekarang >= tier ('manajer' atau 'owner'). */
export function boleh(tier) {
  const need = ROLE_RANK[tier] || 3;
  return (ROLE_RANK[peran()] || 3) >= need;
}

export function sudahLogin() {
  return !!(_access && _access.gid);
}

export function infoAkun() {
  return _access ? { ..._access } : null;
}