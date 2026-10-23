// QA v168 — INVESTIGASI READ-ONLY tabrakan identitas V4 di tabel `clients`.
// Hanya SELECT (GET). Kunci layanan dibaca dari .env dan TIDAK PERNAH dicetak.
import { readFileSync } from 'node:fs';

function loadEnv(f) {
  const o = {};
  for (const l of readFileSync(f, 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) o[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return o;
}
const env = loadEnv('.env');
const URL0 = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL0 || !KEY) { console.log('TIDAK ADA KREDENSIAL di .env'); process.exit(1); }
console.log('target: ' + URL0.replace(/^https:\/\//, '') + ' (service key dibaca, tidak dicetak)');

async function q(select, filters) {
  const u = `${URL0}/rest/v1/clients?select=${encodeURIComponent(select)}${filters || ''}`;
  const r = await fetch(u, { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, Accept: 'application/json' } });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}
const mask = (s) => { const t = String(s || ''); return t.length <= 4 ? (t ? '•'.repeat(t.length) : '(kosong)') : t.slice(0, 3) + '•'.repeat(Math.max(0, t.length - 6)) + t.slice(-3); };

const OLD = 'K5-00ZZ-O9VD';

// 1) Baris perangkat user
const mine = await q('*', `&unit_id=eq.${OLD}`);
console.log('\n=== BARIS unit_id ' + OLD + ' ===');
if (!mine.length) { console.log('  TIDAK ADA BARIS'); }
mine.forEach((r) => {
  console.log('  app_type      : ' + r.app_type);
  console.log('  device_code   : ' + (r.device_code || '(null)'));
  console.log('  unit_id       : ' + r.unit_id);
  console.log('  install_id    : ' + (r.install_id || '(null)'));
  console.log('  nama_usaha    : ' + JSON.stringify(r.nama_usaha || ''));
  console.log('  no_whatsapp   : ' + mask(r.no_whatsapp));
  console.log('  browser/os    : ' + (r.browser || '?') + ' / ' + (r.os || '?'));
  console.log('  license_status: ' + (r.license_status || '(null)'));
  console.log('  last_seen     : ' + (r.last_seen || '(null)'));
});

// 2) Canonical yang dituju reanchor = 'K5-' + device_code V4 pada baris itu
const dc = mine[0] && mine[0].device_code;
const canonical = dc ? 'K5-' + dc : null;
console.log('\n=== CANONICAL V4 ===');
console.log('  device_code baris lama : ' + (dc || '(null)'));
console.log('  canonical            : ' + (canonical || '(tidak dapat dihitung)'));
console.log('  canonical == unit lama ? ' + (canonical === OLD));
if (canonical && canonical !== OLD) {
  const hit = await q('*', `&unit_id=eq.${encodeURIComponent(canonical)}`);
  console.log('  baris dengan unit_id canonical: ' + hit.length);
  hit.forEach((r) => {
    console.log('    app_type=' + r.app_type + ' | usaha=' + JSON.stringify(r.nama_usaha || '') +
      ' | wa=' + mask(r.no_whatsapp) + ' | install_id=' + String(r.install_id || '(null)').slice(0, 10) +
      ' | lic=' + (r.license_status || '(null)') + ' | ' + (r.browser || '?') + '/' + (r.os || '?') +
      ' | seen=' + (r.last_seen || '?'));
  });
}

// 3) Scan tabrakan menyeluruh untuk kaki5
const all = await q('unit_id,device_code,install_id,nama_usaha,no_whatsapp,app_type,license_status,browser,os,last_seen', '&app_type=eq.kaki5');
console.log('\n=== SCAN kaki5 (' + all.length + ' baris) ===');
const byUnit = new Map();
for (const r of all) {
  const k = String(r.unit_id || '');
  if (!byUnit.has(k)) byUnit.set(k, []);
  byUnit.get(k).push(r);
}
const profKey = (r) => (String(r.nama_usaha || '').trim().toLowerCase() + '||' + String(r.no_whatsapp || '').trim().toLowerCase());
const legacy = all.filter((r) => r.device_code && r.unit_id !== 'K5-' + r.device_code);
console.log('  baris LEGACY (unit_id != K5-device_code): ' + legacy.length);
let multiProfile = 0, multiRow = 0, wouldCollide = 0;
const report = [];
for (const [u, rows] of byUnit) {
  const profs = new Set(rows.map(profKey).filter((p) => p !== '||'));
  if (rows.length > 1) multiRow++;
  if (profs.size > 1) {
    multiProfile++;
    report.push({ u, n: rows.length, profs: [...profs].map((p) => p.split('||')[0] || '(tanpa nama)'), seen: rows.map((r) => r.last_seen).sort().slice(-1)[0] });
  }
}
// berapa baris legacy yang AKAN kena 409 (canonical-nya sudah ada + profil beda)
const unitSet = new Set(byUnit.keys());
for (const r of legacy) {
  const c = 'K5-' + r.device_code;
  if (unitSet.has(c)) {
    const other = byUnit.get(c);
    if (!other.some((o) => profKey(o) === profKey(r))) wouldCollide++;
  }
}
console.log('  unit_id dipakai >1 baris                : ' + multiRow);
console.log('  unit_id dengan >1 profil usaha BERBEDA : ' + multiProfile + '  <-- tabrakan lintas pengguna');
console.log('  baris legacy yang akan kena 409 tiap boot: ' + wouldCollide);
if (report.length) {
  console.log('\n  RINCIAN TABRAKAN LINTAS PENGGUNA:');
  report.sort((a, b) => b.n - a.n).slice(0, 12).forEach((x) => {
    console.log('    ' + x.u + '  baris=' + x.n + '  profil=' + JSON.stringify(x.profs.slice(0, 4)) + '  seen=' + (x.seen || '?'));
  });
}
