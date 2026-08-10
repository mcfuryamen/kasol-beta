# Audit: Fungsi Filter Laporan & Riwayat — Kasir Solo Rosok

**Tanggal Audit:** 2026-08-01  
**Area:** Filter Laporan & Riwayat Transaksi  
**File:** `index.html`

---

## 1. OVERVIEW FITUR FILTER

Terdapat dua mekanisme filter di aplikasi:

| Fitur | Lokasi | Mekanisme | Variable |
|-------|--------|-----------|----------|
| **Riwayat** | `screen-riwayat` (line 603) | Tab tipe: Semua / Beli / Jual | `riwayatFilter` (line 991) |
| **Laporan** | `screen-laporan` (line 613) | Tab periode: 7 Hari / 30 Hari / Semua | `laporanPeriode` (line 994) |

---

## 2. AUDIT FILTER RIWAYAT

### 2.1 Kode Terkait
- `setRiwayatFilter(f)` — line 1879
- `renderRiwayat()` — line 1884
- `loadRiwayatPage()` — line 1890

### 2.2 Bug #R1 — Pagination Tidak Memperhitungkan Filter 🔴 KRITIS

**Lokasi:** `loadRiwayatPage()` line 1892-1900

```javascript
let list = await db.transaksi
  .orderBy('tanggal')
  .reverse()
  .offset(offset)      // ← offset dihitung dari SEMUA transaksi
  .limit(RIWAYAT_PER_PAGE)
  .toArray();

if(riwayatFilter !== 'semua') list = list.filter(t=>t.tipe===riwayatFilter); // ← filter diterapkan SETELAH pagination
```

**Masalah:** `.offset()` dan `.limit()` berjalan pada **semua** transaksi, baru kemudian hasil di-filter. Akibatnya:
- Jika user memilih filter "Beli", transaksi `jual` tetap menduduki slot offset/limit.
- Transaksi `beli` yang ada di posisi awal bisa terlewatkan (skipped) karena slot pagination diisi oleh transaksi `jual`.
- Saat pindah filter, halaman 0 akan menampilkan transaksi yang salah posisinya.

**Reproduksi:**
1. Buat 10 transaksi beli + 10 transaksi jual (selang-seling tanggal).
2. Buka Riwayat, pilih filter "Beli".
3. Transaksi beli ke-9 dan ke-10 mungkin tidak muncul karena slot 0-19 diisi juga oleh transaksi jual.

**Solusi:** Filter harus diterapkan **sebelum** pagination, atau gunakan Dexie query chain yang menggabungkan filter + offset/limit:
```javascript
let query = db.transaksi.orderBy('tanggal').reverse();
if(riwayatFilter !== 'semua') query = query.where('tipe').equals(riwayatFilter);
let list = await query.offset(offset).limit(RIWAYAT_PER_PAGE).toArray();
```

### 2.3 Bug #R2 — `totalFiltered` adalah Dead Code 🟡 SEDERHANA

**Lokasi:** line 1903-1906

```javascript
const totalFiltered = await db.transaksi
  .where('tanggal')
  .anyOf([]) // placeholder, akan diquery terpisah
  .toArray();
```

Variabel `totalFiltered` **tidak pernah dipakai**. Logika `hasMore` sebenarnya menggunakan `list.length === RIWAYAT_PER_PAGE` (line 1908) yang sudah cukup. Query unnecessary ini membuang 1 round-trip ke IndexedDB.

**Solusi:** Hapus block code line 1903-1906.

### 2.4 Bug #R3 — Tombol "Muat Lebih Banyak" Muncul di State Kosong 🟡 SEDERHANA

**Lokasi:** line 1913-1918

```javascript
if(list.length===0){
    card.innerHTML = `<div class="empty-state">...</div>`;
    if(hasMore){
      card.innerHTML += '<div ...>Muat Lebih Banyak</button></div>'; // ← kontradiktif
    }
    return;
}
```

Jika `list.length === 0` tapi `hasMore === true`, user akan melihat pesan "Belum ada transaksi" **bersamaan** dengan tombol "Muat Lebih Banyak". Ini membingungkan.

**Solusi:** Jangan tampilkan tombol "Muat Lebih Banyak" jika `list.length === 0`.

### 2.5 Bug #R4 — Void Transaksi Tetap Muncul di Riwayat 🟡 SEDERHANA

Fungsi `loadRiwayatPage()` tidak memfilter transaksi dengan `t.void === true`. Transaksi yang sudah dibatalkan tetap muncul di daftar riwayat.

---

## 3. AUDIT FILTER LAPORAN

### 3.1 Kode Terkait
- `setLaporanPeriode(p)` — line 2026
- `periodeStartDate()` — line 2031
- `renderLaporan()` — line 2037

### 3.2 Bug #L1 — Chart Omzet Tidak Mengikuti Periode Filter 🔴 KRITIS

**Lokasi:** line 2061-2065, 2117-2140

```javascript
// Daily stats untuk bar chart
const dailyStats = {};
for(let i=0;i<7;i++){           // ← HARDCODED 7 HARI
  const d = new Date(); d.setDate(d.getDate()-i);
  ...
}
```

Chart omzet **selalu menampilkan 7 hari terakhir**, terlepas dari periode yang dipilih user (7 Hari / 30 Hari / Semua). Ini inconsistency yang menyesatkan.

**Dampak:** User memilih "30 Hari" tapi chart tetap 7 hari. Tidak ada visual feedback bahwa periode berubah.

