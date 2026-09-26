/** QA browser modul identifikasi perangkat rosok (2026-09-13).
 *  Origin 127.0.0.1:8084 = origin isolasi QA (aturan pemilik).
 *  Skenario:
 *   A. Boot bersih — tanpa error console, identitas V5, unitId, status lisensi.
 *   B. Masa tenggang serial era V4 — re-derive deterministik (inti fix).
 *   C. Pemulihan unitId ala kaki5 (hapus unitId → re-mint nilai sama).
 *   D. persistCloudLicense — deviceCode terisi dari identitas hidup.
 */
import { chromium } from 'file:///C:/Users/Admin/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';
import { createHash } from 'node:crypto';

const BASE = 'http://127.0.0.1:8084';
const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`);
};

const browser = await chromium.launch({ channel: 'chrome' });
const errors = [];
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500); // beri waktu initApp (identity → reanchor → gate)

// SW/update.js boleh me-reload halaman saat QA — evaluate dengan retry.
async function safeEval(fn, arg) {
  for (let i = 0; i < 6; i++) {
    try {
      await page.waitForLoadState('domcontentloaded');
      return await page.evaluate(fn, arg);
    } catch (e) {
      if (i === 5) throw e;
      await page.waitForTimeout(1200);
    }
  }
}

// ── A. Boot bersih ─────────────────────────────────────────────────────────
const boot = await safeEval(async () => {
  const L = await import('./js/license.js');
  const { getSetting } = await import('./js/utils.js');
  const identity = await L.getDeviceIdentity();
  const unitId = await L.ensureUnitId();
  const unitIdStored = await getSetting('unitId', null);
  const st = await L.getLicenseStatus();
  const legacyV4 = await L.getLegacyV4DeviceCodes();
  const sha = [...new Uint8Array(await L.sha256Bytes('abc'))].map(b => b.toString(16).padStart(2, '0')).join('');
  return {
    deviceCode: identity.deviceCode, fpVersion: identity.fpVersion,
    installId: identity.installId, unitId, unitIdStored, stStatus: st.status,
    stDeviceCode: st.deviceCode, legacyV4, sha
  };
});
const codeRe = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;
ok('A1 boot tanpa error console (non-jaringan)', errors.filter(e => !/Failed to load resource|net::|supabase/i.test(e)).length === 0, errors.join(' | ').slice(0, 300));
ok('A2 deviceCode format beku + fpVersion V5', codeRe.test(boot.deviceCode) && boot.fpVersion === 'V5', boot.deviceCode);
ok('A3 installId terisi', String(boot.installId).length >= 8, String(boot.installId).slice(0, 12) + '…');
ok('A4 unitId = KSR-+deviceCode & tersimpan', boot.unitId === 'KSR-' + boot.deviceCode && boot.unitIdStored === boot.unitId, boot.unitId);
ok('A5 getLicenseStatus deviceCode = identitas (bukan lic basi)', boot.stDeviceCode === boot.deviceCode, 'status=' + boot.stStatus);
ok('A6 re-derive V4 ≥2 kode (2 rasa digest, +orientasi bila layar tak kotak)', boot.legacyV4.length >= 2 && boot.legacyV4.every(codeRe.test.bind(codeRe)), boot.legacyV4.join(', '));
ok('A7 sha256Bytes benar (fallback path identik subtle)', boot.sha === createHash('sha256').update('abc').digest('hex'), boot.sha.slice(0, 16) + '…');

// ── B. Masa tenggang serial era V4 (inti fix) ──────────────────────────────
const masa = await safeEval(async (legacyV4) => {
  const L = await import('./js/license.js');
  const my = (await L.getDeviceIdentity()).deviceCode;
  const now = new Date().toISOString();
  const mk = (dc) => 'KSR-' + dc.slice(0, 4) + '-' + dc.slice(5) + '-99-AAAAAA'; // dc = AAAA-BBBB
  const v4 = await L.validateLicenseKeyV2(mk(legacyV4[0]), my, now);
  const v4b = await L.validateLicenseKeyV2(mk(legacyV4[legacyV4.length - 1]), my, now);
  const asing = await L.validateLicenseKeyV2('KSR-9999-9999-99-AAAAAA', my, now);
  // jalur legacyDeviceCode tersimpan (era deviceId-acak)
  const { getSetting, setSetting } = await import('./js/utils.js');
  const di = (await getSetting('deviceIdentity', null)) || {};
  await setSetting('deviceIdentity', { ...di, legacyDeviceCode: 'ZZZZ-ZZZZ' });
  const leg = await L.validateLicenseKeyV2('KSR-ZZZZ-ZZZZ-99-AAAAAA', my, now);
  await setSetting('deviceIdentity', di); // pulihkan
  return { v4: v4 && v4.reason, v4b: v4b && v4b.reason, asing: asing && asing.reason, leg: leg && leg.reason };
}, boot.legacyV4);
ok('B1 serial era V4 (re-derive) lolos cek perangkat → gagal di HMAC palsu', masa.v4 === 'Signature HMAC tidak cocok', 'reason=' + masa.v4);
ok('B2 serial era V4 rasa terakhir juga lolos cek perangkat', masa.v4b === 'Signature HMAC tidak cocok', 'reason=' + masa.v4b);
ok('B3 kode asing tetap ditolak reason=device', masa.asing === 'device', 'reason=' + masa.asing);
ok('B4 legacyDeviceCode tersimpan (era deviceId-acak) tetap diterima', masa.leg === 'Signature HMAC tidak cocok', 'reason=' + masa.leg);

// ── C. Pemulihan unitId (port kaki5 getUnitId) ─────────────────────────────
const pulih = await safeEval(async () => {
  const L = await import('./js/license.js');
  const { getSetting, setSetting } = await import('./js/utils.js');
  const sebelum = await getSetting('unitId', null);
  await setSetting('unitId', null);
  const mint = await L.ensureUnitId();
  const stored = await getSetting('unitId', null);
  return { sebelum, mint, stored };
});
ok('C1 unitId hilang → di-mint ulang NILAI SAMA dari identitas', pulih.sebelum && pulih.mint === pulih.sebelum && pulih.stored === pulih.sebelum, pulih.mint);

// ── D. persistCloudLicense deviceCode dari identitas hidup ─────────────────
const adopsi = await safeEval(async () => {
  const L = await import('./js/license.js');
  const { getSetting, setSetting } = await import('./js/utils.js');
  const { persistCloudLicense } = await import('./js/license.sync.js');
  await setSetting('license', {});
  const r = await persistCloudLicense({ license_status: 'aktif', license_serial: 'KSR-1111-2222-99-333333', nama_usaha: '', no_whatsapp: '' });
  const lic = await getSetting('license', null);
  const dc = (await L.getDeviceIdentity()).deviceCode;
  await setSetting('license', {}); // bersihkan lagi (origin QA)
  return { r, licDeviceCode: lic && lic.deviceCode, dc };
});
ok('D1 adopsi cloud sukses & deviceCode terisi identitas hidup', adopsi.r === true && adopsi.licDeviceCode === adopsi.dc, adopsi.licDeviceCode);

await browser.close();
const fail = results.filter(r => !r.pass).length;
console.log(`\n${results.length - fail}/${results.length} PASS`);
process.exit(fail ? 1 : 0);
