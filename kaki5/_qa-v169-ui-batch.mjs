import fs from 'fs';

function patch(path, jobs) {
  let s = fs.readFileSync(path, 'utf8');
  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  let bad = 0;
  for (const [i, j] of jobs.entries()) {
    const from = j.from.replace(/\r\n/g, '\n').replace(/\n/g, nl);
    const to = j.to.replace(/\r\n/g, '\n').replace(/\n/g, nl);
    const n = s.split(from).length - 1;
    const want = j.count || 1;
    if (n !== want) { console.log(`FAIL ${path}#${i}: ketemu ${n}, harus ${want}  << ${j.from.slice(0, 55).replace(/\n/g, '\\n')}`); bad++; continue; }
    s = j.all ? s.split(from).join(to) : s.replace(from, to);
    console.log(`ok   ${path}#${i} (${n}x)`);
  }
  fs.writeFileSync(path, s, 'utf8');
  return bad;
}

let fail = 0;

// ── K2: "💬 Tanya Admin" → "💬 WhatsApp", hijau gelap ───────────────────
fail += patch('js/license.ui.js', [
  {
    from: `<button class="btn btn-secondary" data-action="contact-via-wa">💬 Tanya Admin</button>`,
    to: `<button class="btn btn-wa" data-action="contact-via-wa">💬 WhatsApp</button>`,
    count: 2, all: true
  }
]);

// ── K3: legend Omzet/Pengeluaran pindah ke BAWAH chart ──────────────────
fail += patch('js/laporan.js', [
  {
    from: `    <div style="display:flex;gap:12px;margin-bottom:8px;justify-content:center">
      <div style="display:flex;align-items:center;gap:4px;font-size:12px"><div style="width:12px;height:12px;border-radius:3px;background:var(--green-light)"></div>Omzet</div>
      <div style="display:flex;align-items:center;gap:4px;font-size:12px"><div style="width:12px;height:12px;border-radius:3px;background:var(--red-light)"></div>Pengeluaran</div>
    </div>
    <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
      <div class="chart-bars" style="min-width:\${nCols * 30}px">\${barsHtml}</div>
    </div>`,
    to: `    <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
      <div class="chart-bars" style="min-width:\${nCols * 30}px">\${barsHtml}</div>
    </div>
    <!-- Legenda di bawah batang (komentar browser #3, 2026-09-04): warna dulu
         dibaca setelah bentuknya, bukan sebelum. -->
    <div style="display:flex;gap:12px;margin-top:10px;justify-content:center">
      <div style="display:flex;align-items:center;gap:4px;font-size:12px"><div style="width:12px;height:12px;border-radius:3px;background:var(--green-light)"></div>Omzet</div>
      <div style="display:flex;align-items:center;gap:4px;font-size:12px"><div style="width:12px;height:12px;border-radius:3px;background:var(--red-light)"></div>Pengeluaran</div>
    </div>`
  }
]);

// ── K8: baris transaksi di kartu "Transaksi Ojol" → trigger modal detail ─
fail += patch('js/laporan.js', [
  {
    from: '          ${v.items.map(s => `<div class="trx-item" style="cursor:default">',
    to: '          ${v.items.map(s => `<div class="trx-item trx-detail-item" data-id="${s.id}">'
  }
]);

// ── K4: harga satuan pindah ke samping kanan nama menu ───────────────────
fail += patch('js/pos.ui.js', [
  {
    from: `          \`</span>
          \${toppingTags}`,
    to: `          \`</span>
          <span class="cart-name-price" title="Harga satuan">\${displayHargaTipe}</span>
          \${toppingTags}`
  },
  {
    from: `      <div class="cart-qty-price">
        <span class="cart-name-price" title="Harga satuan">\${displayHargaTipe}</span>
        <div class="qty-control">`,
    to: `      <div class="cart-qty-price">
        <div class="qty-control">`
  },
  // ── K9: sisa stok di pojok kiri atas kartu menu ───────────────────────
  {
    from: `      \${qty > 0 ? \`<div class="item-qty">\${qty}</div>\` : ''}
      <span class="item-emoji">`,
    to: `      \${qty > 0 ? \`<div class="item-qty">\${qty}</div>\` : ''}
      \${m.pakaiStok ? \`<div class="item-stok\${habis ? ' habis' : ''}" title="Sisa stok">\${m.stok || 0}</div>\` : ''}
      <span class="item-emoji">`
  }
]);

