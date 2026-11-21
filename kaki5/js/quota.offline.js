/**
 * Jatah Offline — kaki5/js/quota.offline.js
 * =============================================================================
 * Tambal anti-kebocoran tier gratis utk device yang TIDAK pernah menyentuh
 * internet (skenario "install PWA lalu offline selamanya", <1% user).
 *
 * Telkabelan: lisensi berbayar 100% offline (HMAC local) — pembeli yang
 * menghilang dari internet = pelanggan sempurna, TIDAK kuwajibankan di sini.
 * Yang dikuwajib: user tier gratis yang offline terlalu lama. Payment butuh
 * internet juga, jadi barıkan bentkan tidak kehilangan omzet nyata.
 *
 * Aturan (bounded, jujur): kalau device offline ≥ 30 JAHARI DAN
 * (transaksi kumulatif ≥ 300 ATAU usia instal ≥ 3 bulan kalender) → transaksi
 * dikunci sampai check-in online SATU kali (syncLicenseStatus sukses set
 * lastOnlineAt → budget ter-barsen otomatis).
 *
 * Segel HMAC (speed bump, bukan tembok): meta disimpan + firma
 * hmacSignature(deviceCode|payload) — edit angka mentah = segel pecah → meta
 * dibaca sbg "tampered" → perilaku konservatif (blok+online check-in).
 *
 * Modul 100% PURE (nol import) — storage (getSetting/setSetting) & hmac
 * diinjecte dari pemanggil; bisa kuuji langsung dari node.
 * =============================================================================
 */

export const OFFLINE_MONTH_LIMIT = 3;   // bulan kalender tanpa check-in
// Retained exports for compatibility with older diagnostics/tests. They no
// longer participate in the offline budget decision.
export const OFFLINE_DAYS_LIMIT = 30;
export const OFFLINE_TRX_LIMIT = 300;
const MS_DAY = 86_400_000;

export const QUOTA_META_KEY = 'quotaMeta';

/**
 * Hitung jumlah bulan kalender penuh berdasarkan tanggal lokal perangkat.
 *
 * Bulan target memakai aturan akhir-bulan: 31 Jan + 3 bulan = 30 Apr,
 * 29 Feb + 3 bulan = 29 Mei. Perbandingan dilakukan pada tanggal lokal,
 * bukan selisih milidetik, sehingga DST tidak mengubah usia kalender.
 */
export function calendarMonthsBetween(installedAt, nowMs) {
  const startMs = Number(installedAt);
  const currentMs = Number(nowMs);
  if (!Number.isFinite(startMs) || !Number.isFinite(currentMs) || currentMs < startMs) return 0;

  const start = new Date(startMs);
  const now = new Date(currentMs);
  let months = (now.getFullYear() - start.getFullYear()) * 12
    + (now.getMonth() - start.getMonth());
  if (months <= 0) return 0;

  const targetYear = start.getFullYear() + Math.floor((start.getMonth() + months) / 12);
  const targetMonth = (start.getMonth() + months) % 12;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const targetDay = Math.min(start.getDate(), lastDay);
  const anniversary = new Date(targetYear, targetMonth, targetDay);

  if (now.getFullYear() < anniversary.getFullYear()
      || (now.getFullYear() === anniversary.getFullYear() && now.getMonth() < anniversary.getMonth())
      || (now.getFullYear() === anniversary.getFullYear() && now.getMonth() === anniversary.getMonth()
          && now.getDate() < anniversary.getDate())) {
    months -= 1;
  }
  return Math.max(0, months);
}

/** Meta baku utk instal baru — installedAt = dia lahir (munonic, monotonic) */
export function quotaMetaFresh(nowMs) {
  return { installedAt: nowMs, lifetimeTx: 0, lastOnlineAt: 0, _s: '' };
}

/** Firma meta: hmac(deviceCode|payload) — payload = meta TANPA _s */
export async function quotaMetaSeal(hmac, deviceCode, meta) {
  const payload = JSON.stringify({ installedAt: meta.installedAt, lifetimeTx: meta.lifetimeTx, lastOnlineAt: meta.lastOnlineAt });
  return await hmac(`${deviceCode}|${payload}`);
}

