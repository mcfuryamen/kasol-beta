/**
 * Import wa_prospects → outreach_contacts — agent/import-wa-prospects.mjs
 * =============================================================================
 * Meleburkan prospek dingin hasil scrape Google Business (tabel wa_prospects,
 * diproduksi migoo) ke rak yang sama dengan klien lama, agar menikmati satu
 * alur outreach: meja review agent AI, follow-up otomatis, funnel, chip status.
 *
 * Pemetaan:
 *   nama_toko        → nama
 *   kategori (raw)   → kategori='Kuliner' (semua baris migoo kuliner); aslinya
 *                      disimpan di catatan utk personalisasi AI
 *   nomor_wa         → dinormalisasi digit; WAJIB /^628\d{8,12}$/ (pelajaran
 *                      impor CSV: prefix 6234 = landline Malang, bukan WA)
 *   wa_valid=true    → hanya ini yang diimpor
 *   status 'sent'    → 'terkirim' (memang sudah dikirimi cold WA via openwa)
 *   broadcast_count  → sent_count
 *   last_broadcast_at→ last_contact_at (dipakai ambang follow-up otomatis)
 *   kota             → source='prospek-<kota-slug>' — dimensi filter sumber
 *                      di modul Outreach (Klien Lama vs Prospek per kota)
 *   notes/kategori   → dirangkum ke catatan
 *
 * Idempotent: upsert on_conflict=nomor_wa resolution=ignore-duplicates —
 * jalankan ulang aman, baris eksisting (klien lama) TIDAK pernah ditimpa.
 *
 * PENGGUNAAN:
 *   node agent/import-wa-prospects.mjs            — impor nyata
 *   node agent/import-wa-prospects.mjs --dry-run  — simulasi + laporan
 *
 * ENV (.env.local di root repo): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── muat .env.local (pola sama dengan runner.mjs) ─────────────────────────────
try {
  const env = readFileSync(join(ROOT, '.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
} catch { /* .env.local opsional */ }

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('[impor] FATAL: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY kosong (.env.local)');
  process.exit(1);
}

const DRY = process.argv.includes('--dry-run');

async function sbFetch(path, { method = 'GET', body, prefer } = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(method === 'POST' ? { 'Prefer': prefer || 'return=representation' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`supabase_${res.status}: ${text.slice(0, 300)}`);
  return data;
}

/** Normalisasi sumber → label cantik utk filter UI */
const labelSumber = (s) =>
  s === 'klien_lama' ? 'Klien Lama'
  : s.startsWith('prospek-') ? 'Prospek ' + s.slice(8).replace(/^\w/, (c) => c.toUpperCase())
  : s || 'Tanpa sumber';

function tglSingkat(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '?' : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
}

async function main() {
  const prospek = await sbFetch('/rest/v1/wa_prospects?select=*');
  const eksisting = await sbFetch('/rest/v1/outreach_contacts?select=nomor_wa');
  const sudahAda = new Set(eksisting.map((o) => String(o.nomor_wa).replace(/\D/g, '')));

  const baris = [];
  let skipInvalid = 0, skipLandline = 0, skipDup = 0;
  for (const w of prospek) {
    const nomor = String(w.nomor_wa || '').replace(/\D/g, '');
    if (!w.wa_valid) { skipInvalid++; continue; }
    if (!/^628\d{8,12}$/.test(nomor)) { skipLandline++; continue; } // 6234 = landline, bukan WA
    if (sudahAda.has(nomor)) { skipDup++; continue; }
    baris.push({
      nomor_wa: nomor,
      nama: (w.nama_toko || 'Tanpa nama').trim(),
      kategori: 'Kuliner',
      alamat: (w.alamat || '').trim() || null,
      status: 'terkirim',
      sent_count: Number(w.broadcast_count) || 1,
      last_contact_at: w.last_broadcast_at || w.created_at || null,
      source: 'prospek-' + String(w.kota || 'lain').toLowerCase().trim(),
      catatan: `Kategori asli: ${w.kategori || '?'} · Prospek Google Business ${w.kota || ''} · cold WA ${tglSingkat(w.last_broadcast_at)}${w.notes ? ' · ' + w.notes : ''}`.trim(),
    });
  }

  console.log(`[impor] wa_prospects ${prospek.length} · layak: ${baris.length} · skip (invalid ${skipInvalid} / landline ${skipLandline} / duplikat ${skipDup})`);
  const perSumber = {};
  for (const b of baris) perSumber[b.source] = (perSumber[b.source] || 0) + 1;
  for (const [s, n] of Object.entries(perSumber).sort((a, b) => b[1] - a[1])) console.log(`  - ${labelSumber(s)}: ${n}`);
  if (DRY) { console.log('[impor] DRY-RUN — tidak menulis.'); return; }

  let n = 0;
  for (let i = 0; i < baris.length; i += 50) {
    const chunk = baris.slice(i, i + 50);
    await sbFetch('/rest/v1/outreach_contacts?on_conflict=nomor_wa', {
      method: 'POST',
      // ignore-duplicates: baris yang nomornya sudah ada (mis. rerun) dilewati,
      // klien lama TIDAK pernah ditimpa.
      prefer: 'resolution=ignore-duplicates,return=representation',
      body: chunk,
    });
    n += chunk.length;
  }
  console.log(`[impor] ${n} kontak prospek masuk outreach_contacts. Segarkan halaman Outreach di Control.`);
}

main().catch((e) => { console.error('[impor] FATAL:', e.message); process.exit(1); });
