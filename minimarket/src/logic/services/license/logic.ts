/**
 * minimarket/src/logic/services/license/logic.ts
 * Port PERSIS kaki5/js/license.logic.js — pure logic + DB, TANPA DOM.
 *
 * Model: tier gratis = KUOTA TRANSAKSI per bulan kalender (tanpa batas waktu),
 * lisensi berbayar = serial MML HMAC-SHA256. Salt dinamis dari cloud (sync.ts)
 * dengan fallback lokal. Cloud (tabel clients) = sumber kebenaran.
 *
 * Bentuk LicenseStatus = shape kaki5 (status/deviceCode/txRemaining/...) PLUS
 * field kenyamanan konsumen UI minimarket (level/txCount/daysUntilExpiry/unitId)
 * supaya chip & gate lama tetap terbaca jujur.
 */
import { getSetting, setSetting } from './db';
import {
  APP_TYPE, PRODUCT_PREFIX, UNIT_ID_PREFIX,
  simpleHash, b32Encode, deriveDeviceCode, getDeviceFingerprint,
  getLegacyV3DeviceCode, getLegacyV4DeviceCode,
  hmacSignatureWithSalt, isPlaceholderKey,
} from './core';
import {
  quotaEnsure, quotaTickTx, quotaBudgetStatus,
} from './quota';

const LICENSE_BACKUP_KEY = 'kasirsolo:minimarket:license';

// ===== KUOTA TRANSAKSI (pola kaki5 2026-08-29) =====
// Tier gratis = kuota transaksi selesai per bulan kalender, TANPA batas waktu.
// Angka global diatur admin (products.tx_quota utk app ini; di-cache lokal ke
// settings.trialConfig agar tetap jalan offline). Kuota efektif per perangkat =
// kuota global + lic.txAdjust (adjust +/− dari admin; cloud = sumber kebenaran).
export const DEFAULT_TX_QUOTA = 50;

/** Bulan kalender berjalan, format 'YYYY-MM' (kunci siklus kuota). */
export function currentTxMonth(nowMs = Date.now()): string {
  const d = new Date(nowMs);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

/** Kuota global bulan ini: cache cloud (settings.trialConfig) → fallback default. */
export async function getTxQuota(): Promise<number> {
  let cfg: { txQuota?: number } | null = null;
  try { cfg = (await getSetting('trialConfig', null)) as any; } catch { /* storage gagal */ }
  const q = Number(cfg && cfg.txQuota);
  return (Number.isFinite(q) && q > 0) ? Math.floor(q) : DEFAULT_TX_QUOTA;
}

// ─── Persistent storage hint ─────────────────────────────────────────────────
// Minta penyimpanan persistent (sekali per sesi): tanpa ini Android Chrome boleh
// meng-evict IndexedDB → unitId/deviceCode lahir ulang → perangkat tampil
// sebagai unit baru di cloud.
let _persistAsked = false;
function requestPersistentStorage(): void {
  if (_persistAsked) return;
  _persistAsked = true;
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      Promise.resolve(navigator.storage.persisted ? navigator.storage.persisted() : Promise.resolve(false))
        .then((already) => { if (!already) return navigator.storage.persist(); })
        .catch(() => { /* izin ditolak browser — biarkan */ });
    }
  } catch { /* noop */ }
}

// ─── Identitas perangkat (deviceCode BEKU sekali lahir — kaki5 V5) ──────────
export interface DeviceIdentity {
  installId: string;
  deviceCode: string;
  fingerprint: string;
  candidateCode: string;
  fpVersion: 'V5';
}

