# DESAIN UI/UX MODUL LISENSI KAKI5

> **Catatan**: Desain ini mengganti alur lisensi lokal (HMAC) dengan validasi terpusat di Supabase server. Tujuan: mempermudah user melakukan aktivasi/perpanjangan melalui backend yang terkelola, sekaligus mempertahankan pengalaman pengguna yang smooth dan konsisten dengan tema aplikasi existente.

---

## 1. Alur Pengguna (User Flow)

Berikut diagram alur teks untuk masing‑masing status lisensi:

```
[Buka Aplikasi]
        |
        v
[Cek Status Lisensi via Supabase GET /license/status]
        |
        +---> [Lisensi AKTIF] --> Tampilkan trial chip "LISENSI ✓ Aktif"
        |                                  Sembunyikan License Gate
        |                                  Tampilkan License Info Card di Pengaturan
        |
        +---> [Lisensi TRIAL] --> Hitung hari tinggal (TRIAL_DAYS - used extensions)
        |                                  Tampilkan trial chip dengan sisa hari
        |                                  Jika sisa > 0: tampilkan tombol "Tambah 1 Hari Gratis" (share)
        |                                  Jika sisa <= 0: tampilkan License Gate (full‑screen lock)
        |
        +---> [Lisensi EXPIRED] --> Sama seperti trial dengan sisa <= 0
        |                                  Tampilkan trial chip "Habis" (merah)
        |                                  Tampilkan License Gate
        |
        +---> [Status NONE] (belum pernah trial) --> Mulai trial otomatis (7 hari)
        |                                  Lanjut ke alur TRIAL di atas
```

**Detail flow spesifik**:

- **Mulai Trial Saat Pertama Kali**: Jika tidak ada data lisensi di settings, panggil `POST /license/start-trial` (atau gunakan endpoint GET yang membuat trial jika belum ada). Simpan respons ke local settings.
- **Tambah Hari Gratis (Share)**:  
  1. User menekan tombol “🎁 Tambah 1 Hari Gratis” di License Sheet atau License Info Card.  
  2. Buka flow share (WA/contact atau navigator.share).  
  3. Setelah share, konfirmasi manual (“Apakah kamu sudah membagikan?”) → jika ya, panggil `POST /license/grant-extension` dengan deviceId.  
  4. Server menambah 1 hari ke trial, mengembalikan sisa hari baru.  
  5. Update UI (trial chip, license sheet, gate) secara realtime.
- **Aktivasi Lisensi Berbayar**:  
  1. User buka License Sheet (melalui tombol “🎫 Kelola Lisensi” di header atau di Pengaturan).  
  2. Masukkan serial lisensi (format `KK5-XXXX-XXXX-XX-XXXXXX`).  
  3. Tekan tombol “🔓 Aktifkan”.  
  4. Kirim ke `POST /license/activate` dengan `{ serial, deviceId }`.  
  5. Respon:  
     - `{ valid: true, message, expiryLabel }` → simpan status active, sembunyikan gate, update chip/info card, tampilkan toast sukses.  
     - `{ valid: false, message }` → tampilkan error toast, biarkan field tetap fokus.
- **Masa Berlaku Habis (Expired)**:  
  - Saat status active tetapi masa berlaku lewat (dicek oleh server atau client berdasarkan `expiryAt`), ubah status ke `expired`.  
  - Tampilkan trial chip “LISENSI KADALUARSA” (merah), tampilkan License Gate dengan pesan “Lisensi sudah kedaluwarsa, perpanjang atau beli lisensi baru”.  
  - Tombol aktivasi tetap berfungsi untuk serial baru.

---

## 2. Deskripsi Layar UI

### 2.1. License Sheet Modal (ID: `sheetLicense`)
- **Ketika dibuka**: dari header trial chip (klik), tombol “Kelola Lisensi” di Pengaturan, atau otomatis saat License Gate muncul.
- **Isi**:  
  - Header: ikon ⏰ (trial) / ✅ (aktif) / ⚠️ (expired) + judul “Masa Coba Gratis” / “Lisensi Aktif” / “Lisensi Kedaluwarsa”.  
  - Badge status: berwarna hijau (aktif), oranye (trial >2 hari), merah (trial ≤2 hari / expired). Teks: “X hari tersisa”, “Habis”, atau “Sudah habis”.  
  - Deskripsi singkat tentang cara memperpanjang trial melalui share.  
  - Bagian **Perpanjangan Gratis**: jika masih ada kuota (<20), tampilkan tombol “🎁 Tambah 1 Hari Gratis”; jika habis, tampilkan hint “Jatah perpanjangan gratis sudah habis”.  
  - Bagian **Input Kode Lisensi**: field berplaceholder `KK5-XXXX-XXXX-XX-XXXXXX`, huruf otomatis uppercase, padding sesuai `.form-input`.  
  - Bagian **Tombol Aksi**:  
    - 💳 Beli Lisensi (membuka WhatsApp ke admin)  
    - 💬 WA Admin (pesan tersedia)  
    - 🔓 Aktifkan (memicu `activateLicense`)  