// ── K7 + T: reset tipe pesanan & gerbang kas saat halaman Jualan dibuka ──
fail += patch('js/pos.js', [
  {
    from: `export async function loadPOS() {
  await loadCart();`,
    to: `export async function loadPOS() {
  await loadCart();
  // Komentar browser #7 (2026-09-04): setiap halaman Jualan dibuka, tipe
  // pesanan kembali ke Dine-in — SELAMA keranjang kosong. Keranjang berisi
  // tidak disentuh karena mengganti tipe akan menulis ulang tipe item yang
  // sudah ada di dalamnya (lihat migrasi cart di pos.ui.js).
  if (orderType !== 'dine-in' && Object.keys(cart).length === 0) {
    setOrderType('dine-in');
    try { localStorage.setItem('kasirsolo:order-type', 'dine-in'); } catch (_) {}
  }`
  },
  {
    from: `  // Refresh FAB "Tahan" — tampilkan badge sesuai jumlah held aktif (v148).
  refreshHeldFab();
}`,
    to: `  // Refresh FAB "Tahan" — tampilkan badge sesuai jumlah held aktif (v148).
  refreshHeldFab();
  // Gerbang kas dipindah ke sini (permintaan 2026-09-04): modal "Buka Kas"
  // muncul begitu tab Jualan ditekan, bukan saat "Bayar" — jadi laci sudah
  // punya modal awal sebelum item apa pun masuk keranjang. Guard di
  // simpanPenjualan SENGAJA dibiarkan sebagai jaring pengaman (shift bisa
  // saja ditutup dari perangkat lain sambil halaman ini terbuka).
  try {
    if (await fiturKasAktif() && !(await getOpenShift())) openBukaKasModal();
  } catch (e) { console.warn('[POS] gerbang kas dilewati:', e?.message || e); }
}`
  }
]);

// ── K7 (sisa): boot tidak boleh memulihkan tipe order terakhir ────────────
fail += patch('js/app.js', [
  {
    from: `  // Topping/Ojol: pulih tipe order terakhir dari localStorage
  try {
    const saved = localStorage.getItem('kasirsolo:order-type');
    if (saved && ['dine-in','takeaway','ojol'].includes(saved)) {
      setOrderType(saved);
    }
  } catch (_) {}`,
    to: `  // Tipe order TIDAK dipulihkan lagi dari localStorage (permintaan
  // 2026-09-04): halaman Jualan selalu dibuka dalam keadaan Dine-in.
  // loadPOS() yang menjaga nilainya, termasuk saat keranjang kosong.`
  }
]);

// ── K5: lebar baris keranjang disesuaikan ────────────────────────────────
fail += patch('css/style.css', [
  { from: '.cart-name-price{margin-left:6px;font-size:12px;font-weight:600;color:var(--text2);white-space:nowrap}', to: '.cart-name-price{margin-left:0;flex:0 0 auto;font-size:12px;font-weight:600;color:var(--text2);white-space:nowrap}', count: 2, all: true },
  { from: '.cart-qty-price{display:flex;align-items:center;gap:8px;flex-shrink:0}', to: '.cart-qty-price{display:flex;align-items:center;gap:6px;flex-shrink:0}', count: 2, all: true },
  { from: '.cart-price{font-weight:700;color:var(--primary);font-size:15px;min-width:75px;text-align:right;white-space:nowrap}', to: '.cart-price{font-weight:700;color:var(--primary);font-size:15px;min-width:68px;text-align:right;white-space:nowrap}', count: 2, all: true },
  { from: '.cart-qty-price{display:flex;align-items:center;gap:10px;flex-shrink:0}', to: '.cart-qty-price{display:flex;align-items:center;gap:6px;flex-shrink:0}' }
]);

console.log(fail ? `\n${fail} operasi GAGAL` : '\nsemua operasi masuk');
process.exitCode = fail ? 1 : 0;
