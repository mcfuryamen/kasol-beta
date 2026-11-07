# Agent AI — Meja Review Draft Otomatis Ekosistem Kasol

> **File ini dibaca oleh AI agent apa pun yang menyentuh modul agent.** Ringkasan
> 1-menit di bawah, detail lengkap setelahnya.

## Ringkasan (TL;DR)

Agent AI = **pekerja draft otomatis yang TIDAK boleh langsung eksekusi** — dia
menyusun bahan (draft pesan WA, laporan, brief SEO), lalu **manusia (owner) yang
memutuskan** di Control Center → halaman **Agent**. Filosofi kunci:
**human-in-the-loop** — AI tidak pernah menyentuh pelanggan/website tanpa
persetujuan.

```
                S I K L U S   D U A   L O P
  LOP 1 (produksi draft):            LOP 2 (keputusan manusia):
  agent_tasks ──runner──▶ Omniroute   agent_outputs (draft) ──review──▶ approved
  (antrean kerja)  │      (otak AI)   Control → halaman Agent   │        │
   ▲               └──▶ draft ───────┘                          └─ rejected
   └── enqueue-reaktivasi.mjs (seeder dari outreach_contacts)
```

---

## 1. Konsep

Ekosistem memakai AI lokal (Omniroute, `http://127.0.0.1:20128`) sebagai **otak**.
Runner lokal (`agent/runner.mjs`) mengambil **tugas** dari tabel `agent_tasks`,
bertanya ke otak, dan menulis **hasil draft** ke `agent_outputs`. Owner me-review
setiap draft di Control → **Agent** (`#agents`), lalu menyetujui/menolak.

**Mengapa draft dulu, bukan langsung aksi?** Pesan WhatsApp ke pelanggan, laporan
audit, atau brief SEO yang salah bisa merusak hubungan klien. Prinsipnya: AI
boleh **menyusun**, manusia yang **menembak**.

### Status draft (lifecycle)

```
draft ──review──▶ approved ──pakai──▶ dipakai
   │  (✓ Setujui)        (📦 Tandai Dipakai)
   └──review──▶ rejected ──bisa──▶ draft (↩ Kembalikan ke Draft)
      (✕ Tolak)
```

- **draft** — hasil AI, menunggu review (chip Draft + statline "menunggu review").
- **approved** — disetujui, siap dipakai (mis. disalin ke modal chat outreach).
- **rejected** — ditolak; boleh dikembalikan ke draft bila mau diperbaiki AI.
- **dipakai** — sudah dieksekusi (terkirim/terpakai), penanda akhir siklus.

## 2. Komponen & File

| Komponen | File | Peran |
|----------|------|-------|
| Otak AI | Omniroute (`127.0.0.1:20128`) | Provider model (combo `auto/*`), dijalankan `node --max-old-space-size=2313` dari install global npm |
| Pintu AI | `agent/callAI.js` | `callAI()` = satu-satunya jalur ke Omniroute; parse SSE manual; `omniHealthy()` cek hidup |
| Runner | `agent/runner.mjs` | Claim tugas atomik → eksekusi handler → `done/error`; `--watch` polling 60s; **reaper** task `running` nyangkut >15 mnt; **putOutput idempoten** (task_id+judul); taksonomi error `[NON-RETRYABLE]`; log ke `agent/runner.log` (rotasi 1MB) |
| Seeder | `agent/enqueue-reaktivasi.mjs` | Baca `outreach_contacts` → posang `agent_tasks` (idempotent per tipe, dedupe ref_id+judul); flag `--tipe draft_wa\|followup_wa`, `--variasi 1-3`, `--limit`, `--status`, `--arahan`, `--dry-run` |
| Seeder follow-up | `agent/enqueue-followup.mjs` | Harian otomatis: kontak `terkirim/bales` dengan `last_contact_at` ≥ N hari (default 3) yang belum punya draft Follow-up → naruh task; flag `--hari`, `--limit`, `--dry-run`, `--arahan` |
| Watchdog | `agent/watchdog.ps1` | Jaga proses: Omniroute & runner `--watch` dihidupkan ulang bila mati (tidak pernah mematikan); `-OneShot` utk Task Scheduler; log `agent/watchdog.log` |
| Instal ops | `agent/install-scheduler.ps1` | Daftarkan Task Scheduler: watchdog tiap 1 menit + follow-up harian 08:00 (idempotent, header berisi cara uninstall) |
| Agent handler | `agent/agents/marketing.js` | Spesialis draft WA: basis pengetahuan produk (PRODUK), jawaban keberatan (OBJECTION), sudut manfaat per jenis usaha (hookKategori), sadar relasi klien-lama (source), **re-fetch kontak fresh saat eksekusi**, **validator mutu + retry korektif 1x**, **belajar dari penolakan (few-shot draft rejected/approved)**. Tipe: `draft_wa` (± varian A/B/C) & `followup_wa` |
| Halaman Agent | `control/js/agents.js` + `#screen-agents` | **Kelola agent** (tambah/edit/hapus — `settings.agents`) + konfigurasi global (`settings.agent_config`) + antrean (batal massal) + susun tugas per agent dari browser — draft TIDAK dikelola di sini |
| Tabel kerja | `agent_tasks`, `agent_outputs` (Supabase) | Antrean tugas & hasil draft |