export async function getDeviceIdentity(): Promise<DeviceIdentity> {
  requestPersistentStorage();
  const fingerprint = await getDeviceFingerprint();
  const stored = ((await getSetting('deviceIdentity', null)) as Partial<DeviceIdentity> | null) || {};
  const candidateCode = deriveDeviceCode(fingerprint);
  let deviceCode = stored.deviceCode || candidateCode;
  // KONVERGENSI LEGACY SEKALI (kasus kaki5 "kode perangkat beda antar browser
  // padahal dulu sama"): instalasi TANPA penanda fpVersion (pra-penanda)
  // konvergen SEKALI ke kandidat V5 — deterministik & hash seragam — lalu
  // membeku. Serial-bound ikut migrasi HANYA bila kode tercemat dalam serial =
  // kandidat V5.
  let lic: LicenseRecord | null = null;
  try { lic = await getLicense(); } catch { /* storage gagal — anggap non-serial */ }
  const serialBound = !!(lic && lic.status === 'active' && lic.serial);
  let serialMigratable = true;
  if (serialBound) {
    const m = String(lic && lic.serial || '').trim().toUpperCase()
      .match(/-([A-Z0-9]{4})-([A-Z0-9]{4})-[A-Z0-9]{2}-[A-Z0-9]{6}$/);
    serialMigratable = !!m && (m[1] + '-' + m[2]) === candidateCode;
  }
  // "Terjangkar" = derive(stored.fingerprint) === stored.deviceCode. Penanda
  // fpVersion saja TIDAK cukup (bisa basi dan memblokir konvergensi selamanya).
  const anchored = !!(stored.deviceCode && stored.fingerprint &&
    deriveDeviceCode(stored.fingerprint) === stored.deviceCode);
  if (stored.deviceCode && stored.deviceCode !== candidateCode &&
      (stored.fpVersion !== 'V5' || !anchored) &&
      (!serialBound || serialMigratable)) {
    deviceCode = candidateCode;
  }

  let installId = stored.installId || (await getSetting('installId', null) as string | null);
  if (!installId) {
    installId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8).toUpperCase();
    await setSetting('installId', installId);
  }

  // Fingerprint yang direkam harus pasangan sah deviceCode: bila kode TIDAK
  // migrasi (freeze), fingerprint lama dipertahankan — jangan ditimpa segar.
  const identity: DeviceIdentity = {
    installId,
    deviceCode,
    fingerprint: deviceCode === candidateCode ? fingerprint : (stored.fingerprint || fingerprint),
    candidateCode,
    fpVersion: 'V5',
  };
  await setSetting('deviceIdentity', identity);
  return identity;
}

export async function getDeviceCode(): Promise<string> {
  return (await getDeviceIdentity()).deviceCode;
}

export async function getInstallId(): Promise<string> {
  return (await getDeviceIdentity()).installId;
}

// ─── Salt HMAC dinamis (cloud → fallback lokal) ─────────────────────────────
let _hmacSaltCache: string | null = null;

async function getHmacSalt(): Promise<string> {
  if (_hmacSaltCache) return _hmacSaltCache;
  try {
    // Dynamic import: logic tidak hard-depend lapisan network saat modul di-load.
    const { fetchProductSalt } = await import('./sync');
    const result = await fetchProductSalt();
    if (!result) throw new Error('salt cloud tidak tersedia');
    _hmacSaltCache = result.salt;
    return result.salt;
  } catch (e: any) {
    console.warn('[LICENSE] Failed to get HMAC salt, using fallback:', e?.message || e);
    _hmacSaltCache = null; // jangan bekukan fallback — coba lagi besok
    return fallbackSalt();
  }
}

function fallbackSalt(): string {
  return DEFAULT_FALLBACK_SALT;
}

// Nilai fallback = konstanta di core (import terpisah supaya sync bisa pakai juga).
import { DEFAULT_LICENSE_SALT as DEFAULT_FALLBACK_SALT } from './core';

export function clearHmacSaltCache(): void {
  _hmacSaltCache = null;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  import('./sync').then(m => m.clearProductSaltCache()).catch(() => { /* noop */ });
}

