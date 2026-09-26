// =========================================================================
// scripts/build-env-loader.mjs
// Menghasilkan js/env-loader.js dari environment Vercel (konektor Supabase).
// KEY TIDAK PERNAH DI-COMMIT — nilai asli hanya hadir pada OUTPUT build Vercel.
//
// SECURITY (fix audit 2026-08-23):
//   ADMIN_API_KEY TIDAK PERNAH ditulis ke client (browser). Sebelumnya
//   diekspos sebagai window.SUPABASE_ADMIN_KEY dan dikirim via header
//   x-admin-key — siapa pun di DevTools bisa mencurinya.
//
//   Sekarang: server derivasi session token pendek (time-limited, 24 jam)
//   menggunakan HMAC-SHA256(ADMIN_API_KEY, nonce + timestamp) dan hanya
//   token yang di-write ke client sebagai `window.SUPABASE_SESSION_KEY`.
//   ADMIN_API_KEY hidup server-only (api/_gate.js, api/token.js).
//
//   Browser panggil GET /api/token untuk refresh token saat expired.
// =========================================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, '..', 'js', 'env-loader.js');

// ── Load .env.local sebagai fallback (dev lokal / server 8082) ───────────────
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
      if (val.length >= 2) {
        const first = val[0], last = val[val.length - 1];
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

// ── Derivation: adminKey → session token pendek (base64url, time-limited) ─────
const envLocal = loadEnvLocal();
const pick = (name) => process.env[name] || envLocal[name] || '';
const url  = pick('SUPABASE_URL');
const anon = pick('SUPABASE_ANON_KEY');
const adminKey = pick('ADMIN_API_KEY');

if (!url) {
  const sentinel = `// BUILD FAILED: SUPABASE_URL env tidak terpasang di Vercel.\n// Cek Dashboard > Settings > Environment Variables.\nwindow.SUPABASE_URL = '';\nwindow.SUPABASE_ANON_KEY = '';\nwindow.SUPABASE_SESSION_KEY = '';\n`;
  writeFileSync(outPath, sentinel);
  console.error('[build-env-loader] SUPABASE_URL kosong — sentinel ditulis. GAGAL DEPLOY.');
  process.exit(1);
}

/**
 * Derivasi session token dari ADMIN_API_KEY menggunakan HMAC-SHA256.
 * Token kadaluarsa 24 jam sejak waktu build. Client refresh lewat GET /api/token.
 * adminKey TIDAK PERNAH ditulis ke file output.
 */
function deriveSessionKey(key, ttlMs = 24 * 60 * 60 * 1000) {
  const iat  = Date.now();
  const exp  = iat + ttlMs;
  const payload = JSON.stringify({ n: 'kasirsolo-session-v1', iat, exp });
  const sig  = createHmac('sha256', key).update(payload).digest('base64url');
  return Buffer.from(JSON.stringify({ n: 'kasirsolo-session-v1', iat, exp, t: sig })).toString('base64url');
}

const sessionKey = adminKey ? deriveSessionKey(adminKey) : '';
const anonSafe  = anon || '';

const content = `// GENERATED OTOMATIS oleh scripts/build-env-loader.mjs saat build Vercel.
// JANGAN edit manual — nilai diambil dari environment (konektor Supabase).
//
// KEAMANAN:
//   - SUPABASE_SERVICE_ROLE_KEY TIDAK PERNAH ditulis ke client (server-only).
//   - ADMIN_API_KEY TIDAK PERNAH ditulis ke client.
//   - Yang ditulis: SUPABASE_URL (publik), SUPABASE_ANON_KEY (publik, RLS aktif),
//     SUPABASE_SESSION_KEY (time-limited, derivasi dari ADMIN_API_KEY via HMAC,
//     kadaluarsa 24 jam; refresh otomatis via GET /api/token).
// =============================================================================
window.SUPABASE_URL = ${JSON.stringify(url)};
window.SUPABASE_ANON_KEY = ${JSON.stringify(anonSafe)};
window.SUPABASE_SESSION_KEY = ${JSON.stringify(sessionKey)};
`;

writeFileSync(outPath, content);
console.log(
  '[build-env-loader] env-loader.js ditulis ' +
  `(url=set, anon=${anon ? 'set' : 'KOSONG'}, ` +
  `sessionKey=${adminKey ? 'set (24h)' : 'KOSONG (ADMIN_API_KEY belum di-set)'})`
);
process.exit(0);