## 3. Skema Data

### `agent_tasks` — antrean kerja

| Kolom | Isi |
|-------|-----|
| `agent` | `marketing` (nama handler — dipetakan di `HANDLERS` runner) |
| `tipe` | `draft_wa` (draft perkenalan/fase) atau `followup_wa` (lanjutan bawa sudut baru) |
| `payload` | jsonb: `{ kontak_id, kontak:{nama,kategori,status,sent_count,alamat?,catatan?,last_contact_at?,source?}, arahan?, variasi? (1-3, draft_wa), pesan_sebelumnya?, hari_lalu? (followup_wa) }` |
| `status` | `pending → running → done | error` (retry hingga `max_attempts`) |
| `priority` | angka (rendah = didahulukan) |
| `attempts`, `max_attempts` | percobaan (default 3) |
| `runner_id` | identitas PC yang claim (`pc-<COMPUTERNAME>`) |

### `agent_outputs` — hasil draft

| Kolom | Isi |
|-------|-----|
| `task_id` | FK ke `agent_tasks` |
| `agent`, `jenis` | `marketing` / `draft_wa` (jenis lain: `laporan_audit`, `brief_seo`) |
| `ref_table`, `ref_id` | pelacak asal (mis. `outreach_contacts:<id>` — dipakai seeder utk dedupe) |
| `judul`, `isi` | judul + isi draft. Konvensi judul (dipakai seeder utk dedupe per tipe, JANGAN diubah): `Draft WA — X` / `Draft WA B — X` (varian) / `Follow-up — X` |
| `model` | model nyata dari chunk pertama SSE (mis. `auto/best-fast`) |
| `status` | `draft → approved/rejected/dipakai` |
| `review_note`, `reviewed_at` | catatan & waktu keputusan owner (legacy — meja review sudah diganti komposer) |

### `settings.agent_config` + `settings.agents` — konfigurasi (Control → Agent)

`agent_config` = nilai GLOBAL (fallback semua agent): `arahanGlobal` (ditempel ke
prompt, berlaku seketika), `model` (baku `auto/best-fast`), `variasi` (1-3),
`followupAuto` (seeder harian aktif?), `followupHari` (ambang, baku 3).

`agents` = ARRAY profil agent yang dikelola pemilik (tambah/edit/hapus di
Control → Agent):

| Field | Isi |
|-------|-----|
| `id` | slug unik — ikut `agent_tasks.payload.agent_id` |
| `nama` | nama tampil |
| `target` | `perkenalan` (kontak `belum`) atau `followup` (sudah dihubungi ≥ ambang) |
| `model` / `arahan` / `variasi` | opsional — kosong = ikut global |
| `aktif` | `false` → tugas pending milik agent dilempar NON-RETRYABLE oleh runner |