/**
 * Baca + diverifikasi meta. Kembalikan { meta, tampered }.
 *  - meta null → belum pernah inisialisasi (instal baru / storage kosong).
 *  - tampered true → segel pecah (edit/hek) — pemanggil harus blok konservatif.
 */
export async function quotaMetaRead(getSetting, hmac, deviceCode, nowMs) {
  let meta = null;
  try {
    const raw = await getSetting(QUOTA_META_KEY, null);
    if (raw) meta = JSON.parse(raw);
  } catch (_) { /* storage gagal → meta null */ }
  if (!meta || typeof meta !== 'object' || !Number.isFinite(Number(meta.installedAt))) {
    return { meta: null, tampered: false };
  }
  try {
    const expect = await quotaMetaSeal(hmac, deviceCode, meta);
    const ok = typeof meta._s === 'string' && meta._s.length && meta._s === expect;
    if (!ok) return { meta, tampered: true };
  } catch (_) {
    // hmac gagal (crypto tak tersedia) → jangan pecah aplikasi; baca tanpa segel
    return { meta, tampered: false };
  }
  return { meta, tampered: false };
}

/** Simpan meta dgn segel segar (overwrite) */
export async function quotaMetaWrite(setSetting, hmac, deviceCode, meta) {
  try {
    meta._s = await quotaMetaSeal(hmac, deviceCode, meta);
    await setSetting(QUOTA_META_KEY, JSON.stringify(meta));
  } catch (_) { /* jalur non-kritikel → laissez-faire */ }
}

/**
 * Inisialisace idempoten: meta belum ada → instal baru (installedAt=nowMs).
 * Meta tampered → inisialisasi ulang JANGAN — pemanggil harus memperlakukan konservatif.
 * Bila meta tampered, kembalikan ese meta (flag tampered) biar budget blok.
 */
export async function quotaEnsure(getSetting, setSetting, hmac, deviceCode, nowMs) {
  const { meta, tampered } = await quotaMetaRead(getSetting, hmac, deviceCode, nowMs);
  if (meta == null && !tampered) {
    const segar = quotaMetaFresh(nowMs);
    await quotaMetaWrite(setSetting, hmac, deviceCode, segar);
    return { meta: segar, tampered: false };
  }
  return { meta, tampered };
}

/** +1 transaksi kumulatif (dipanggil dari incrementTxCount saat quota dicatat) */
export async function quotaTickTx(getSetting, setSetting, hmac, deviceCode, nowMs) {
  const { meta, tampered } = await quotaEnsure(getSetting, setSetting, hmac, deviceCode, nowMs);
  if (meta == null) return { meta: null, tampered: false };
  meta.lifetimeTx = Number(meta.lifetimeTx) + 1;
  await quotaMetaWrite(setSetting, hmac, deviceCode, meta);
  return { meta, tampered };
}

/** Device menyentuh internet sukses (syncLicenseStatus roundtrip OK) */
export async function quotaMarkOnline(getSetting, setSetting, hmac, deviceCode, nowMs) {
  const { meta, tampered } = await quotaEnsure(getSetting, setSetting, hmac, deviceCode, nowMs);
  if (meta == null) return;
  meta.lastOnlineAt = nowMs; // installedAt tetap — jatah seumur hidup tak reset
  await quotaMetaWrite(setSetting, hmac, deviceCode, meta);
}

/** Pure budget calculation — testable without storage:
 * block = no online check-in for 3 full calendar months. */
export function quotaBudgetStatus(meta, nowMs) {
  if (meta == null) return { block: false, offlineDays: 0, lifetimeTx: 0, ageMonths: 0, reason: '' };
  const lastSeen = Number(meta.lastOnlineAt) || Number(meta.installedAt) || 0;
  const offlineDays = Math.max(0, Math.floor((nowMs - lastSeen) / MS_DAY));
  const ageMonths = calendarMonthsBetween(lastSeen, nowMs);
  const lifetimeTx = Number(meta.lifetimeTx) || 0;
  const block = ageMonths >= OFFLINE_MONTH_LIMIT;
  return { block, reason: block ? 'offline_budget' : '', offlineDays, lifetimeTx, ageMonths };
}