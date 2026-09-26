# 08 — Setup Meta (sekali jalan, ±45 menit)

> Ini checklist klik-per-klik buat nyambungin **agent otonom posting FB Page + IG**.
> Semua yang lo kerjain di sini pakai **akun lo sendiri** — gak ada yang kirim password/token ke mana-mana.
> Yang agent (Mavis) kerjain otomatis: posting terjadwal, baca + balas komen (mode hibrida), log lead.
>
> Status lo (2026-09-12): **Page udah ada** (`facebook.com/mesinkasirsolo`), **IG udah ada 2**
> (`@kasirsolo`, `@mesinkasir_solo`). Jadi langkah 1 tinggal cek, bukan bikin.

## Yang bakal diotomatisasi setelah setup

| Fitur | Status |
|---|---|
| Posting FB Page terjadwal (09:00 / 12:30 / 19:00 WIB) | ✅ otomatis |
| Posting IG (jika post ada gambar + IG ter-link) | ✅ otomatis |
| Baca komen baru di post sendiri (FB + IG) | ✅ otomatis, 3x/hari |
| Balas komen "sinyal minat" (harga?, minat, KASIR) | ✅ auto, template sopan |
| Balas komen negosiasi ("murah", "promo", "bayar") | 🟡 draft → lo approve |
| Komen negatif / spam | 🚩 dicatat, gak dibalas, dilaporkan |
| Log lead ke `agent/leads.jsonl` | ✅ otomatis |
| Komentar di postingan ORANG LAIN (outreach) | ❌ tetap manual (kit 05/07) — otomasi = banned |

**Ramp-up (anti-flag akun):** minggu 1 posting **1x/hari (19:00 saja)** → minggu 2 tambah 09:00 → minggu 3 penuh 3x/hari. Mavis ingatkan sendiri tiap naik level (cron reminder).

---

## Langkah 1 — Cek & rapikan Page `mesinkasirsolo` (±10 menit)

Buka **https://www.facebook.com/mesinkasirsolo**, pastikan:

1. **Nama** kebaca jelas (contoh "Mesin Kasir Solo"). `activate.mjs` mem-pick Page otomatis dengan mencocokkan nama yang mengandung "kasir solo" / "mesin kasir" — kalau nama Page-nya aneh-aneh, tinggal kasih `page_id` manual di langkah 6.
2. **Kategori**: Software (atau Shopping & Retail) — di Page → Edit Page.
3. **Bio** (update kalau masih kosong):
   > Aplikasi kasir HP buat PKL & usaha kecil. Sekali bayar, offline aman. Coba gratis 👉 kaki5.kasirsolo.com
4. **Link website** di kolom About/Intro: `https://kaki5.kasirsolo.com` — salin persis dari `config.json` agent (field `urlUtama`).
5. Foto cover & profile: screenshot app (kit 04) atau foto warung — gak harus sempurna.

## Langkah 2 — Pilih 1 IG → Business → link ke Page (±10 menit)

Lo punya 2 IG: **@kasirsolo** dan **@mesinkasir_solo**.
**Satu Page cuma bisa di-link ke SATU IG** — pilih satu yang mau dipakai agent buat posting otomatis.
Yang satunya tetap bisa lo pakai manual (nggak keotomasi, gak ganggu).

1. Buka IG yang dipilih → profile → menu ☰ → **Akun dan tipe / Switch to Professional Account**
2. Pilih **Business** → lanjut sampai selesai
3. Akan diminta **hubungkan ke Facebook Page** → pilih Page **mesinkasirsolo**
4. (Opsional) Nyalakan auto-share FB → IG kalau ada di pengaturan — kalau gak ada, gak apa-apa, API yang handle.

## Langkah 3 — Bikin app di Meta Developer (±10 menit)

1. Buka `developers.facebook.com` → login dengan akun FB yang **admin dari Page mesinkasirsolo** → **My Apps → Create App**
2. Type: **Business** → nama: `Kasir Solo Bot` → Create
3. Di dashboard app → **Add products** → pasang dua:
   - **Facebook Login**
   - **Instagram Graph API** (kalau diminta pilih IG → pilih IG yang di-link ke Page)
4. Buka **App settings → Basic** → catat **App ID** dan **App Secret** (klik "Show").

## Langkah 4 — Tempel App ID & Secret ke `.secure.env` (±2 menit)

Buka file `kasol/.secure.env` (editor biasa) — di bawah udah ada template:

```
FB_APP_ID=isi_dengan_App_ID
FB_APP_SECRET=isi_dengan_App_Secret
```

> File ini **sudah di-.gitignore** (tidak akan pernah commit). Jangan kirim isinya ke chat / screenshot orang lain.

## Langkah 5 — Ambil OAuth code (±5 menit)

Buka browser, tempel URL ini **dengan APP_ID lo** (ganti `APP_ID`):

```
https://www.facebook.com/v23.0/dialog/oauth?client_id=APP_ID&redirect_uri=http%3A%2F%2Flocalhost%2Fcallback&scope=pages_show_list%2Cpages_manage_posts%2Cpages_read_engagement%2Cpages_read_user_content%2Cinstagram_basic&response_type=code
```