Runner menggabungkan: `task.payload` > profil agent > global > baku.

## 4. Alur Operasional

### 4.1 Menyiapkan kerja (enqueue)

```bash
# Semua kontak 'belum' → draft perkenalan (dedupe otomatis vs output/task lama)
node agent/enqueue-reaktivasi.mjs

# Batch / simulasi / arahan kampanye / varian A/B utk review dibandingkan
node agent/enqueue-reaktivasi.mjs --limit 20
node agent/enqueue-reaktivasi.mjs --dry-run
node agent/enqueue-reaktivasi.mjs --arahan "fokus diskon tahunan"
node agent/enqueue-reaktivasi.mjs --variasi 2

# Gelombang follow-up: kontak terkirim/bales yang belum punya draft Follow-up;
# payload otomatis bawa pesan_sebelumnya (draft approved/dipakai terakhir) + hari_lalu
node agent/enqueue-reaktivasi.mjs --tipe followup_wa
```

Idempotent PER TIPE: `draft_wa` skip kontak yang sudah punya output non-Follow-up;
`followup_wa` skip yang sudah punya output berjudul "Follow-up …"; task
`pending/running` sejenis juga di-skip → aman dijalankan berulang. Kontak yang
sudah di-flag `mati`/`optout` tidak pernah masuk kandidat (status default seeder).

### 4.2 Memproses (runner)

```bash
node agent/runner.mjs          # sekali jalan
node agent/runner.mjs --watch  # polling 60 detik (produksi: Task Scheduler)
```

- Wajib Omniroute hidup — `omniHealthy()` timeout **45s** (warm-up dingin ~25-30s).
- Claim atomik: UPDATE `status='running'` dengan guard `status='pending'`.

### 4.3 Halaman Agent (Control) — konfigurasi & antrean

Halaman Agent BUKAN rak draft. Draft dikonsumsi lewat **komposer WA di sheet
detail kontak** (outreach.js — prefill draft AI terakhir, apapun statusnya;
owner memeriksa/mengedit lalu mengirim; draft terkirim otomatis `dipakai`).
Halaman Agent berisi:

1. **Konfigurasi** — arahan global, model, variasi, follow-up otomatis + ambang
   hari → tersimpan `settings.agent_config`, dibaca runner & seeder (TTL 60s).
2. **Statline antrean** — tunda/jalan/batal/gagal + tombol ✕ Batalkan antrean
   (status `batal`; keluar dari antrean tanpa dieksekusi runner).
3. **Susun tugas** — naruh tugas dari browser tanpa CLI: draft perkenalan
   (kontak `belum`) & follow-up (kandidat ≥ ambang hari) — dedupe idempotent
   sama dengan seeder.

### 4.4 Operasional tanpa diingat (ops)

```powershell
# Sekali pasang: watchdog tiap 1 menit + follow-up harian 08:00 (idempotent)
powershell -ExecutionPolicy Bypass -File agent/install-scheduler.ps1
# Uninstall: Unregister-ScheduledTask -TaskName 'Kasol Agent Watchdog' / 'Kasol Followup Harian'
```

- **Watchdog** menghidupkan ulang Omniroute & runner `--watch` bila mati (tidak pernah mematikan; anti start-ganda).
- **Runner restart manual** tetap perlu setelah update kode agent (watchdog hanya menyalakan proses yang mati).
- Log: `agent/runner.log`, `agent/watchdog.log` (rotate 1MB; di-gitignore).

## 5. Lapisan Ketangguhan (robustness, 2026-09-19)

