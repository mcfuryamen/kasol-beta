// QA v168 — lanskap penuh baris `clients` app_type=kaki5 (read-only).
import { readFileSync } from 'node:fs';
function loadEnv(f) { const o = {}; for (const l of readFileSync(f, 'utf8').split('\n')) { const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/); if (m) o[m[1]] = m[2].trim().replace(/^["']|["']$/g, ''); } return o; }
const env = loadEnv('.env');
const URL0 = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const r = await fetch(`${URL0}/rest/v1/clients?select=*&app_type=eq.kaki5&order=created_at.asc`, { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, Accept: 'application/json' } });
if (!r.ok) { console.log('HTTP ' + r.status); process.exit(1); }
const rows = await r.json();
console.log('kolom tersedia: ' + Object.keys(rows[0] || {}).join(', '));
console.log('\n=== ' + rows.length + ' BARIS kaki5 ===');
const mask = (s) => { const t = String(s || ''); return t.length <= 4 ? (t ? '•'.repeat(t.length) : '-') : t.slice(0, 3) + '•'.repeat(Math.max(0, t.length - 6)) + t.slice(-3); };
for (const x of rows) {
  const canonicalShape = x.device_code && x.unit_id === 'K5-' + x.device_code;
  console.log('  ' + String(x.unit_id).padEnd(15) + ' dc=' + String(x.device_code || '-').padEnd(10) +
    ' inst=' + String(x.install_id || '-').padEnd(15) +
    ' usaha=' + JSON.stringify(x.nama_usaha || '').padEnd(22) +
    ' wa=' + mask(x.no_whatsapp).padEnd(16) +
    ' ' + String(x.browser || '?') + '/' + String(x.os || '?'));
  console.log('      bentuk=' + (canonicalShape ? 'V4-kanonik' : 'LEGACY (unit != K5-dc)') +
    ' | lic=' + (x.license_status || '-') +
    ' | created=' + String(x.created_at || '-').slice(0, 19) +
    ' | seen=' + String(x.last_seen || '-').slice(0, 19) +
    ' | user_id=' + (x.user_id ? String(x.user_id).slice(0, 8) + '…' : 'NULL'));
}
// pasangan device_code yang sama di baris berbeda
const byDc = new Map();
for (const x of rows) { const k = String(x.device_code || ''); if (!k) continue; if (!byDc.has(k)) byDc.set(k, []); byDc.get(k).push(x); }
console.log('\n=== device_code yang dipakai >1 baris ===');
let n = 0;
for (const [dc, g] of byDc) if (g.length > 1) { n++; console.log('  ' + dc + ' -> ' + g.map((x) => x.unit_id + ' (inst ' + String(x.install_id).slice(0, 8) + ', usaha ' + JSON.stringify(x.nama_usaha || '') + ')').join('  ||  ')); }
if (!n) console.log('  (tidak ada)');
