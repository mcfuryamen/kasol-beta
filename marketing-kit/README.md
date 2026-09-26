# Marketing Kit Kaki5 — 14 Hari Pertama (v1, 2026-09-10)

> Kit ini gue (Mavis) siapkan untuk dijalankan **tanpa modal, full online**.
> Prinsip utama: **konten = aset yang kerja terus**, bukan broadcast ke orang asing.
> Gak ada spam, gak ada broadcast dingin. Semua lead datang karena lihat konten.

## Pembagian kerja

| Yang gue (Mavis) kerjakan | Yang lo kerjakan |
|---|---|
| Script video, caption, jadwal (kit ini) | Rekam 1 video/hari (10–15 menit, layar HP) |
| Copy listing Marketplace + GBP + template grup FB | Upload 1 video/hari ke TikTok + IG Reels + YT Shorts |
| Template balasan komen/DM/WA | Balas komen & DM (pakai template, < 1 jam) |
| Setup auto-posting FB Page + IG (kalau mau, butuh 1x token) | Kasih info: testimoni pelanggan pertama, harga final |
| Evaluasi mingguan + kit minggu berikutnya | Update gue tiap Minggu: views, komen, DM, trial masuk |

## Rutinitas harian lo — maksimal 20 menit

1. **Pagi/siang**: rekam 1 video sesuai script hari ini (15–35 detik, layar HP).
2. **Jam 12:00 atau 19:00 WIB**: upload ke TikTok, IG Reels, YT Shorts (video sama, caption dari kit).
3. **Sore**: posting 1x di 1 grup FB (rotate, jangan grup yang sama tiap hari).
4. **Sore**: berburu 15–20 postingan via kata kunci → komentar manusiawi (lihat `05-keyword-outreach.md`).
5. **Kapan aja**: cek komen/DM/Marketplace → balas pakai `06-template-balasan.md`.

## Sebelum posting — isi placeholder ini dulu

- `[WA-LO]` → nomor WA lo (format internasional, contoh `6281234567890`)
- `[HARGA]` → harga lisensi kaki5 yang final (cek Katalog di `control/` atau Supabase `products`)
- `[KOTA]` → default "Solo", ganti kalau nembak kota lain

## Soal akun & keamanan (PENTING)

- Semua akun (TikTok, IG, FB, YouTube) tetap **nama lo, login lo**. Gue **tidak pernah** minta password — dan jangan pernah kirim password/token ke chat siapa pun.
- Kalau lo mau **auto-posting FB Page + IG** (gue posting terjadwal tanpa lo buka app), yang dibutuhkan:
  1. **Facebook Page** "Kasir Solo" (bukan akun pribadi — 10 menit bikin, gratis)
  2. **IG Business/Creator** yang di-link ke Page itu
  3. **Access token** dengan izin `pages_manage_posts` — lo generate sekali, tempel sendiri ke file `.secure.env` di workspace. Gue pandu langkahnya saat lo siap.
- **TikTok tetap manual** (3 menit/hari) — gak ada jalur otomatis yang aman, dan justru TikTok channel paling penting.
- **Gak ada WA blast otomatis** — risiko banned. WA cuma buat yang mampir sendiri (warm lead).

## Struktur kit

| File | Isi |
|---|---|
| `01-kalender-14-hari.md` | Jadwal harian + aksi setup harian |
| `02-script-video-14.md` | 14 script siap rekam (hook + aksi layar + CTA) |
| `03-caption-hashtag.md` | Caption per hari + set hashtag per platform |
| `04-aset-gratis.md` | Listing FB Marketplace + grup FB + Google Business Profile |
| `05-keyword-outreach.md` | Berburu target via pencarian kata kunci + formula komentar |
| `06-template-balasan.md` | Balasan komen/DM/WA + follow-up + jawaban keberatan |
| `07-variasi-komentar-promo.md` | 79 variasi komentar & promo siap pakai (umpan, soft, pitch, DM, post) |
| `08-setup-meta.md` | Checklist setup FB Page + IG + token untuk agent otonom (sekali jalan) |
| `agent/` | Mesin agent otonom: runner, konten 14 hari, template, cron 3x/hari |

## Agent otonom — posting & balasan FB + IG (aktif 2026-09-12)

Agent jalan **3x/hari (09:00 / 12:30 / 19:00 WIB)** via cron, seluruh mesin di `agent/`:

- **Posting** otomatis dari `agent/content.json` (14 hari × 3 slot, turunan kit ini) ke FB Page `mesinkasirsolo` (+ IG yang di-link).
- **Komen** (mode hibrida): sinyal minat/harga → **auto-reply** · negosiasi → **draft** buat lo approve · negatif/spam → **flag** + dilaporkan.
- **Lead** otomatis ke `agent/leads.jsonl` → geser ke kanban `clients` di Control Center.
- **Ramp-up anti-flag:** minggu 1 slot 19:00 saja → minggu 2 +09:00 → minggu 3 penuh 3x/hari. Mavis ingatkan otomatis tiap naik level.
- Setup sekali jalan: `08-setup-meta.md` (Page & IG udah ada — tinggal link IG + token ±45 menit).
- Cek status kapan aja: `node agent/run.mjs --status` · approve draft: `node agent/send-draft.mjs --list` lalu `node agent/send-draft.mjs D-x`.
- Deep link riset kata kunci (bantuan outreach manual kit 05/07): `node agent/kw.mjs "kasir pk"`.
- Komentar di postingan **orang lain** TIDAK diotomasi di platform mana pun (pelanggaran ToS) — tetap manual dengan kit 05/07.

## Ekspektasi yang jujur

- Minggu 1–2: angka kecil, kadang nol. **Normal.** Algoritma butuh sinyal konsistensi.
- Minggu 3+: kalau konsisten, mulai ada DM masuk. Satu video yang kena bisa bawa puluhan DM.
- Target akhir bulan: 10+ trial aktif, 1–3 penjualan. Bulan 2–3 baru masuk zona Rp 3–5 jt.
- Tiap Minggu, kirim angka mingguan ke gue → gue evaluasi & bikin kit minggu berikutnya
  (yang gede sori gede, yang kecil dibuang).
