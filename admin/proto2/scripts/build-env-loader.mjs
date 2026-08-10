// =========================================================================
// scripts/build-env-loader.mjs
// Menghasilkan js/env-loader.js dari environment Vercel (konektor Supabase).
// KEY TIDAK PERNAH DI-COMMIT — nilai asli hanya hadir pada OUTPUT build Vercel.
//
// Dipanggil oleh vercel.json -> buildCommand saat deploy.
// Fail-safe: kalau env belum tersedia (misal build lokal), file yang sudah ada
// TIDAK ditimpa dan proses tetap exit 0 supaya deploy tidak pernah gagal.
// =========================================================================
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, '..', 'js', 'env-loader.js');

// Nama var dari konektor Vercel+Supabase; fallback ke nama alternatif.
const url  = process.env.SUPABASE_URL || '';
const anon = process.env.SUPABASE_ANON_KEY || '';
const svc  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

if (!url) {
  console.log('[build-env-loader] SUPABASE_URL tidak ada di env — file dibiarkan apa adanya (deploy tidak gagal).');
  process.exit(0);
}

const content = `// GENERATED OTOMATIS oleh scripts/build-env-loader.mjs saat build Vercel.
// JANGAN edit manual — nilai diambil dari environment (konektor Supabase).
window.SUPABASE_URL = ${JSON.stringify(url)};
window.SUPABASE_ANON_KEY = ${JSON.stringify(anon)};
window.SUPABASE_SERVICE_KEY = ${JSON.stringify(svc)};
`;

writeFileSync(outPath, content);
console.log('[build-env-loader] env-loader.js ditulis (url=set, anon=' + (anon ? 'set' : 'KOSONG') + ', service=' + (svc ? 'set' : 'KOSONG') + ')');
process.exit(0);