**Solusi:** Buat range harian berdasarkan `laporanPeriode`:
```javascript
const chartDays = laporanPeriode === 'all' ? 30 : parseInt(laporanPeriode);
const dailyStats = {};
for(let i=0; i<chartDays; i++){
  const d = new Date(); d.setDate(d.getDate()-i);
  ...
}
```

### 3.3 Bug #L2 — Transaksi Void Tidak Dikecualikan dari Perhitungan 🟡 SEDERHANA

**Lokasi:** line 2068-2093 (loop allTrans)

```javascript
for(const t of allTrans){
  const isBeli = t.tipe === 'beli';
  const isInPeriode = t.tanggal >= startStr;
  // ← TIDAK ADA cek t.void
  if(isBeli) stats.beliSemua.total += t.total || 0;
  ...
}
```

Transaksi yang di-void (line 2007-2010) tetap masuk dalam perhitungan:
- Total pembelian & penjualan
- Utang & piutang
- Daily stats chart
- Top kategori rosok (line 2144-2150)

**Dampak:** Laba kotor dan estimasi laba menjadi **tidak akurat** setelah ada transaksi yang di-void.

**Solusi:** Tambahkan kondisi `if (t.void) return;` di awal loop:
```javascript
for(const t of allTrans){
  if(t.void) continue; // abaikan transaksi yang sudah dibatalkan
  ...
}
```

### 3.4 Bug #L3 — Ketidakonsistenan Filter Periode 🟡 SEDERHANA

Berikut tabel konsistensi filter periode:

| Komponen Laporan | Difilter Periode? | Keterangan |
|-----------------|-------------------|------------|
| Total Pembelian (periode) | ✅ Ya | `t.tanggal >= startStr` |
| Total Penjualan (periode) | ✅ Ya | `t.tanggal >= startStr` |
| Estimasi Laba Kotor | ✅ Ya | Turunan dari beli/jual periode |
| Total Pengeluaran | ✅ Ya | `k.tanggal >= startStr` |
| Utang & Piutang | ❌ Tidak | "Semua waktu" — disengaja |
| Kas Saldo | ❌ Tidak | Semua waktu — masuk akal |
| Chart Omzet | ❌ Tidak | Hardcode 7 hari (Bug #L1) |
| Top Kategori Rosok | ✅ Ya | `tr.tanggal >= startStr` |
| Riwayat Kas Terbaru | ❌ Tidak | Slice(0,8) semua waktu |
| Utang/Piutang Tempo List | ❌ Tidak | Semua waktu — disengaja |

**Catatan:** Ketidakonsistenan pada Utang/Piutang dan Kas bisa disengaja (karena utang/piutang bersifat kumulatif). Namun **Chart Omzet** yang hardcode 7 hari jelas merupakan bug.

### 3.5 Bug #L4 — `beliSemua` dan `jualSemua` Tidak Digunakan 🟢 MINOR

**Lokasi:** line 2050-2051, 2072-2074

```javascript
const stats = {
  beliSemua: {total: 0},  // ← diinisialisasi & dihitung
  jualSemua: {total: 0},  // ← diinisialisasi & dihitung
  ...
};
```

Nilai `stats.beliSemua.total` dan `stats.jualSemua.total` dihitung di loop (line 2073-2074) tapi **tidak pernah ditampilkan** ke DOM. Ini dead computation.

**Solusi:** Hapus dari struktur stats atau tampilkan sebagai info tambahan.

---

## 4. RINGKASAN BUG

| No | Bug | Tingkat | Lokasi | Dampak |
|----|-----|---------|--------|--------|
| R1 | Pagination riwayatk tidak memperhitungkan filter | 🔴 Kritis | line 1892-1900 | Data terlewat saat filter aktif |
| R2 | `totalFiltered` dead code | 🟡 Sedroh | line 1903-1906 | Query tidak perlu, performa menurun |
| R3 | Tombol "Muat Lebih Banyak" muncul saat kosong | 🟡 Sedroh | line 1913-1918 | UX membingungkan |
| R4 | Void transaksi muncul di riwayatk | 🟡 Sedroh | line 1893-1900 | Data historis tidak akurat |
| L1 | Chart omzet hardcode 7 hari | 🔴 Kritis | line 2061-2065 | Filter periode tidak berpengaruh pada chart |
| L2 | Transaksi void tidak dikecualikan dari laporan | 🟡 Sedroh | line 2068-2093 | Laba & statistik tidak akurat |
| L3 | Ketidakonsistenan filter periode | 🟡 Sedroh | line 2160, 2176 | Konfusi user |
| L4 | `beliSemua`/`jualSemua` dead computation | 🟢 Minor | line 2050-2051 | Boros komputasi |

---

## 5. REKOMENDASI PRIORITAS

### 🔴 Prioritas Tinggi (Fix Segera)
1. **R1** — Perbaiki pagination riwayat agar filter diterapkan sebelum offset/limit
2. **L1** — Buat chart omzet dinamis mengikuti periode yang dipilih

### 🟡 Prioritas Menengah
3. **L2** — Tambahkan filter `t.void` di semua perhitungan laporan
4. **R4** — Tambahkan filter `t.void` di riwayat
5. **R3** — Hilangkan tombol "Muat Lebih Banyak" saat list kosong
6. **R2** — Hapus query `totalFiltered` yang tidak terpakai

### 🟢 Prioritas Rendah
7. **L4** — Hapus perhitungan `beliSemua`/`jualSemua` yang tidak dipakai
8. **L3** — Dokumentasikan/manfaatkan filter periode secara konsisten di semua komponen

---

*Audit dibuat oleh ZCode AI Assistant — 2026-08-01*
