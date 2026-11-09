# Grow Up — Penggabungan Halaman Sosmed + Kalender Konten (App Control)

Tanggal: 2026-10-28 · Permintaan owner: McFury ("buat menu baru di navigasi utama
dengan nama Grow Up, lalu pindahkan halaman sosmed dan kalender konten ke dalamnya")
Status: selesai + smoke lulus (belum di-commit, nunggu perintah owner).

## 1. Hasil

Menu baru **🚀 Grow Up** di sidebar utama (posisi setelah CRM, sebelum Agent).
Isinya 2 tab, pola yang sama dengan merge CRM (markup dipindah utuh, ID element
tidak berubah):

```
#screen-growup  (satu section, sidebar utama)
├─ content-tabs #growupTabs: [Sosmed] [Kalender Konten]
│   ├─ Sosmed          = isi #screen-social lama utuh (antrian posting Facebook)
│   └─ Kalender Konten = isi #screen-kalender lama utuh (rencana posting manual)
└─ nav: sidebar `data-screen="growup"`; bottom-nav mobile menu langsung (6 item);
        deep-link #growup?tab=social|kalender; legacy #social & #kalender diarahkan
```

- Tombol sidebar **Sosmed** & **Kalender** dihapus. Bottom-nav mobile jadi 6 item:
  Dashboard | Katalog | CRM | CMS | Grow Up | Lainnya (28 Okt, permintaan owner) —
  Grow Up & CMS (Konten Web) naik jadi menu langsung, keluar dari `SECONDARY_SCREENS`
  dan dari sheet "Lainnya" (sheet tinggal Agent AI + Pengaturan).
- `PAGE_META.growup` baru (judul "Grow Up"); entri `social`/`kalender` dihapus.
- `SECONDARY_SCREENS`: `social`, `kalender` → `growup` (tombol kembali mobile +
  tab "Lainnya" menyala benar).
- Refresh tombol ⟳ topbar: screen `growup` = refresh kedua tab sekaligus
  (`window.refreshSocial` + `window.refreshKalender`).
- Muat data per screen: listener `screen:change` di `sosmed.js` & `kalender.js`
  ganti dari screen lama ke `'growup'` (pola yang sama dengan modul CRM).

## 2. Titik perubahan (7 file)

| File | Perubahan |
|---|---|
| `control/index.html` | Sidebar: hapus Sosmed+Kalender → tambah Grow Up; markup 2 screen lama dipindah utuh ke panel `#growupViewSocial`/`#growupViewKalender` dalam `#screen-growup` + tabs; sheet Lainnya: 2 item → 1 item Grow Up |
| `control/js/growup.js` | **Baru** — shell tab (`setGrowupTab` + `initGrowup`, pola crm.js) |
| `control/js/navigation.js` | Redirect legacy `switchScreen('social'|'kalender')` → Grow Up (semua pemanggil lama otomatis, termasuk `openKalender`); deep-link `#growup?tab=…`; `SECONDARY_SCREENS` + `PAGE_META` |
| `control/js/app.js` | import + `initGrowup()`; refresh map `growup` = 2 tab |
| `control/js/sosmed.js` | listener `screen:change` `'social'` → `'growup'`; ekspos `window.refreshSocial` |
| `control/js/kalender.js` | listener `'kalender'` → `'growup'`; ekspos `window.refreshKalender`; `openKalender` tetap jalan via redirect |

Isi modul (logika sosmed & kalender) **tidak diubah** — hanya lokasi + wiring.

## 3. Smoke (28 Okt, semua lulus)

- Reload dengan hash `#growup?tab=kalender` → tab Kalender aktif, kalender render
  penuh (grid bulan, chips Jadwal/Bank Materi, tombol aksi).
- Klik tab Sosmed → panel antrian posting render (toolbar 4 tombol + chips
  filter status), URL `#growup?tab=social`.
- Deep-link legacy full-load: `#kalender` → `#growup?tab=kalender`,
  `#social` → `#growup?tab=social`.
- Sidebar (cek DOM): Grow Up aktif `aria-current="page"`, tanpa Sosmed/Kalender.
- Sidebar elemen "Sosmed" tinggal 1 di halaman (tab Grow Up-nya).
- Console: 0 error, 0 warning. `node --check` 5 file JS: lolos.

## 4. Yang tidak disentuh

Logika sosmed.js/kalender.js (endpoint, RPC, sheet edit/koneksi FB/rencana),
skema DB, modul lain, port dev server.