1. Login FB kalau diminta → **Allow** semua izin (5 izin itu emang yang dibutuhkan agent)
2. Browser melompat ke `http://localhost/callback?code=...` → **halaman error "tidak bisa dibuka" itu NORMAL**
3. **Salin value `code=` dari URL di address bar** (panjang ±200 karakter)
4. ⚠️ **Code cuma hidup ±1 menit** — langsung lanjut langkah 6

## Langkah 6 — Jalankan activate (±1 menit)

Di terminal (PowerShell), dari folder `kasol`:

```
node marketing-kit/agent/activate.mjs CODE_LO
```

Script akan: tukar code → dapat page token → simpan `FB_PAGE_ID` + `FB_PAGE_TOKEN` + `IG_BUSINESS_ACCOUNT_ID` ke `.secure.env` otomatis.
Kalau lo punya beberapa Page dan yang ketemu bukan `mesinkasirsolo`, script bakal list semua Page — ambil ID yang benar lalu:

```
node marketing-kit/agent/activate.mjs CODE_BARU  PAGE_ID
```

> Gak ada output `IG_BUSINESS_ACCOUNT_ID`? IC itu belum ke-link. Link dulu (langkah 2), lalu:
> `node marketing-kit/agent/activate.mjs --ig`

## Langkah 7 — Tes (±2 menit)

```
node marketing-kit/agent/run.mjs --status     # harusnya: TOKEN: OK
node marketing-kit/agent/run.mjs              # tes penuh (normal kalau "DIEM")
```

- Kalau keluar `POSTED: 19:00 → fb:xxxx` = **sukses total**, cek di Page mesinkasirsolo.
- Kalau `DIEM` = belum jamnya atau konten belum mulai (lihat `config.json` → `tanggalMulai`).
- Kalau ada `ERROR POST: ...` → lihat tabel troubleshooting di bawah.

**Terakhir: bilang ke Mavis "token masuk" → Mavis nyalain cron 3x/hari-nya. Selesai.**

---

## Setelah setup — cara kerja harian

| Jam (WIB) | Agent jalan | Lo perlu |
|---|---|---|
| 09:00 / 12:30 / 19:00 | Cek queue konten → post yang waktunya; poll komen baru → auto-reply / draft | **0 menit** (kecuali ada draft) |
| Kapan aja | — | Ada draft negosiasi? Balas "approve draft D-x" (atau "tolak D-x") |
| Tiap Minggu | — | Kirim angka mingguan → kit minggu 2 |

**File agent** (semua di `marketing-kit/agent/`):

| File | Isi |
|---|---|
| `config.json` | Slot aktif (ramp-up), URL, template auto-reply, CTA WA |
| `content.json` | 14 hari × 3 slot caption siap post |
| `run.mjs` | Runner utama (dipanggil cron) |
| `activate.mjs` | Tukar OAuth code → token (sekali jalan) |
| `send-draft.mjs` | Approve / edit / tolak draft balasan |
| `kw.mjs` | Generator deep link riset kata kunci |
| `state.json` | (dibuat otomatis) status post + komen yang sudah dilihat |
| `drafts.json` | (dibuat otomatis) draft balasan menunggu approve |
| `leads.jsonl` | (dibuat otomatis) log lead — pindahkan ke kanban `clients` di Control Center |

## Umur token

- **Page token gak pernah kedaluwarsa** selama: password FB gak diganti, app-nya gak dihapus, dan lo gak cabut izin.
- Yang mematikan token: ganti password FB, hapus app di Meta Developer, atau revoke izin di *Settings → Apps and Websites*.
- Kalau suatu saat post tiba-tiba error → kemungkinan token mati → ulang langkah 5–7 (±10 menit).
- Cek kapan aja: `node marketing-kit/agent/run.mjs --status`

## Troubleshooting

| Gejala | Penyebab & solusi |
|---|---|
| `FB error [200]` saat activate | App ID/Secret salah, atau code kedaluwarsa → ulangi langkah 5 dengan code baru |
| `FB error [190]` saat post | Token gak punya izin `pages_manage_posts` → ulangi OAuth (langkah 5) dan pastikan semua izin di-allow |
| `Page tidak ketemu` di activate | Lo punya banyak Page → pakai `activate.mjs CODE PAGE_ID` (ID-nya diliat dari daftar di error) |
| `IG: belum ter-link` | Langkah 2 belum selesai → link IG ke Page, lalu `activate.mjs --ig` |
| `DIEM` terus padahal sudah jamnya | Cek `config.json`: `slotsAktif` harus memuat jam itu, dan `tanggalMulai` harus ≤ hari ini |
| Komen gak dibalas | Agent cuma poll 3x/hari (saat jam posting) — komen di luar jam itu kebalasan di run berikutnya |
| Post ditolak / limit | Akun baru kena limit Meta (jarang di 3 post/hari) → tunggu 24 jam, jangan di-force |

## Keamanan — aturan main

1. `.secure.env` **tidak pernah di-commit** (sudah di-.gitignore).
2. Token **hanya lo yang ketik** ke file itu — Mavis tidak pernah minta password/token via chat.
3. App di Meta Developer boleh di mode **Development** — gak perlu lolos review, karena yang dipakai hanya akun lo sendiri.
4. Kalau ganti perangkat / ganti browser → gak masalah, token tetap jalan (tersimpan di file, bukan di browser).
