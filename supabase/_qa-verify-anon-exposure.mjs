// QA read-only: uji eksposibilitas data via HTTP dengan anon key.
// Meniru skenario "tabel punya grant anon tapi RLS menolak" vs "policy longgar".
import fs from 'node:fs';
import path from 'node:path';

const root = 'C:\\Users\\Admin\\Documents\\kasol';
const env = fs.readFileSync(path.join(root, '.env.local'), 'utf8');
const get = (k) => {
  for (const line of env.split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith(k + '=')) continue;
    let v = t.slice(k.length + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!v) throw new Error('env ' + k + ' kosong');
    return v;
  }
  throw new Error('env ' + k + ' tidak ditemukan');
};
const URL_BASE = get('SUPABASE_URL');
const ANON = get('SUPABASE_ANON_KEY');

const tables = [
  'outlet_memberships', 'outlets', 'orders', 'order_items', 'profiles',
  'petty_cash', 'pos_products', 'loyalty_transactions', 'masjid_website',
  'wa_prospects', 'wa_broadcast_log', 'global_identities', 'licenses',
  'masjid_records', 'masjid_website_drafts', 'app_memberships'
];

const run = async () => {
  let expose = 0, denied = 0, empty = 0;
  for (const t of tables) {
    const res = await fetch(`${URL_BASE}/rest/v1/${t}?select=*&limit=5`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
    });
    let body = '';
    try { body = await res.text(); } catch {}
    let n = null;
    try { const j = JSON.parse(body); n = Array.isArray(j) ? j.length : null; } catch {}
    let verdict;
    if (res.status === 401 || res.status === 403) { verdict = 'DITOLAK (RLS/grant)'; denied++; }
    else if (res.status === 200 && n === 0) { verdict = '200 tapi 0 baris (RLS denies all)'; empty++; }
    else if (res.status === 200) { verdict = '!!! TERBUKA'; expose++; }
    else verdict = 'status ' + res.status;
    console.log(
      String(res.status).padEnd(4),
      t.padEnd(24),
      ('baris=' + (n === null ? '?' : n)).padEnd(12),
      verdict,
      body.slice(0, 120)
    );
  }
  console.log('\n=== RINGKASAN ===');
  console.log(`TERBUKA: ${expose} | DITOLAK: ${denied} | 200-kosong: ${empty}`);
};

run().catch((e) => { console.error('GAGAL', e); process.exit(1); });
