# CRM — Penggabungan Modul Klien + Mitra (App Control)

Tanggal rencana: 2026-10-28 · Keputusan owner: McFury (via sesi MiniMax Code)
Status eksekusi: lihat bagian [Status](#status-eksekusi) di bawah.

## 1. Latar & keputusan owner

Modul Klien (`control/js/clients.js`) dan modul Mitra (`control/js/partners.js`) di app
Control dikelola terpisah padahal orangnya sering tumpang tindih (mitra biasanya juga
klien/pengguna aplikasi). Owner memutuskan:

1. **Opsi B — merge penuh**: tab *Kontak* menampilkan view SQL terpadu `crm_contacts`
   (gabungan clients + referral_partners) + sheet detail 360°.
2. **Fase 1 + 2 sekaligus** (shell CRM + Kontak terpadu).
3. **CRM naik ke sidebar utama** (desktop) + bottom-nav mobile; entry Mitra keluar dari
   sheet "Lainnya".
4. Nama modul: **CRM**.
5. Rencana ini disimpan ke `docs/` (file ini).

## 2. Fakta desain (hasil pemetaan repo & DB live)

- Modul Mitra = read-only dari UI, tulis hanya via RPC (`partner_approve`,
  `partner_issue_token`, `referral_resolve_pending`) melalui proxy `/api/rest`.
- Modul Klien = menulis langsung (PATCH `clients`/`licenses`, klaim akun global).
- Penghubung identitas yang sudah ada: `referral_partners.client_id` → `clients.id`,
  kolom `global_identity_id` di kedua tabel, `global_identities.phone_e164` UNIQUE
  (1 WA = 1 akun). Klien juga otomatis punya kode referral AJK-* (`referral_my_code`).
- Volume data saat desain: 23 klien, 3 mitra, 6 redemption, 6 kode, 5 wallet,
  3 akun global, 2 payout.
- Dependensi yang harus tetap hidup: `dashboard.js` (import `stageMeta`,
  `renderAnalytics` dari clients.js + `STATE.clients`), `codes.js` (loadOwners dari
  clients + referral_partners), `agent-draft.js`, whitelist parity
  `control/api/rest.js` ↔ `control/server.js`.
- **Kolom `clients.harga` tidak ada di DB live** — nilai pakai `price_paid`.
- Skema HUB (`global_identities`, `licenses`, `app_memberships`, `license_devices`)
  di-FREEZE — tidak diubah, hanya dibaca.

## 3. Arsitektur

```
#screen-crm  (satu section, sidebar utama)
├─ content-tabs: [Kontak] [Klien] [Mitra] [Outreach]
│   ├─ Kontak   = crm.js membaca view `crm_contacts` (service-role via /api/rest)
│   │             ├─ list terpadu + search + chip filter (Semua/Klien/Mitra)
│   │             └─ sheetCrmContact 360°: identitas + klien + mitra + aksi cepat
│   ├─ Klien    = isi #screen-klien lama utuh (ID element tidak berubah)
│   ├─ Mitra    = isi #screen-mitra lama utuh (+ sheetPartnerDetail)
│   └─ Outreach = isi #screen-outreach lama utuh (ID element tetap); menu sidebar
│                 & bottom-nav Outreach dihapus; deep-link #outreach → tab ini
└─ nav: tombol sidebar `data-screen="crm"`; deep-link #crm?tab=klien|mitra|kontak|outreach;
        #klien & #mitra & #outreach lama diarahkan ke tab yang sesuai
```

### Merge Outreach menjadi tab ke-4 (28 Okt, permintaan owner)

Prinsip owner: **"hanya pindahkan lokasi menu saja"** — isi/fungsi modul Outreach
tidak diubah, dan tab Kontak (chip Semua dll.) harus tetap berperilaku sama.

- Markup `#screen-outreach` dipindah **utuh** ke panel `#crmViewOutreach` di dalam
  `#screen-crm` — semua ID element tetap (`outreachSearch`, `outreachSource`,
  `outreachChips`, `outreachCardList`, dst.), impor/ekspor CSV utuh.
- Tombol sidebar & bottom-nav Outreach dihapus (bottom-nav kini 4 item:
  Dashboard/Katalog/CRM/Lainnya). Badge `sideCountOutreach` sudah tidak ada di DOM —
  `updateSidebarBadges` tetap aman (null-check).
- Titik JS yang disentuh (minimal): `CRM_TABS` + refresh saat tab dibuka
  (`crm.js`), redirect legacy di `switchScreen('outreach')` → `#crm?tab=outreach`
  (`navigation.js`, menangani semua pemanggil lama termasuk CTA Dashboard dan
  `openOutreachWaFor`), listener `screen:change` `'outreach'` → `'crm'`
  (`outreach.js`), refresh map `'crm'` = 4 tab sekaligus (`app.js`).
- Data Outreach tetap di tabelnya sendiri — **tidak** digabung ke view
  `crm_contacts`; "tetap tampil di filter kontak/semua" dimaknai tab Kontak +
  chip Semua tidak berubah perilaku (diverifikasi: chip Semua 20 tetap aktif).

### View `crm_contacts` (baca-only, schema public)

- Union `clients` + `referral_partners` → dinormalisasi per orang dengan kunci:
  1. `global_identity_id` (paling akurat),
  2. fallback nomor WA ternormalisasi (`wa:<digits>`),
  3. fallback `id:<id-sumber>`.
- Kolom: `identity_key, nama, wa, kota, provinsi, kinds text[], client_id, partner_id,
  status_klien, status_mitra, tier_mitra, kode_referral, app_type, app_types text[],
  nilai_klien, last_seen, global_identity_id, source_rows`.
- Phone-match hanya untuk *menampilkan* gabungan, tidak pernah menulis data.
- Keamanan: `revoke all from public, anon, authenticated` + `grant select to
  service_role` (anti auto-grant Supabase); `security_invoker = false`.
- File: `supabase/migration-crm-contacts-fase1.sql`,
  rollback `supabase/rollback-crm-contacts-fase1.sql`.

## 4. Fase eksekusi

- **Fase 1 — Shell CRM**: section `#screen-crm` + 3 tab, nav sidebar/bottom/sheet
  "Lainnya", `PAGE_META`/`SECONDARY_SCREENS`/deep-link di `navigation.js`,
  `initCRM()` + `refreshCurrentScreen('crm')` di `app.js`, whitelist
  `crm_contacts` di `rest.js` + `server.js` (parity).
- **Fase 2 — Kontak 360°**: `control/js/crm.js` baru (list, filter, sheet 360°,
  notice ramah bila view belum ter-apply), adaptasi minimal clients.js/partners.js
  (ID element tetap).
- **Fase 3 (opsional, belum dieksekusi)**: tabel `crm_activities` untuk catatan
  interaksi + tanggal follow-up per kontak. Tabel baru murni tambahan.

## 5. Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| clients.js besar (±1.6k baris) dengan banyak listener | Markup dipindah utuh, ID tetap; logic tidak dirombak |
| `dashboard.js`/`codes.js` rusak pas merger | Tidak menyentuh logic keduanya; ekspor clients.js dipertahankan; smoke lintas modul |
| Whitelist parity lupa | `crm_contacts` ditambah di rest.js + server.js bersamaan |
| Salah pasangkan orang (phone match) | Match dipakai hanya untuk tampilan; sumber aksi tetap client_id/partner_id |
| View bocor ke publik | revoke eksplisit + grant service_role saja; diakses hanya via proxy Control |
| Rollback | Fase 1-2 = revert file control; view = drop view (rollback SQL tersedia) |

## 6. Yang TIDAK disentuh

Skema & freeze HUB, semua tabel/RPC eksisting (tidak ada yang di-replace), app lain
(kaki5/company/mitra web/laundry/rosok), pola akses service-role proxy.

## Status eksekusi

- [x] Pemetaan repo + DB live
- [x] Rencana disetujui owner (Opsi B, fase 1+2, sidebar utama, nama CRM)
- [x] SQL migrasi + rollback dibuat
- [x] View `crm_contacts` di-apply ke Supabase (20 kontak terverifikasi; grants: hanya
      postgres+service_role, anon 401)
- [x] Frontend control (index.html, navigation.js, app.js, crm.js, whitelist) — selesai;
      1 bug bootstrap (import initOutreach/initAgents hilang) sudah difix
- [x] Smoke browser (3 tab, Kontak 360°, deep-link, console bersih) — 28 Okt: tab Kontak
      20 kontak · sheet 360° amin (fetch wallet+payout hidup) · chip filter Klien 17 ·
      search "tanti" (0 hasil saat filter Klien — empty state rapi; 1 hasil Bu Tanti saat
      Semua) · tab Mitra 3 mitra (statline poin siap 150) · tab Klien utuh (16 klien,
      pipeline 14 Baru/4 Aktif) · deep-link `#crm?tab=klien` langsung aktif setelah reload ·
      Dashboard modul lain hidup · console 0 error/warning
- [x] Merge Outreach jadi tab ke-4 CRM (28 Okt) — markup dipindah utuh (ID tetap),
      redirect legacy `#outreach` → `#crm?tab=outreach`, smoke lulus: tab Outreach
      render penuh (394 kontak · chips Semua/Belum 315/Terkirim 79/Bales/Minat ·
      filter sumber · impor/ekspor CSV · kartu + tombol WA) · deep-link `#outreach`
      otomatis ke tab Outreach · sidebar & bottom-nav bersih dari menu lama ·
      tab Kontak default chip "Semua 20" tetap aktif (tidak berubah) ·
      console 0 error/warning
- [x] Laporan final (tanpa commit — nunggu perintah owner)
