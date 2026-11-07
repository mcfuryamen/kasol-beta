import { defineConfig } from 'astro/config';

// App terpisah untuk Program Mitra (referral & afiliasi).
// Deploy: project Vercel baru, rootDirectory `mitra/`, domain mitra.kasirsolo.com
// (lihat docs/ADR-VOUCHER-REFERRAL.md §12.8 opsi A).
//
// ── ENV SUPABASE (26/10/2026) ─────────────────────────────────────────────────
// Konektor Supabase di Vercel sync env ke project dengan nama:
//
//   SUPABASE_URL · SUPABASE_PUBLISHABLE_KEY · SUPABASE_ANON_KEY ·
//   SUPABASE_SECRET_KEY · SUPABASE_JWT_SECRET · POSTGRES_* · NEXT_PUBLIC_SUPABASE_*
//
// Vite HANYA meng-inline env berawalan `PUBLIC_` ke bundle browser. Jadi kode
// yang baca `import.meta.env.PUBLIC_SUPABASE_*` dapat kosong kalau project
// cuma pakai konektor (bukan env manual `PUBLIC_*`).
//
// Di sini URL + anon/publishable key diambil dari nama env mana pun yang
// tersedia, lalu di-expose ke bundle lewat `define` dengan nama custom.
// (Env lokal `.env` tetap kebaca lewat `import.meta.env.PUBLIC_*` di
// `src/lib/api.ts` — jadi build lokal nggak perlu `loadEnv` di sini.)
//
// PENTING — yang TIDAK PERNAH diambil: `SUPABASE_SECRET_KEY`,
// `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `POSTGRES_PASSWORD`, dan
// friends. Kredensial itu server-side; menyuntik `SUPABASE_` ke `envPrefix`
// Vite justru akan MEMBOCORKAN secret key ke bundle browser.
const env = process.env;

const supabaseUrl =
  env.PUBLIC_SUPABASE_URL || env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';

const supabaseAnon =
  env.PUBLIC_SUPABASE_ANON_KEY ||
  env.SUPABASE_ANON_KEY ||
  env.SUPABASE_PUBLISHABLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  '';

export default defineConfig({
  site: 'https://mitra.kasirsolo.com',
  server: { port: 13132 },
  vite: {
    define: {
      __MKS_SUPABASE_URL__: JSON.stringify(supabaseUrl),
      __MKS_SUPABASE_ANON_KEY__: JSON.stringify(supabaseAnon),
    },
  },
});