- **Styling**: gunakan `.card` untuk container keseluruhan, `.license-card-trial`, `.license-card-active`, `.license-card-expired` untuk variasi warna background (gunakan `--green-bg`, `--primary-light`, `--red-bg` dengan opacity ringan).  
- **Loading**: saat menunggu respons API, ganti tombol dengan spinner atau teks “Memeriksa…”, disable semua input.

### 2.2. License Info Card (di Halaman Pengaturan, ID: `licenseInfoCard`)
- Letaknya di bagian bawah halaman Pengaturan, di atas tombol “Kelola Lisensi”.  
- Jika lisensi **aktif**:  
  - Ikon ✅, badge hijau “✓ Lisensi Aktif”.  
  - Nomor serial (disembunyikan sebagian? tampilkan full karena sudah terverifikasi server).  
  - Teks “Masa berlaku: [expiryLabel]” atau “Berlaku seumur hidup”.  
  - Deskripsi: “Lisensi terikat perangkat ini dan membuka semua fitur tanpa batasan.”  
- Jika lisensi **trial**: tampilkan serupa dengan License Sheet (badge, sisa hari, tombol tambah 1 hari).  
- Jika lisensi **expired / none**: tampilkan pesan “Lisensi tidak aktif” dengan tombol “Kelola Lisensi” yang membuka sheet.  
- **Styling**: gunakan `.card license-card-*` sama seperti di sheet, tetapi tanpa field input (hanya tombol buka sheet di bagian bawah card atau tombol terpisah di header).

### 2.3. Trial Chip di Header (ID: `trialChip`)
- Letaknya di sebelah kanan header, sebelah tombol “❓ Bantuan”.  
- Tampilan:  
  - Aktif: `<div class="trial-label-xs">LISENSI</div><div class="trial-value-sm">✓ Aktif</div>` (warna hijau, tanpa kelas `warn`).  
  - Trial: `<div class="trial-label-xs">TRIAL</div><div class="trial-value-sm">[X] hari</div>` (warna oranye jika >2 hari, merah jika ≤2 hari; tambah kelas `warn` untuk merah).  
  - Expired: sama seperti trial dengan teks “Habis” dan kelas `warn`.  
- **Interaksi**: klik membuka License Sheet.

### 2.4. License Gate (Overlay Full‑Screen, ID: `lockOverlay`)
- Muncul saat status bukan aktif dan sisa hari <= 0 (trial habis atau expired).  
- Layout:  
  - Background overlay semi‑transparan rgba(0,0,0,0.6).  
  - Dialog di tengah dengan `.card` (lebih lebar, max‑width 400px).  
  - Ikon besar ⚠️ atau ⏰, judul “Lisensi Habis” atau “Lisensi Kedaluwarsa”.  
  - Pesan: “Masa coba gratis Anda sudah berakhir. Bagikan aplikasi untuk dapat 1 hari gratis atau beli lisensi resmi.”  
  - Tombol “🎁 Tambah 1 Hari Gratis” (share) jika masih ada kuota; jika tidak, hanya tampilkan hint kuota habis.  
  - Field input kode lisensi + tombol “🔓 Aktifkan”.  
  - Tombol “💬 WA Admin” di bawah.  
- **Styling**: gunakan variasi warna sesuai status (trial/expired).  
- **Behaviour**: saat user berhasil memperpanjang atau mengaktifkan, hilangkan overlay (`classList.remove('show')`) dan sembunyikan elemen gate jika ada.

---

## 3. Gaya Visual (mengacu ke css/style.css)

- **Warna Primer**: `--primary:#E65100` (orange tua) untuk tombol primary, aksen, dan nav‑item active.  
- **Warna Status**:  
  - Hijau: `--green:#2E7D32` (lisensi aktif, tombol sukses).  
  - Merah: `--red:#C62828` (trial habis, expired, tombol error).  
  - Oranye: var(--primary) digunakan juga untuk status trial >2 hari dan nilai omzet.  
