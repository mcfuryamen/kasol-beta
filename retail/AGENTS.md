# AGENTS — Kasir Retail

Konteks spesifik untuk aplikasi **Kasir Retail** (toko retail, minimarket, warung).
Selalu baca [`../CONTEXT.md`](../CONTEXT.md) untuk standar ekosistem.

---

## 📋 Info Aplikasi

| Item | Value |
|------|-------|
| **Folder** | `retail/` |
| **Prefix** | `KRT` |
| **Salt** | `KASIRSOLO-RETAIL-2026` |
| **Database** | `KasirSoloRetailDB` |
| **Vercel Project** | `kasir-retail` |
| **Target User** | Pemilik toko retail, minimarket, warung, UMKM |

---

## 🎯 Referensi

Ikuti standar di [`../CONTEXT.md`](../CONTEXT.md).
Gunakan `rosok.zip` sebagai referensi pola arsitektur (single HTML, Dexie inline, license module, layout topbar+bottomnav+sheet).

---

## 🗂️ Struktur File (Existing)

```
retail/
├── index.html          # Single HTML app
├── style.css           # CSS eksternal
├── dexie.min.js        # Library eksternal
├── manifest.json
├── sw.js               # Service Worker
├── vercel.json
├── .vercelignore
├── logo.png
├── icon-192.png
├── icon-512.png
├── favicon-16.png
├── favicon-32.png
├── splash-1028.png
├── openBarcodeFix.js   # Fix barcode scanner di mobile
├── package.json        # Ada (berbeda dengan rosok)
├── README.md
├── CHANGELOG.md
└── AUDIT_REPORT.md
```

---

## 🔐 License

- **Prefix:** `KRT`
- **Format serial:** `KRT-XXXX-XXXX-XX-XXXXXX`
- **Trial:** 7 hari
- **Validasi:** Check saat app load

---

## 🎨 Design

- **Theme:** Orange-brown (sesuai brand KASIRSOLO)
- **Fitur unik:** Barcode scanning, manajemen stok (auto-kurang saat jual), laporan penjualan
- **Hardware:** Support barcode scanner via USB/Bluetooth

---

*AGENTS.md — Kasir Retail*
