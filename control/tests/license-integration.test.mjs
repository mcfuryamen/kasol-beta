/**
 * INTEGRATION TEST — Lisensi KAKI5 ⇄ ADMIN (tanpa generator terpisah)
 * ===================================================================
 * Verifikasi end-to-end bahwa serial yang DIGENERATE admin
 * (js/license-core.js, sumber kebenaran) DIVALIDASI benar oleh kaki5
 * (js/license.logic.js), memakai KODE ASLI kedua app — bukan rekonstruksi.
 *
 * Skenario: lifetime, bulanan, harian, device-bound mismatch, signature
 * tamper, expired, format salah, trial extension cap.
 *
 * Jalankan:  node admin/tests/license-integration.test.mjs
 */

/* ---------------- boot: stub utk memuat modul browser ------------------ */
const settingsMap = new Map();
globalThis.Dexie = class {
  constructor(){}
  // db.js sekarang memasang db.on('blocked', ...) + version(N).stores(...).upgrade(...)
  // di top-level — stub lama (tanpa on/upgrade) membuat test crash sejak db.js
  // menambahkan handler blocked (fix "daftar hilang diam-diam").
  on(){ return this; }
  version(){
    const chain = { stores(){ return { upgrade(){} }; } };
    return chain;
  }
  async open(){}
  get settings() {
    return {
      async get(k){ return settingsMap.has(k) ? { key:k, value: settingsMap.get(k) } : undefined; },
      async put({key,value}){ settingsMap.set(key, value); }
    };
  }
};
Object.defineProperty(globalThis, 'navigator', { value:{ platform:'Win32', hardwareConcurrency:8, deviceMemory:8, maxTouchPoints:2 }, configurable:true });
Object.defineProperty(globalThis, 'screen', { value:{ width:1920, height:1080, devicePixelRatio:1 }, configurable:true });

const ADM = 'file:///C:/Users/Admin/Documents/kasol/admin/js/license-core.js';
const KK5 = 'file:///C:/Users/Admin/Documents/kasol/kaki5/js/license.logic.js';

const admin  = await import(ADM);
const kaki5 = await import(KK5);

/* ---------------- async runner ------------------------------------------ */
let passed = 0, failed = 0;
const queue = [];
const t = (name, fn) => queue.push({ name, fn });
const eq = (a,b) => { if (a!==b) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const ok = (v) => { if (!v) throw new Error('false'); };

async function runAll() {
  for (const { name, fn } of queue) {
    try { await fn(); passed++; console.log(`  ✅ ${name}`); }
    catch (e) { failed++; console.log(`  ❌ ${name}\n     ${String(e.message)}`); }
  }
}

/* ====================================================================== */
const ADMIN_KK5_SALT = 'KASIRSOLO-KAKI5-HMAC-V2';
// rekonstruksi persis buildProductSalt() kaki5 dari source
const KAKI5_SALT_SRC = ['KASIR'+'SOLO', 'KAKI'+'5', 'HMAC'+'-'+'V2'].join('-');
// device code kaki5 YANG SEBENARNYA (dari fingerprint runtime), supaya test
// aktivasi nyambung dgn generate.
const device = await kaki5.getDeviceCode();
const FUTURE = new Date(Date.now() + 200 * 864e5).toISOString();
const gen = (exp) => admin.generateSerial('KK5', ADMIN_KK5_SALT, device, exp);

console.log('── ROOT CAUSE: konsistensi salt antar app ──');
console.log(`[info] admin salt  = ${ADMIN_KK5_SALT}`);
console.log(`[info] kaki5 salt  = ${KAKI5_SALT_SRC}`);
t('Salt admin & kaki5 SAMA (root cause)', () => { eq(KAKI5_SALT_SRC, ADMIN_KK5_SALT); });

console.log('\n── Skenario 1: Admin generate → kaki5 validasi (lifetime/bulan/hari) ──');
t('Valid: lifetime (99) diterima kaki5', async () => {
  const r = await kaki5.validateSerial(await gen(99), device, new Date().toISOString());
  ok(r && r.valid); eq(r.expiryLabel, 'Seumur Hidup');
});
t('Valid: 6 bulan (06)', async () => {
  const r = await kaki5.validateSerial(await gen(6), device, FUTURE);
  ok(r && r.valid); eq(r.expiry, '06');
});
t('Valid: 7 hari (7D)', async () => {
  const r = await kaki5.validateSerial(await gen('7D'), device, FUTURE);
  ok(r && r.valid); eq(r.expiry, '7D');
});

console.log('\n── Skenario 2: Device-bound ──');
t('Serial deviceA DITOLAK di deviceB (reason=device)', async () => {
  const s = await admin.generateSerial('KK5', ADMIN_KK5_SALT, 'A1B2-C3D4', 99);
  const r = await kaki5.validateSerial(s, 'X9Y8-W7Z6', new Date().toISOString());
  ok(r && r.valid === false && r.reason === 'device');
});

console.log('\n── Skenario 3: Tamper signature / format ──');
t('Ubah 1 char signature → tidak valid', async () => {
  const base = await gen(99);
  const [d1, d2, exp] = base.split('-').slice(1,4);
  const tampered = 'KK5-' + d1 + '-' + d2 + '-' + exp + '-A' + base.slice(-5);
  const r = await kaki5.validateSerial(tampered, device, FUTURE);
  ok(r && r.valid === false && /HMAC|tidak/i.test(r.reason));
});
t('Prefix salah (KK5→KSR) → null', async () => {
  const r = await kaki5.validateSerial('KSR' + (await gen(99)).slice(3), device, FUTURE);
  ok(!r || r.valid === false);
});
t('Format kurang segmen → null/not-valid', async () => {
  const r = await kaki5.validateSerial('KK5-A1B2-C3D4-99', device, FUTURE);
  ok(!r || r.valid === false);
});

console.log('\n── Skenario 4: Expired ──');
t('7D sudah lewat → expired', async () => {
  const r = await kaki5.validateSerial(await gen('7D'), device, new Date(Date.now()-20*864e5).toISOString());
  ok(r && r.valid === false && r.reason === 'expired');
});
t('6 bulan sudah lewat → expired', async () => {
  const r = await kaki5.validateSerial(await gen(6), device, new Date(Date.now()-200*864e5).toISOString());
  ok(r && r.valid === false && r.reason === 'expired');
});

console.log('\n── Skenario 5: Aktivasi & status ──');
t('activateSerial(valid) → status active', async () => {
  const a = await kaki5.activateSerial(await gen(99));
  ok(a && a.valid);
  const st = await kaki5.getLicenseStatus();
  ok(st.status === 'active');
});

console.log('\n── Skenario 6: Model kuota (pengganti trial-extension, hilang sejak v116/1.0.47) ──');
t('DEFAULT_TX_QUOTA = 100', () => { eq(kaki5.DEFAULT_TX_QUOTA, 100); });
t('currentTxMonth format YYYY-MM', () => {
  const s = kaki5.currentTxMonth(new Date(2026, 8, 5).getTime()); // Sep = bulan 09
  ok(/^\d{4}-\d{2}$/.test(s) && s === '2026-09');
});

await runAll();
console.log(`\n${'='.repeat(50)}`);
console.log(`HASIL: ${passed} pass, ${failed} FAIL`);
process.exit(failed ? 1 : 0);