- **Background**: kartu menggunakan `var(--card:#FFFFFF)` dengan shadow `var(--shadow)` dan radius `var(--radius:16px)`.  
- **Tipografi**: sistem font default (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`). Ukuran sesuai existing: judul card 15px, label 14px, input 17px, value stat 22px, tombol 16px.  
- **Komponen**: reuse kelas yang sudah ada: `.btn`, `.btn-primary`, `.btn-green`, `.btn-outline`, `.form-input`, `.card`, `.stat-card` (untuk badge status jika perlu), `.field` (dari kode HTML existing).  
- **Icon**: gunakan emoji atau font yang sudah ada (tidak perlu menambah asset).  
- **Spacing**: gunakan margin/padding yang konsisten dengan spacing existing (12px‑16px untuk elemen dalam card, 8px gap antar elemen dalam flex/grid).  

---

## 4. Detail Interaksi

| Aksi | UI Feedback | Catatan |
|------|-------------|---------|
| Buka License Sheet | Animasi fade-in overlay, fokus ke input kode lisensi jika sheet ditampilkan untuk aktivasi | |
| Klik tombol “Tambah 1 Hari Gratis” | Tampilkan konfirmasi share (WA/share API). Setelah konfirmasi, tampilkan loading spinner pada tombol. | Jika share dibatalkan, tampilkan toast “Bagikan dulu untuk klaim tambahan”. |
| Share berhasil & user konfirmasi | Tombol kembali normal, tampilkan toast “Masa coba ditambah 1 hari! 🎉 (X/20)”, perbarui trial chip, license sheet, dan sembunyikan gate jika sisa > 0 | |
| Masukkan serial tidak valid | Tampilkan toast error “Serial tidak valid.”, fokus tetap di input, pilih teks untuk memudahkan koreksi | |
| Aktivasi sukses | Tutup sheet, sembunyikan gate, update trial chip & license info card, toast sukses dengan masa berlaku | |
| Lisensi expired terdeteksi | Tampilkan gate secara otomatis (tidak perlu refresh halaman). Jika user sedang di sheet, biarkan sheet tetap terbuka tapi tambahkan banner expired di atas. | |
| Loading state (API call) | Ganti tombol dengan spinner (misal: `<span class="spinner"></span> Memeriksa…`) dan disable seluruh form. Gunakan variabel UI state agar tidak ada double‑click. | |
| Kesalahan jaringan | Tampilkan toast “Gagal menghubungi server, periksa koneksi.”, biarkan user coba lagi. | |

---

## 5. Integrasi dengan Supabase (Endpoint yang Diperlukan)

Asumensi kita akan menggunakan Supabase REST API (atau fungsi Edge) dengan kunci anon yang sudah ada di `.env.local` (hanya untuk membaca; kunci service‑role sebaiknya hanya di backend). Berikut kontrak API yang perlu disediakan oleh backend (bisa di‑implementasikan sebagai Supabase Functions atau endpoint custom):

| Endpoint | Method | Body / Query | Respons | Keterangan |
|----------|--------|--------------|---------|------------|
| `/license/status` | GET | `?deviceId=<uuid>` | `{ status: 'trial'\|'active'\|'expired'\|'none', deviceCode, daysLeft?, extensionsUsed?, expiryAt? (ISO), trialExpired? }` | Dipakai saat aplikasi mulai dan setelah setiap perubahan status. |
| `/license/start-trial` | POST | `{ deviceId }` | `{ status: 'trial', startedAt (ISO), deviceCode, extensionsUsed: 0 }` | Jika belum ada trial, buat baru; jika sudah ada, kembalikan data existente (idempotent). |
| `/license/grant-extension` | POST | `{ deviceId }` | `{ status: 'trial', daysLeft, extensionsUsed, expiryAt }` | Hanya boleh dipanggil jika `extensionsUsed < MAX_EXTENSIONS (20)`. Server menambah 1 hari. |
| `/license/activate` | POST | `{ deviceId, serial }` | `{ valid: true, message, expiryLabel, expCode, serial, deviceCode }` **atau** `{ valid: false, message, reason: 'device'\|'expired'\|'signature'} ` | Validasi serial terhadap tabel lisensi terpusat, cek device match, HMAC, masa berlaku. Jika sukses, simpan status active di settings. |
| `/license/expire` (opsional) | POST | `{ deviceId }` | `{ status: 'expired' }` | Dipakai oleh cron atau trigger saat masa berlaku lewat untuk mengubah status di Supabase (jika kita mau menyimpan expiry di server). |

**Catatan Keamanan**:  
- `deviceId` bisa di‑generate dari `installId` (sudah ada di license.js) atau hash dari `installId` + salt tetap, disimpan di settings agar konsisten per instalasi.  
- Semua request harus menyertakan header `apikey` (anon key) – data yang bersifat pribadi (serial, deviceId) tidak boleh dibuka ke publik tanpa RLS yang tepat.  
- Pertimbangkan mengaktifkan Row Level Security (RLS) pada tabel lisensi di Supabase sehingga setiap device hanya bisa membaca/mengupdate baris miliknya sendiri (berdasarkan `device_id`).  
- Jika kita ingin menyimpan serial terenkripsi di server, lakukan hash/encryption di backend sebelum menyimpan.

**Alur kode di frontend (contoh singkat)**:

```js
// license.js – tambah fungsi-fungsiSupabase
import { supabase } from './supabase-config.js'; // inisialisasi supabase client

async function fetchLicenseStatus() {
  const { data, error } = await supabase
    .from('license_status')
    .select('*')
    .eq('device_id', await getDeviceId())
    .single();
  if (error) throw error;
  return data;
}

async function startTrial() {
  const { data } = await supabase
    .rpc('start_trial', { p_device_id: await getDeviceId() });
  return data;
}
// serupa untuk grantExtension dan activateSerial
```

Supabase config bisa di‑ambil dari `supabase-config.js` yang sudah ada; pastikan kunci anon yang ada di `.env.local` tidak termasuk `service_role`.

---

## 6. Rekomendasi Aksesibilitas & Responsivitas

- **Aksesibilitas**:  
  - Pastikan semua tombol memiliki `aria-label` yang jelas jika hanya menggunakan emoji/ikon. Contoh: tombol share: `aria-label="Bagikan aplikasi untuk dapat hari gratis"`.  
  - Input kode lisensi harus memiliki `<label>` yang terhubung (`htmlFor`).  
  - Gunakan cukup kontras warna: teks putih pada background primary (`#E65100`) sudah memenuhi WCAG AA untuk teks besar; untuk teks kecil (badge) pastikan rasio ≥ 4.5:1 – kita dapat menggunakan `--primary-dark` untuk teks pada badge jika perlu.  
  - Fokus tombol harus terlihat jelas (outline atau shadow) saat navigasi keyboard.  
  - Pastikan overlay gate dan sheet bisa ditutup dengan tombol `Esc`.  

- **Responsivitas**:  
  - Layout sudah menggunakan flex/grid dan lebar maksimal kartu (misal `max-width: 420px`) sehingga terlihat baik di layar lebar (tablet/desktop).  
  - Pada layar sangat kecil (<360px), kurangi padding horizontal pada card menjadi 12px dan gunakan font‑size sedikit lebih kecil (misal 15px untuk judul, 16px untuk input) – tetap menggunakan variabel yang ada atau override via media query di `style.css`.  
  - Pastikan tombol FAB tidak menutupi elemen penting di layar kecil; posisi sudah di‑atur `bottom: calc(var(--nav-h) + 16px); right:16px` yang aman.  
  - Gunakan `-webkit-overflow-scrolling: touch` pada `.main-content` untuk scroll halus di iOS (sudah ada).  

---

## 7. Catatan Implementasi

1. **File yang perlu diubah/tambah**:  
   - `js/license.js` – tambah fungsi Supabase, hapus fungsi HMAC lokal, ganti pemanggilan `validateSerial` dan `grantExtension` dengan versi server.  
   - `js/app.js` – pastikan window‑wiring untuk fungsi-fungsi baru (openLicenseSheet, openExtendFlow, dll) tetap terpasang.  
   - `js/supabase-config.js` – verifikasi bahwa client Supabase di‑inisialisasi dengan kunci anon (bukan service_role).  
   - `index.html` – pastikan elemen `#licenseInfoCard` dan `#syncStatusText` ada (sebaiknya tambahkan juga placeholder untuk loading spinner jika perlu).  
   - `css/style.css` – tambahkan kelas untuk variasi card lisensi (`.license-card-active`, `.license-card-trial`, `.license-card-expired`) bila belum ada; cukup extending dari `.card` dengan background warna yang sesuai.  
   - `sw.js` – tidak perlu perubahan karena lisensi tidak membutuhkan caching khusus (hanya api call ke Supabase).  

2. **Testing**:  
   - Unit test untuk fungsi-fungsi Supabase (mock supabase client).  
   - Uji manual: coba alur trial, share (simulasi dengan konfirmasi manual), aktivasi serial valid/invalid, expired gate.  
   - Pastikan `node --check` masih lulus setelah perubahan.  

3. **Migrasi Data Lokal**:  
   - Jika ada data lisensi lama (status di settings), pada pertama kali aplikasi membaca, migrasikan ke server dengan `POST /license/status` (atau endpoint khusus migrasi) sehingga tidak perlu meminta user memasukkan serial lagi.  
   - Setelah migrasi bersih, hapus kolom lama seperti `serial` di settings jika tidak diperlukan lagi.  

4. **Future‑Proof**:  
   - Sisakan titik tunggal `checkLicenseGate()` yang memanggil endpoint status; jika pada masa depan kita ingin menambahkan fitur seperti lisensi berbasis subscription, cukup mengubah respons endpoint tersebut tanpa mengubah UI.  

---

**Selamat mencoba!** Dengan desain ini, modul lisensi Kaki5 akan lebih mudah dipahami user, terlihat profesional, dan selaras dengan arsitektur backend baru yang terpusat di Supabase. Jika ada butuh bantuan lebih lanjut (misalnya contoh kode supabase function), tinggal tanyak. 🚀