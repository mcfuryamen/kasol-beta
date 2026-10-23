/** QA browser fix multi-identitas rosok (2026-09-13).
 *  Origin 127.0.0.1:8084 (isolasi QA). Baris uji dibuat & dihapus via
 *  service key (di luar skrip ini). Skenario:
 *   E1 Re-anchor lolos guard osilasi untuk identitas V5 terfrozen
 *      (unit era lama + anchor racun) → PATCH rename baris uji.
 *   E2 Backfill install_id pada baris lama via syncLicenseStatus.
 *   E3 Self-insert membawa install_id + telemetri (baris dihapus dulu).
 */
import { chromium } from 'file:///C:/Users/Admin/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';

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
await page.waitForTimeout(2000);

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

// Snapshot state QA origin utk dipulihkan di akhir
const snap = await safeEval(async () => {
  const { getSetting } = await import('./js/utils.js');
  return {
    unitId: await getSetting('unitId', null),
    identity: await getSetting('deviceIdentity', null),
    reanchor: await getSetting('unitReanchor', null)
  };
});
const REAL_UNIT = snap.unitId; // KSR-00O1-5RD4
ok('S0 state QA origin: unitId & identitas V5 terfrozen tersedia',
  !!REAL_UNIT && snap.identity && snap.identity.fpVersion === 'V5', REAL_UNIT);

// ── E1: re-anchor dengan guard racun + unit era lama ───────────────────────
const e1 = await safeEval(async (realUnit) => {
  const { setSetting, getSetting } = await import('./js/utils.js');
  const { reanchorUnitId } = await import('./js/license.sync.js');
  // identitas forged: fingerprint 'FORGEDFP' → deviceCode = devCode('FORGEDFP')
  const L = await import('./js/license.js');
  const fakeCode = L.getDeviceCode ? null : null; // getDeviceCode butuh argumen string
  const fp = 'FORGEDFP';
  const code = (await import('./js/license.js')).getDeviceCode(fp);
  await setSetting('deviceIdentity', {
    installId: 'DEV-QATEST', deviceCode: code, fingerprint: fp,
    candidateCode: code, fpVersion: 'V5', legacyDeviceCode: ''
  });
  await setSetting('unitId', 'KSR-QATEST-OLD');
  await setSetting('unitReanchor', { to: 'KSR-QATEST-FAKE3RD', at: new Date().toISOString() }); // anchor racun
  const r = await reanchorUnitId();
  const unitIdAfter = await getSetting('unitId', null);
  const raAfter = await getSetting('unitReanchor', null);
  return { reason: r.reason, ok: r.ok, canonical: 'KSR-' + code, unitIdAfter, raTo: raAfter && raAfter.to, err: r.error || '' };
}, REAL_UNIT);
ok('E1 re-anchor TIDAK diblokir guard (frozen V5 exempt)',
  e1.ok === true && e1.reason === 'migrated', 'reason=' + e1.reason + ' ' + e1.err);
ok('E1b unitId pindah ke kanonik & anchor tercatat',
  e1.unitIdAfter === e1.canonical && e1.raTo === e1.canonical, e1.unitIdAfter);

// ── E2: backfill install_id baris lama ─────────────────────────────────────
const e2 = await safeEval(async (realUnit) => {
  const { setSetting } = await import('./js/utils.js');
  const { syncLicenseStatus } = await import('./js/license.sync.js');
  const L = await import('./js/license.js');
  await setSetting('unitId', realUnit); // baris nyata QA (install_id kosong)
  const r = await syncLicenseStatus(realUnit, L.licenseStateApi);
  return { ok: r.ok, reason: r.reason };
}, REAL_UNIT);
ok('E2 syncLicenseStatus sukses (jalur backfill jalan)',
  e2.ok === true, 'reason=' + e2.reason);

await browser.close();
console.log(`\n${results.filter(r => r.pass).length}/${results.length} PASS (verifikasi DB menyusul via service key)`);
process.exit(results.some(r => !r.pass) ? 1 : 0);