| Ancaman | Pertahanan |
|---|---|
| Task `running` nyangkut (PC mati/crash) | **Reaper**: `claimed_at` > 15 mnt → reset `pending` (guard atomic, hormati max_attempts) |
| Retry menghasilkan draft dobel | **putOutput idempoten**: cek (task_id, judul) sebelum insert |
| Draft dibuat dari data basi (status kontak berubah) | **Re-fetch fresh** `outreach_contacts` by kontak_id saat eksekusi; `mati/optout` → error NON-RETRYABLE |
| Output AI sampah (placeholder/Inggris/kepanjangan) | **validasiDraft()** → auto-retry 1x dengan koreksi spesifik → tetap gagal = NON-RETRYABLE |
| Error sementara vs permanan | **Taksonomi**: prefix `[NON-RETRYABLE]` langsung error tanpa buang retry |
| Owner menolak draft berkali-alasan sama | **Few-shot**: 4 rejected terbaru + 2 approved disuntik ke prompt sebagai contoh |
| Lupa jalanin runner / Omniroute mati diam-diam | Watchdog + Task Scheduler (4.4) + **heartbeat** `settings.runner_heartbeat` per siklus → indikator 🟢/🔴 di statline halaman Agent |
| Antrean dobel (dobel-klik susun / UI+CLI paralel) | **Indeks unik DB** `agent_tasks_aktif_unik` — partial (kontak_id+tipe, hanya pending/running); UI & seeder melewati 409 per baris + kunci busy |
| Hapus agent menyisakan tugas yatim | Hapus agent → tugas pending miliknya IKUT DIBATALKAN otomatis |
| Semua agent terhapus → halaman buntu | Daftar kosong jatuh kembali ke agent baku (Marketing) |
| Salah kirim ke kontak opt-out/mati | Komposer WA memblokir kirim utk status `mati`/`optout` |

## 6. Keamanan

- **RLS tanpa policy publik** — `agent_tasks` & `agent_outputs` tidak bisa dibaca
  anon. Runner/seeder pakai **SERVICE_ROLE** langsung dari PC tepercaya
  (key hanya di `.env.local`, tidak pernah ke browser/Vercel).
- Control membaca via proxy server-side (`/api/rest` → Supabase service role),
  bukan key publik.
- **XSS aman** — semua render `judul/isi/note` lewat `escapeHtml()` (full-map).

## 7. Menambah Agent/Jenis Baru

1. Tulis handler `agent/agents/<nama>.js` — ekspor fungsi
   `({ task, callAI, putOutput, sbFetch }) => result`.
2. Daftarkan di `HANDLERS` runner (`agent/runner.mjs`).
3. (Opsional) `JENIS_META` di `control/js/agents.js` + `AGENT_STATES` bila
   status bertambah.
4. Buat tugas uji `agent_tasks` (payload sesuai handler) → jalankan runner.

## 8. Status & Catatan (2026-09-19)

- ✅ Struktur lengkap: tabel, runner, callAI, agent marketing spesialis, meja review.
- ✅ Alur reaktivasi teruji end-to-end: enqueue → runner → draft `outreach_contacts:<id>`.
- ✅ Fix `omniHealthy` timeout 20s→45s (false negative saat warm-up).
- ✅ Marketing jadi spesialis (2026-09-19): basis pengetahuan produk + keberatan,
  hook per kategori usaha, sadar relasi klien-lama (`source=klien_lama` — 316 kontak
  seed adalah mantan pemakai kasir), tipe `followup_wa`, varian A/B/C, QA UI 2 viewport.
- ✅ PAKET ROBUSTNESS (2026-09-19, QA lulus — lihat seksi 5): reaper, putOutput
  idempoten, re-fetch fresh, validator + retry korektif, taksonomi error, few-shot
  penolakan, log file, follow-up harian otomatis, watchdog + Task Scheduler,
  tombol 'Setujui & Buka Chat' + 'Batalkan antrean' di Control.
- ⚠️ Runner tidak berjalan terus-menerus SECARA DEFAULT — pasang Task Scheduler
  (seksi 4.4) atau jalankan `--watch` manual; **restart runner setelah update kode**.
- ⚠️ Kualitas draft tetap bergantung model `auto/best-fast` — validator memfilter
  kasus kasar, review manusia tetap gerbang wajib.
- 📌 Stok kerja: kontak `belum` ±315 menunggu enqueue; runner `--watch` boleh
  dibiarkan hidup (watchdog menjaga).
- Relasi: [[kasol-marketing-strategy]] · `CONTEXT.md` (port registry).