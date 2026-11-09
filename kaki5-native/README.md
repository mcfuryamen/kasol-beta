# kaki5-native — Aplikasi Android Kasir Solo (Kaki Lima)

Bungkus [Capacitor](https://capacitorjs.com) atas web app `kaki5/` — APK offline-first
dengan printer Bluetooth thermal yang tetap jalan lewat shim native.

## Arsitektur

```
kaki5/            (web app, sumber tunggal — TIDAK diubah)
kaki5-native/
├─ sync-www.mjs       salin kaki5/ → www/ + injeksi native-bridge.js
├─ native-bridge.js   shim Web Bluetooth (navigator.bluetooth) di atas
│                     plugin @capacitor-community/bluetooth-le
├─ www/               hasil sync (GITIGNORED, jangan edit manual)
├─ assets/            sumber icon-only.png + splash.png (generator @capacitor/assets)
└─ android/           proyek Android (Gradle) — di-commit
```

Alur kerja setiap rilis web baru:

```bash
cd kaki5-native
npm run sync          # node sync-www.mjs && npx cap sync android
npm run build:debug   # APK debug  → android/app/build/outputs/apk/debug/
npm run build:release # APK release → android/app/build/outputs/apk/release/
```

## Kenapa tanpa Service Worker / overlay update?

WebView Capacitor memuat app via `https://localhost`, sehingga `isDev()` di
kaki5 = `true` → `pwa.js` otomatis TIDAK mendaftarkan SW dan `update.js` hanya
men-fetch `version.json` milik bundel sendiri (versi selalu cocok → overlay
tidak pernah muncul). Aset ikut APK = offline penuh tanpa SW. **Update app
lewat APK baru** (versi & versionCode dinaikkan di `android/app/build.gradle`).

## Printer Bluetooth (shim)

WebView Android tidak punya Web Bluetooth. `native-bridge.js` menyediakan
`navigator.bluetooth` tiruan di atas bridge plugin BLE native:

| printer.js (web)                     | shim → plugin BluetoothLe                        |
|--------------------------------------|--------------------------------------------------|
| `requestDevice({filters, optionalServices})` | `initialize()` (izin) + `requestDevice({optionalServices})` — **dialog native menampilkan SEMUA perangkat sekitar** (filter nama prefix web tidak diterjemahkan; user memilih printer dari daftar) |
| `gatt.connect()`                     | `connect({deviceId})` (toleran "already connected") |
| `getPrimaryService` / `getCharacteristics` | `discoverServices` + `getServices` (cache per koneksi) |
| `writeValue` / `writeValueWithoutResponse` | `write` / `writeWithoutResponse` (bytes → base64) |
| `'gattserverdisconnected'`           | listener event `disconnected\|<deviceId>`        |

Pemilihan karakteristik tetap otomatis: service UUID thermal umum
(18f0 / 49535343 / ff00 / e7810a71) → karakteristik pertama yang bisa `write`.

## Signing release

`android/keystore.properties` (GITIGNORED):

```properties
storeFile=kasir-kaki5-release.keystore
storePassword=***
keyAlias=kasir-kaki5
keyPassword=***
```

Keystore di `android/app/kasir-kaki5-release.keystore` (GITIGNORED).
**WAJIB dibackup pemilik** — keystore hilang = tidak bisa update app untuk
user yang sudah terpasang. Tanpa `keystore.properties`, build release jatuh
ke debug signing (untuk uji, jangan dibagikan).

## Migrasi data user dari PWA

Origin `https://localhost` (APK) ≠ origin web (`https://kasirsolo.com`) —
IndexedDB/LocalStorage terpisah. Jalur migrasi: di PWA lama buka
**Pengaturan → Data & Cadangan → Cadangkan** (file JSON), lalu di APK
**Pulihkan** dari file cadangan itu. Profil & lisensi akan tersinkron ulang
ke cloud otomatis saat login kuota/claim perangkat berjalan.

## Izin & fitur

- INTERNET (Supabase/kuota), izin Bluetooth & lokasi (merge dari plugin BLE),
  file picker (`<input type="file">` untuk upload bukti bayar) didukung WebView.
- Jangan ganti `androidScheme`/hostname default — banyak gating dev kaki5
  bergantung pada `https://localhost`.