/** Signature serial: b32(HMAC-salt(salt + d1+d2+exp), 6) dengan salt cloud. */
export async function hmacSignature(data: string): Promise<string> {
  const salt = await getHmacSalt();
  return hmacSignatureWithSalt(data, salt);
}

// ─── Expired & masa berlaku ──────────────────────────────────────────────────
export function checkExpired(expCode: string, activationDate: string, nowMs = Date.now()): boolean {
  if (expCode === '99' || expCode === 'ND') return false;
  if (expCode.endsWith('D')) {
    const days = parseInt(expCode);
    const expiry = new Date(activationDate);
    expiry.setDate(expiry.getDate() + days);
    return nowMs > expiry.getTime();
  }
  const months = parseInt(expCode);
  if (!isNaN(months)) {
    // Clamp tanggal: 31 Jan + 1 bulan = 28/29 Feb (bukan rollover ke 3 Mar).
    const expiry = new Date(activationDate);
    const day = expiry.getDate();
    expiry.setDate(1);
    expiry.setMonth(expiry.getMonth() + months);
    const lastDay = new Date(expiry.getFullYear(), expiry.getMonth() + 1, 0).getDate();
    expiry.setDate(Math.min(day, lastDay));
    return nowMs > expiry.getTime();
  }
  return false;
}

export function decodeExpiryLabel(expCode: string): string {
  if (expCode === '99') return 'Seumur Hidup';
  if (expCode === 'ND') return 'Selamanya';
  if (expCode.endsWith('D')) return `${parseInt(expCode)} Hari`;
  const m = parseInt(expCode);
  if (!isNaN(m)) return `${m} Bulan`;
  return expCode;
}

// ─── Anti-rollback jam (clockAnchor) ────────────────────────────────────────
// clockAnchor = waktu tertinggi yang pernah app lihat. Jam perangkat mundur
// > toleransi 2 hari → pakai anchor supaya trial/lisensi habis tidak hidup lagi.
const CLOCK_TOLERANCE_MS = 2 * 24 * 60 * 60 * 1000;

export async function getEffectiveNow(): Promise<number> {
  let anchor = 0;
  try { anchor = Number(await getSetting('clockAnchor', 0)) || 0; } catch { /* storage gagal */ }
  const now = Date.now();
  return (anchor && now < anchor - CLOCK_TOLERANCE_MS) ? anchor : now;
}

export async function bumpClockAnchor(): Promise<void> {
  try {
    const anchor = Number(await getSetting('clockAnchor', 0)) || 0;
    const now = Date.now();
    if (now > anchor) await setSetting('clockAnchor', now);
  } catch { /* penyimpanan gagal → abaikan */ }
}

// ─── Validasi serial ─────────────────────────────────────────────────────────
export interface SerialValidation {
  valid: boolean;
  reason?: string;
  expiry?: string;
  expiryLabel?: string;
}

export async function validateSerial(rawSerial: string, myDeviceCode: string, activationDate?: string): Promise<SerialValidation | null> {
  const clean = (rawSerial || '').trim().toUpperCase().replace(/\s+/g, '');
  const re = new RegExp('^' + PRODUCT_PREFIX + '-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{2})-([A-Z0-9]{6})$');
  const m = clean.match(re);
  if (!m) return null;
  const [, d1, d2, exp, sig] = m;
  if ((d1 + '-' + d2) !== myDeviceCode) {
    // Masa tenggang V3/V4 → V5: serial era fingerprint lama tetap sah —
    // V3 & V4 deterministik, bisa dihitung ulang di browser mana pun.
    const legacyV3 = await getLegacyV3DeviceCode();
    const legacyV4 = await getLegacyV4DeviceCode();
    if ((!legacyV3 || (d1 + '-' + d2) !== legacyV3) &&
        (!legacyV4 || (d1 + '-' + d2) !== legacyV4)) return { valid: false, reason: 'device' };
  }
  const expected = await hmacSignature(d1 + d2 + exp);
  if (sig !== expected) return { valid: false, reason: 'Signature HMAC tidak cocok' };
  if (checkExpired(exp, activationDate || new Date().toISOString())) return { valid: false, reason: 'expired' };
  return { valid: true, expiry: exp, expiryLabel: decodeExpiryLabel(exp) };
}

