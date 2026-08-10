# kaki5 — Kasir Solo, Kaki Lima Edition

`kaki5` adalah **aplikasi kasir gratis untuk pedagang kaki lima (PKL)**, salah satu aplikasi klien dalam **ekosistem kasirsolo POS**.

## Ringkasan

| | |
|---|---|
| **Tujuan** | Catat jualan, pantau pengeluaran, lihat untung harian — dari HP. |
| **Arsitektur** | PWA SPA (frontend-only), data lokal di IndexedDB (Dexie.js). |
| **Offline** | Service Worker (`sw.js`) memberi dukungan offline penuh. |
| **Installable** | Bisa dipasang ke layar utama HP (manifest dinamis + prompt). |
| **Cetak** | Printer thermal Bluetooth (ESC/POS). |
| **Deploy** | Static ke Vercel via monorepo `kasol` (git integration, tanpa GitHub Actions). |

## Struktur

```
index.html          shell HTML (≈17.6KB, modular)
css/style.css       styling + skeleton loading
assets/icon.png     logo (1 file, 600×600)
js/                 21 modul (db, helpers, state, pos, laporan, backup, pwa, …)
dexie.min.js        Dexie 3.2.4 (lokal)
sw.js               Service Worker v2 (pre-cache offline)
vercel.json         konfigurasi deploy Vercel
docs/DEVELOPER.md   panduan teknis developer
README.md           dokumentasi umum & cara pakai
```

## Fitur inti
- Dashboard: omzet / pengeluaran / untung bersih / jumlah transaksi / porsi.
- POS: grid menu, pencarian & kategori, keranjang (persist ke localStorage), kembalian otomatis.
- Kelola menu (harga jual + modal/bahan).
- Catat pengeluaran per kategori.
- Laporan harian / mingguan / bulanan + grafik + navigasi periode yang benar.
- Backup & pulihkan data JSON (dengan validasi ketat).
- Printer Bluetooth + cetak nota.
- PWA: offline + install ke HP.

## Catatan penting
- **Data tersimpan lokal di perangkat** (bukan cloud) — pakai fitur backup untuk memindahkan data.
- Wajib diakses via HTTP/HTTPS (bukan `file://`) karena IndexedDB & Service Worker.
- Saat deploy: pastikan `dexie.min.js` punya pengecualian `!kaki5/dexie.min.js` di root `.gitignore` (aturan `*.min.js` global akan meng-ignore-nya dan mematikan app).

## Kontak
WhatsApp 0881-6566-935 · kasirsolo.app · PT Mesin Kasir Solo
