// =========================================================================
// scripts/build-env-loader.mjs
// Menghasilkan js/env-loader.js dari environment Vercel (konektor Supabase).
// KEY TIDAK PERNAH DI-COMMIT — nilai asli hanya hadir pada OUTPUT build Vercel.
//
// Dipanggil oleh vercel.json -> buildCommand saat deploy.
// Fail-safe: kalau env belum tersedia (misal build lokal), file yang sudah ada
// TIDAK ditimpa dan proses tetap exit 0 supaya deploy tidak pernah gagal.
//
// SECURITY (Phase A): SERVICE_ROLE_KEY TIDAK PERNAH ditulis ke client.
// Semua operasi Supabase lewat Vercel Serverless Proxy /api/rest (lihat api/rest.js).
// Yang ditulis ke client hanya: URL, anon key (publik), dan ADMIN_API_KEY (gate
// sementara proxy, bukan master key database).
// =========================================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, '..', 'js', 'env-loader.js');

// =========================================================================
// Loader env lokal: kalau process.env kosong (mis. `python -m http.server`
// lokal, tanpa Vercel CLI), baca admin/.env.local sebagai fallback.
// .env.local TIDAK pernah di-commit (gitignore) — aman untuk nilai anon key.
// SERVICE_ROLE_KEY tetap TIDAK ditulis ke client di bagian bawah.
// =========================================================================
function loadEnvLocal() {
  const envPath = join(__dirname, '..', '.env.local');
  try {
    const raw = readFileSync(envPath, 'utf8');
    const out = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      // Lepas tanda kutip (single/double) termasuk spasi dalam quote.
      if (val.length >= 2) {
        const first = val[0];
        const last = val[val.length - 1];
        if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
          val = val.slice(1, -1);
        }
      }
      out[key] = val;
    }
    return out;
  } catch {
    return {};
  }
}

// Nama var dari konektor Vercel+Supabase; fallback ke nama alternatif.
// Prioritas: process.env (Vercel build) → .env.local (dev lokal / server 8082).
const envLocal = loadEnvLocal();
const pick = (name) => process.env[name] || envLocal[name] || '';
const url  = pick('SUPABASE_URL');
const anon = pick('SUPABASE_ANON_KEY');
const adminKey = pick('ADMIN_API_KEY');

if (!url) {
  console.log('[build-env-loader] SUPABASE_URL tidak ada di env — file dibiarkan apa adanya (deploy tidak gagal).');
  process.exit(0);
}

const content = `// GENERATED OTOMATIS oleh scripts/build-env-loader.mjs saat build Vercel.
// JANGAN edit manual — nilai diambil dari environment (konektor Supabase).
// CATATAN KEAMANAN: SUPABASE_SERVICE_KEY tidak pernah ditulis ke client.
// Service key hanya hidup server-side di Vercel Serverless /api/rest.
window.SUPABASE_URL = ${JSON.stringify(url)};
window.SUPABASE_ANON_KEY = ${JSON.stringify(anon)};
window.SUPABASE_ADMIN_KEY = ${JSON.stringify(adminKey)};
`;

writeFileSync(outPath, content);
console.log('[build-env-loader] env-loader.js ditulis (url=set, anon=' + (anon ? 'set' : 'KOSONG') + ', adminGate=' + (adminKey ? 'set' : 'KOSONG') + ')');
process.exit(0);
