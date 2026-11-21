// QA v168 — bandingkan dua baris satu perangkat (read-only).
import { readFileSync } from 'node:fs';
function loadEnv(f) { const o = {}; for (const l of readFileSync(f, 'utf8').split('\n')) { const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/); if (m) o[m[1]] = m[2].trim().replace(/^["']|["']$/g, ''); } return o; }
const env = loadEnv('.env');
const U = env.SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY;
const cols = 'unit_id,install_id,user_id,nama_usaha,nama_pemilik,no_whatsapp,email,status,source,lead_source,license_status,license_serial,tx_month,tx_used,tx_adjust,first_seen,last_seen,created_at,updated_at,restored_at,provinsi,kabkota,alamat_detail';
const r = await fetch(`${U}/rest/v1/clients?select=${encodeURIComponent(cols)}&unit_id=in.(K5-00ZZ-O9VD,K5-00GC-QFOT)&app_type=eq.kaki5`, { headers: { apikey: K, Authorization: 'Bearer ' + K } });
const rows = await r.json();
const mask = (s) => { const t = String(s ?? ''); if (!t) return '(kosong)'; return t.length <= 4 ? '•'.repeat(t.length) : t.slice(0, 3) + '•'.repeat(Math.max(0, t.length - 6)) + t.slice(-3); };
const A = rows.find((x) => x.unit_id === 'K5-00ZZ-O9VD');
const B = rows.find((x) => x.unit_id === 'K5-00GC-QFOT');
const fields = [
  ['install_id', (x) => x.install_id],
  ['user_id (auth)', (x) => (x.user_id ? String(x.user_id).slice(0, 8) + '…' : 'NULL')],
  ['nama_usaha', (x) => JSON.stringify(x.nama_usaha || '')],
  ['nama_pemilik', (x) => JSON.stringify(x.nama_pemilik || '')],
  ['no_whatsapp', (x) => mask(x.no_whatsapp)],
  ['email', (x) => mask(x.email)],
  ['provinsi/kabkota', (x) => (x.provinsi || '-') + ' / ' + (x.kabkota || '-')],
  ['alamat_detail', (x) => JSON.stringify(x.alamat_detail || '')],
  ['status / source', (x) => (x.status || '-') + ' / ' + (x.source || '-')],
  ['license_status', (x) => x.license_status || '(null)'],
  ['license_serial', (x) => x.license_serial || '(null)'],
  ['tx_month', (x) => x.tx_month || '(null)'],
  ['tx_used', (x) => String(x.tx_used)],
  ['tx_adjust', (x) => String(x.tx_adjust)],
  ['first_seen', (x) => x.first_seen],
  ['last_seen', (x) => x.last_seen],
  ['created_at', (x) => x.created_at],
  ['updated_at', (x) => x.updated_at],
];
const w = 22;
console.log('field'.padEnd(w) + '| LEGACY K5-00ZZ-O9VD'.padEnd(40) + '| KANONIK K5-00GC-QFOT');
console.log('-'.repeat(w) + '+' + '-'.repeat(40) + '+' + '-'.repeat(28));
for (const [n, f] of fields) {
  console.log(n.padEnd(w) + '| ' + String(f(A ?? {})).padEnd(38) + '| ' + String(f(B ?? {})));
}
const sama = fields.filter(([n]) => n !== 'install_id' && n !== 'user_id (auth)' && n !== 'first_seen' && n !== 'last_seen' && n !== 'created_at' && n !== 'updated_at')
  .filter(([, f]) => String(f(A ?? {})) !== String(f(B ?? {}))).map(([n]) => n);
console.log('\nperbedaan bermakna: ' + (sama.length ? sama.join(', ') : '(tidak ada)'));
