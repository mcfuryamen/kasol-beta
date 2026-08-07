# AGENTS — Kasir Gerobak

Konteks spesifik untuk aplikasi **Kasir Gerobak** (angkringan, cilok, es cendol, dll).
Selalu baca [`../CONTEXT.md`](../CONTEXT.md) untuk standar ekosistem.

---

## 📋 Info Aplikasi

| Item | Value |
|------|-------|
| **Folder** | `gerobak/` |
| **Prefix** | `KSG` |
| **Salt** | `KSG_GEROBAK_2025_MESINKASIR_SOLO_SALT_M3F7` |
| **Database** | `KasirSoloGerobakDB` |
| **Vercel Project** | `kasir-gerobak` |
| **Target User** | Pedagang gerobak, angkringan, cilok, es cendol, makanan/minuman mobile |

---

## 🎯 Referensi

Ikuti standar di [`../CONTEXT.md`](../CONTEXT.md).
Gunakan `rosok.zip` sebagai referensi pola arsitektur (single HTML, Dexie inline, license module).

---

## 🗂️ Struktur File (Existing)

```
gerobak/
├── index.html          # Single HTML app
├── css/style.css       # CSS terpisah (berbeda dengan rosok yang inline)
├── js/app.js           # IIFE pattern (bukan ES modules)
├── js/vendor/dexie.min.js
├── manifest.json
├── sw-gerobak.js       # Service Worker
├── vercel.json
├── .vercelignore
└── assets/
    ├── logo.png
    ├── icon-192.png
    ├── icon-512.png
    ├── favicon-16.png
    └── favicon-32.png
```

> **Catatan:** Gerobak menggunakan pola IIFE (`(function(){...})()`) bukan ES modules.
> Untuk aplikasi baru, ikuti pola rosok.zip (ES modules / single script block).

---

## 🔐 License

- **Prefix:** `KSG`
- **Format serial:** `KSG-XXXX-XXXX-XX-XXXXXX`
- **Trial:** 7 hari
- **Hash:** Menggunakan djb2 + sdbm (berbeda dengan Rosok yang pakai simpleHash)
- **Validasi:** Dipanggil saat app load

---

## 🎨 Design

- **Theme color:** `#FF7A1A` (orange)
- **Layout:** Mobile-first, single column
- **Fitur unik:** Menu management, share nota via WhatsApp, rekap kas harian

---

*AGENTS.md — Kasir Gerobak*