// ─── State lisensi (persist di settings + backup localStorage) ──────────────
// trial:   { status:'trial', txMonth:'YYYY-MM', txUsed, txAdjust, deviceCode }
// active:  { status:'active', startedAt, serial, deviceCode, expCode, expiryLabel }
// revoked: { status:'revoked', deviceCode, serial?, revokedAt, revokedReason }
export interface LicenseRecord {
  status?: 'trial' | 'active' | 'revoked';
  deviceCode?: string;
  txMonth?: string;
  txUsed?: number;
  txAdjust?: number;
  startedAt?: string;
  serial?: string;
  expCode?: string;
  expiryLabel?: string;
  source?: string;
  revokedAt?: string;
  revokedReason?: string;
  downgradedFrom?: string;
  downgradedAt?: string;
  downgradedReason?: string;
  [k: string]: unknown;
}

function readLocalBackup<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}

function writeLocalBackup(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

export async function getLicense(): Promise<LicenseRecord> {
  const stored = (await getSetting('license', null)) as LicenseRecord | null;
  const lic = (stored && typeof stored === 'object') ? stored : readLocalBackup<LicenseRecord>(LICENSE_BACKUP_KEY, {});
  return lic || {};
}

export async function saveLicense(lic: LicenseRecord): Promise<void> {
  await setSetting('license', lic);
  writeLocalBackup(LICENSE_BACKUP_KEY, lic);
}

/** Tandai lisensi dicabut admin — state lokal terkunci walau offline. */
export async function markLicenseRevoked(reason: string): Promise<void> {
  const lic = await getLicense();
  await saveLicense({
    status: 'revoked',
    deviceCode: lic.deviceCode || (await getDeviceIdentity()).deviceCode,
    serial: lic.serial || '',
    revokedAt: new Date().toISOString(),
    revokedReason: reason || 'admin',
  });
}

/** Cabut lisensi & hapus state lokal (fallback ekstrem). */
export async function clearLocalLicense(): Promise<void> {
  await setSetting('license', {});
  writeLocalBackup(LICENSE_BACKUP_KEY, {});
}

// ─── Tier gratis (kuota per bulan kalender) ─────────────────────────────────
/** Mulai/lanjutkan tier gratis (idempoten). Bulan baru = kuota segar. */
export async function startTrial(): Promise<LicenseRecord | { status: 'active' }> {
  const lic = await getLicense();
  if (lic.status === 'active') return { status: 'active' };
  const month = currentTxMonth();
  if (lic.status === 'trial' && lic.txMonth === month) return lic;
  const carry = (lic.status === 'trial' && lic.txMonth === month) ? (Number(lic.txUsed) || 0) : 0;
  const trial: LicenseRecord = {
    status: 'trial',
    txMonth: month,
    txUsed: carry,
    txAdjust: Number(lic.txAdjust) || 0,
    deviceCode: (await getDeviceIdentity()).deviceCode,
  };
  await saveLicense(trial);
  try {
    const { deviceCode } = await getDeviceIdentity();
    await quotaEnsure(getSetting, setSetting, hmacSignature, deviceCode, Date.now());
  } catch { /* jalur non-kritikel */ }
  return trial;
}

/**
 * Naikkan penghitung transaksi bulan berjalan — dipanggil TEPAT SETELAH
 * penjualan tersimpan (pos-service.persist). Lisensi aktif tidak dibatasi
 * kuota — penghitung tidak perlu dicatat.
 */
export async function incrementTxCount(): Promise<void> {
  const lic = await getLicense();
  if (lic.status !== 'trial') return;
  const month = currentTxMonth();
  const used = (lic.txMonth === month ? (Number(lic.txUsed) || 0) : 0) + 1;
  await saveLicense({ ...lic, txMonth: month, txUsed: used });
  try {
    const { deviceCode } = await getDeviceIdentity();
    await quotaTickTx(getSetting, setSetting, hmacSignature, deviceCode, Date.now());
  } catch { /* jalur non-kritikel */ }
}

// ─── Aktivasi serial manual (fallback offline) ──────────────────────────────
export interface ActivateResult {
  ok: boolean;
  valid: boolean;
  message: string;
}

export async function activateSerial(rawSerial: string): Promise<ActivateResult> {
  const { deviceCode } = await getDeviceIdentity();
  const serial = (rawSerial || '').trim().toUpperCase();
  const result = await validateSerial(serial, deviceCode, new Date().toISOString());
  if (!result || !result.valid) {
    if (result && result.reason === 'device') return { ok: false, valid: false, message: 'Kode ini bukan untuk perangkat ini.' };
    if (result && result.reason === 'expired') return { ok: false, valid: false, message: 'Kode lisensi sudah kedaluwarsa.' };
    return { ok: false, valid: false, message: 'Serial tidak valid.' };
  }
  const m = serial.match(/-([A-Z0-9]{2})-[A-Z0-9]{6}$/);
  const expCode = m ? m[1] : '99';
  const lic: LicenseRecord = { status: 'active', startedAt: new Date().toISOString(), serial, deviceCode, expCode, expiryLabel: result.expiryLabel };
  await saveLicense(lic);
  return { ok: true, valid: true, message: 'Lisensi aktif! Masa berlaku: ' + result.expiryLabel };
}

// ─── Guard tabrakan identitas (port rosok) ──────────────────────────────────
// Fingerprint TIDAK unik antar perangkat — dua HP tipe sama menghasilkan
// unit_id sama. Adopsi lisensi cloud hanya bila baris belum diprofilkan ATAU
// profil cocok dengan lokal (nama usaha / no. WA).
export async function cloudProfileMatchesLocal(cloud: Record<string, any>): Promise<boolean> {
  const g = async (k: string) => { try { return String(await getSetting(k, '') || '').trim().toLowerCase(); } catch { return ''; } };
  const cloudUsaha = String(cloud.nama_usaha || '').trim().toLowerCase();
  const cloudWa = String(cloud.no_whatsapp || '').trim().toLowerCase();
  if (!cloudUsaha && !cloudWa) return true; // baris belum diprofilkan → aman
  const localUsaha = await g('namaUsaha') || await g('namaWarung');
  const localWa = await g('noWhatsapp');
  if (!localUsaha && !localWa) return true; // lokal kosong (install baru) BUKAN tabrakan
  return (!!cloudUsaha && !!localUsaha && cloudUsaha === localUsaha)
      || (!!cloudWa && !!localWa && cloudWa === localWa);
}

/**
 * Persist status aktif dari cloud (sumber kebenaran — pembayaran diverifikasi
 * admin) TANPA validasi ulang HMAC; serial cloud bisa terbit dengan binding
 * berbeda sehingga activateSerial() gagal diam-diam (bug chip zombie 2026-08-25).
 */
export async function persistCloudLicense(cloud: Record<string, any>): Promise<{ valid: boolean; message?: string; already?: boolean; lic?: LicenseRecord }> {
  if (!cloud || cloud.license_status !== 'aktif') return { valid: false, message: 'Status cloud bukan aktif' };
  const local = await getLicense();
  if (local.status === 'active') return { valid: true, already: true };
  if (!(await cloudProfileMatchesLocal(cloud))) {
    console.warn('[LICENSE] adopsi cloud DITOLAK — profil tidak cocok (indikasi tabrakan identitas)');
    return { valid: false, message: 'Baris lisensi ini terikat profil usaha lain — hubungi admin' };
  }
  const serial = String(cloud.license_serial || '').trim().toUpperCase();
  const m = serial.match(/-([A-Z0-9]{2})-[A-Z0-9]{6}$/);
  const expCode = m ? m[1] : '99';
  let expiryLabel = decodeExpiryLabel(expCode);
  if (cloud.license_expires_at) {
    const d = new Date(cloud.license_expires_at);
    if (!isNaN(d.getTime())) expiryLabel = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  const lic: LicenseRecord = {
    status: 'active',
    startedAt: local.startedAt || new Date().toISOString(),
    serial: serial || local.serial || '',
    deviceCode: local.deviceCode || (await getDeviceIdentity()).deviceCode,
    expCode,
    expiryLabel,
    source: 'cloud',
  };
  await saveLicense(lic);
  return { valid: true, lic };
}

// ─── unitId (global DNA, IMMUTABLE) ─────────────────────────────────────────
// unitId lahir SATU KALI lalu terikat permanen ke serial/profil. Reassign hanya
// lewat RPC `device_assign` di server.
export async function getUnitId(): Promise<string> {
  let unitId = (await getSetting('unitId', null)) as string | null;
  if (unitId) return unitId;
  const { deviceCode } = await getDeviceIdentity();
  const fresh = UNIT_ID_PREFIX + deviceCode;
  await setSetting('unitId', fresh);
  return fresh;
}

export async function ensureUnitId(): Promise<string> {
  return await getUnitId();
}

// ─── Status lisensi (gate + banner) ─────────────────────────────────────────
export type LicenseState = 'none' | 'trial' | 'active' | 'expired' | 'revoked';

export interface LicenseStatus {
  // Shape kanonik kaki5:
  status: LicenseState;
  deviceCode: string;
  serial?: string;
  expCode?: string;
  expiryLabel?: string;
  revokedAt?: string;
  trialExpired?: boolean;
  offlineBudget?: string;
  txRemaining?: number;
  txUsed?: number;
  protocol?: string;
  // Field kenyamanan UI minimarket (turunan — jangan dipakai logika bisnis):
  level: 'trial' | 'active' | 'revoked' | 'expired' | 'pending';
  unitId: string;
  txCount: number;
  txQuota: number;
  daysUntilExpiry: number | null;
}

function levelOf(s: LicenseState, trialExpired?: boolean): LicenseStatus['level'] {
  if (s === 'none') return 'pending';
  if (s === 'expired') return trialExpired ? 'trial' : 'expired';
  return s as LicenseStatus['level'];
}

/** Hitung hari tersisa utk serial berbayar (exp bulanan/harian). '99'/'ND' = null. */
function daysUntilActiveExpiry(expCode: string, startedAt: string, nowMs: number): number | null {
  if (!expCode || expCode === '99' || expCode === 'ND') return null;
  let expiry: Date | null = null;
  if (expCode.endsWith('D')) {
    expiry = new Date(startedAt);
    expiry.setDate(expiry.getDate() + parseInt(expCode));
  } else {
    const months = parseInt(expCode);
    if (!isNaN(months)) {
      expiry = new Date(startedAt);
      const day = expiry.getDate();
      expiry.setDate(1);
      expiry.setMonth(expiry.getMonth() + months);
      const lastDay = new Date(expiry.getFullYear(), expiry.getMonth() + 1, 0).getDate();
      expiry.setDate(Math.min(day, lastDay));
    }
  }
  if (!expiry) return null;
  return Math.max(0, Math.ceil((expiry.getTime() - nowMs) / 86_400_000));
}

export async function getLicenseStatus(): Promise<LicenseStatus> {
  const lic = await getLicense();
  const identity = await getDeviceIdentity();
  const unitId = await getUnitId();
  const nowMs = await getEffectiveNow();
  if (nowMs === Date.now()) void bumpClockAnchor(); // jam sehat → catat jadi anchor

  const base = { unitId };
  if (!lic || !lic.status) {
    return { ...base, status: 'none', level: 'pending', deviceCode: identity.deviceCode, txCount: 0, txQuota: await getTxQuota(), daysUntilExpiry: null };
  }
  if (lic.status === 'active') {
    const expired = (lic.expCode === '99' || lic.expCode === 'ND') ? false : checkExpired(lic.expCode || '99', lic.startedAt || new Date(0).toISOString(), nowMs);
    if (expired) return { ...base, status: 'expired', level: 'expired', deviceCode: identity.deviceCode, protocol: 'licensed-expired', serial: lic.serial, txCount: 0, txQuota: 0, daysUntilExpiry: 0 };
    return {
      ...base, status: 'active', level: 'active', deviceCode: identity.deviceCode,
      serial: lic.serial, expCode: lic.expCode, expiryLabel: lic.expiryLabel,
      txCount: 0, txQuota: 0,
      daysUntilExpiry: daysUntilActiveExpiry(lic.expCode || '', lic.startedAt || new Date().toISOString(), nowMs),
    };
  }
  if (lic.status === 'revoked') {
    return { ...base, status: 'revoked', level: 'revoked', deviceCode: identity.deviceCode, revokedAt: lic.revokedAt, serial: lic.serial, txCount: 0, txQuota: 0, daysUntilExpiry: null };
  }
  if (lic.status === 'trial') {
    const month = currentTxMonth(nowMs);
    const used = lic.txMonth === month ? (Number(lic.txUsed) || 0) : 0;
    const quota = (await getTxQuota()) + (Number(lic.txAdjust) || 0);
    const remaining = quota - used;
    if (remaining <= 0) {
      return { ...base, status: 'expired', level: 'trial', trialExpired: true, deviceCode: identity.deviceCode, txRemaining: 0, txQuota: quota, txUsed: used, txCount: used, daysUntilExpiry: null };
    }
    // Jatah OFFLINE: offline >= 30 hari DAN (lifetime >= 300 trx ATAU usia >= 3 bln) → kunci.
    try {
      const { meta, tampered } = await quotaEnsure(getSetting, setSetting, hmacSignature, identity.deviceCode, nowMs);
      if (tampered) {
        return { ...base, status: 'expired', level: 'trial', trialExpired: true, offlineBudget: 'tampered', deviceCode: identity.deviceCode, txRemaining: Math.max(0, remaining), txQuota: quota, txUsed: used, txCount: used, daysUntilExpiry: null };
      }
      const bud = quotaBudgetStatus(meta, nowMs);
      if (bud.block) {
        return { ...base, status: 'expired', level: 'trial', trialExpired: true, offlineBudget: bud.reason, deviceCode: identity.deviceCode, txRemaining: Math.max(0, remaining), txQuota: quota, txUsed: used, txCount: used, daysUntilExpiry: null };
      }
    } catch { /* storage gagal → lanjut (gate kuota bulan masih jaga) */ }
    return { ...base, status: 'trial', level: 'trial', deviceCode: identity.deviceCode, txRemaining: remaining, txQuota: quota, txUsed: used, txCount: used, daysUntilExpiry: null };
  }
  return { ...base, status: 'none', level: 'pending', deviceCode: identity.deviceCode, txCount: 0, txQuota: await getTxQuota(), daysUntilExpiry: null };
}

export async function isLicensed(): Promise<boolean> {
  const lic = await getLicense();
  if (lic.status !== 'active') return false;
  return !checkExpired(lic.expCode || '99', lic.startedAt || new Date(0).toISOString(), await getEffectiveNow());
}

/** Re-export util inti biar konsumen lama (index) tetap kompilasi. */
export { simpleHash, b32Encode, deriveDeviceCode, getDeviceFingerprint, isPlaceholderKey };
