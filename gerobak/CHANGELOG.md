# Changelog

## [Unreleased] — 2026-08-07 (Deploy model)

### 🚀 Deploy
- **GitHub Actions tidak dipakai lagi** (semua `.github/workflows/*` dihapus). Deploy via **Vercel git integration (auto-detect)** — project `kasir-gerobak`, Root Directory `gerobak/`.
- Catatan: gerobak saat ini **tidak memakai Dexie** dan menggunakan `sw-gerobak.js` (penamaan berbeda dari app lain).

## [Unreleased]

### Added
- External CSS/JS files (performance optimization)
- manifest.json for PWA
- PWA icons (favicon, 192, 512)
- Cache-Control headers in vercel.json
- README.md documentation
- CHANGELOG.md

### Changed
- HTML size 522KB → 1.3KB (99.7% reduction)
- Total assets 522KB → 218KB (58% reduction)
- Service Worker v2 → v3 (precache new assets)
- Project structure: Single-file → Multi-file architecture

### Fixed
- Race condition pada simpan transaksi (anti-double-submit)
- Keranjang persist ke IndexedDB (tidak hilang saat refresh)
- XSS vulnerability (escapeHtml consistency)

### Removed
- Inline CSS (moved to css/style.css)
- Inline JavaScript (moved to js/app.js)
- Embedded Dexie.js (externalized to js/vendor/dexie.min.js)
- Base64 favicon (replaced with external files)

## [1.0.0] - 2026-07-30

### Added
- Initial release
- Menu & kategori management
- Transaksi POS dengan varian
- Kas harian (buka/tutup)
- Dashboard ringkasan
- Offline support (PWA)
- Service Worker v2

---

**Legend:**
- 🎉 **Added** - New features
- 🔄 **Changed** - Changes in existing functionality
- ⚠️ **Deprecated** - Soon-to-be removed features
- ❌ **Removed** - Removed features
- 🐛 **Fixed** - Bug fixes
- 🔐 **Security** - Security fixes
