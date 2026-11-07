import fs from 'fs';

function patch(path, jobs) {
  let s = fs.readFileSync(path, 'utf8');
  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  for (const [i, j] of jobs.entries()) {
    const from = j.from.replace(/\n/g, nl);
    const to = j.to.replace(/\n/g, nl);
    const n = s.split(from).length - 1;
    if (n !== 1) { console.log(`FAIL ${path}#${i}: kemunculan = ${n} (harus 1) -> ${j.from.slice(0, 60)}…`); process.exitCode = 1; continue; }
    s = s.replace(from, to);
    console.log(`ok   ${path}#${i}`);
  }
  fs.writeFileSync(path, s, 'utf8');
}

// ---------- index.html: kartu lockOverlay (class dobel + teks basi) ----------
patch('index.html', [
  {
    from: '<div class="license-title" id="lockOverlayTitle" class="kfs20 kmt8">Masa Coba Gratis Habis</div>',
    to: '<div class="license-title kfs20 kmt8" id="lockOverlayTitle">Lisensi Diperlukan</div>'
  },
  {
    from: '<p class="license-desc" id="lockOverlayDesc" class="kcenter">Silakan perpanjang masa coba dengan membagikan aplikasi ke teman, atau aktivasi lisensi resmi untuk melanjutkan.</p>',
    to: '<p class="license-desc kcenter" id="lockOverlayDesc">Pencatatan transaksi dibatasi. Beli lisensi resmi lewat QRIS — aktivasi otomatis setelah pembayaran diverifikasi — atau hubungi admin lewat WhatsApp.</p>'
  },
  // S&K clause 3: nama tombol harus sama dengan yang ada di Pengaturan
  {
    from: 'Gunakan <b>Cadangkan Data</b> (ekspor JSON',
    to: 'Gunakan <b>Simpan Cadangan</b> (ekspor JSON'
  },
  {
    from: 'Menekan <b>Hapus Data Pabrik</b> menghapus semua data',
    to: 'Menekan <b>Hapus Semua Data</b> menghapus semua data'
  }
]);

// ---------- pos.ui.js: empty-state menunjuk tombol yang sudah dihapus v153 ----------
patch('js/pos.ui.js', [
  {
    from: 'Ketuk "Tahan" di cart bar untuk menyimpan pesanan yang belum dibayar.',
    to: 'Ketuk 🤚 Tahan di bawah keranjang untuk menyimpan pesanan yang belum dibayar.'
  }
]);

// ---------- expensedetail.js: komentar JS di dalam template literal ikut tampil ----------
patch('js/expensedetail.js', [
  {
    from: `      // v165 (poin 6): salah catat tidak perlu dihapus-lalu-tulis-ulang lagi.
      // Tombol ini membuka form pencatatan yang sama dalam mode edit, lengkap
      // dengan pemilih tanggal — jadi nomor & jejak aslinya tetap terjaga.
`,
    to: `      <!-- v165 (poin 6): salah catat tidak perlu dihapus-lalu-tulis-ulang; tombol ini membuka form pencatatan yang sama dalam mode edit, lengkap dengan pemilih tanggal. -->
`
  }
]);

// ---------- DESIGN.md: jumlah poin S&K salah ----------
patch('DESIGN.md', [
  {
    from: '- **Isi**: 4 poin, termasuk kuota transaksi per bulan dan cadangan cloud khusus lisensi aktif.',
    to: '- **Isi**: 6 poin, termasuk kuota transaksi per bulan dan cadangan cloud khusus lisensi aktif.'
  }
]);
