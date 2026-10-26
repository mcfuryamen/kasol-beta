# Changelog — Landing Page Kasir Solo

Semua perubahan dicatat per tanggal, versi terbaru di atas.

## [Unreleased] — 2026-08

### 🚀 Deploy
- **GitHub Actions tidak dipakai lagi** (semua `.github/workflows/*` dihapus). Deploy via **Vercel git integration (auto-detect)** — project `kasir-solo-landing`, Root Directory `landing/`.
- Dokumentasi setup-deploy diperbarui: hubungkan Git di Vercel (bukan konfigurasi workflow), env var via dashboard Vercel (bukan GitHub Secrets).

### 📝 Catatan
- Landing adalah halaman marketing single-file (static), belum punya PWA manifest/service worker (tidak wajib untuk halaman landing).
- Belum ada integrasi data ke Supabase pada `landing/index.html` saat ini.

---

## 2026-08-01 (Awal)
- Struktur awal landing page single-file dengan `vercel.json` (static, SPA fallback + security headers) dan `.vercelignore`.
