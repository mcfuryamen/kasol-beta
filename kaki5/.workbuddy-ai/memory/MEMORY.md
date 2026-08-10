# MEMORY — proyek kaki5 (Kasir Solo · Kaki Lima)

- **Bahasa komunikasi:** Indonesian (Bahasa Indonesia). Instruksi user: "gunakan komunikasi bahasa indonesia".
- **Aplikasi:** PWA SPA frontend-only (kasir offline PKL), data lokal IndexedDB via Dexie, tanpa backend. Monorepo `kasol`, deploy ke Vercel via GitHub Actions (path filter per-app).
- **Pitfall deploy kritis:** root `kasol/.gitignore` punya `*.min.js` yang meng-ignore `kaki5/dexie.min.js` — harus ada pengecualian `!kaki5/dexie.min.js` atau app mati di produksi (Dexie undefined).
- **Testing:** `node test_validate.js` (validateBackup) & `node test_pos.js` (generatePresetNominal). Style: ekstrak fungsi murni via regex dari source agar jalan di Node tanpa Dexie/DOM.
- **Keamanan:** `.env.local` pernah berisi Supabase service_role key (gitignored, tdk dipakai frontend) — sebaiknya hanya di sisi server.
