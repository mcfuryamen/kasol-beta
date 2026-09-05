// ==================== LAPORAN (ESM) ====================
import { DB } from './db.js';
import { escapeHtml, formatRp, formatDate, formatTime, todayStr, addDays, dayName, getWeekRange, getMonthRange, showLoading, showToast, statSizeClass } from './helpers.js';
import { reportPeriod, setReportPeriod, reportDate, setReportDate, customStart, customEnd, setCustomStart, setCustomEnd } from './app-state.js';
// v164: Laba Laporan memakai fungsi yang sama dengan Beranda & tutup buku
// (satu sumber kebenaran), plus label metode untuk tiap catatan.
import { hitungLaba, pisahkanCatatan, metodeCatatan, isNonLaba, METODE_LABEL } from './kas.logic.js';

let _customPickerOpen = false;
let _dateNavOpen = false; // v178: akordeon date picker — default tertutup, dibuka dari tab periode

// v164: satu baris keterangan untuk catatan pengeluaran/pemasukan — nomor,
// tanggal/waktu, metode kalau tidak lewat laci, dan penanda kalau kategorinya
// non-usaha sehingga tidak memotong/menambah Laba.
function subCatatan(e, denganTanggal) {
  const metode = metodeCatatan(e);
  const parts = [];
  if (e.nomor) parts.push(String(e.nomor));
  if (denganTanggal && e.tanggal) parts.push(formatDate(e.tanggal));
  parts.push(formatTime(e.waktu));
  let sub = parts.join(' · ');
  if (metode !== 'tunai') sub += ' · ' + (METODE_LABEL[metode] || metode);
  if (isNonLaba(e)) sub += ' · di luar Laba';
  return sub;
}

// ── Delegasi klik laporan (CSP-friendly, tanpa inline onclick) ──
// Render memakai atribut data-* (data-date, data-start-date, data-month-date,
// data-catid, .expense-detail-item/.trx-detail-item dengan data-id). Satu
// listener per kontainer, dipasang sekali oleh loadReport().
let _reportDelegationAttached = false;
function ensureReportDelegation() {
  if (_reportDelegationAttached) return;
  const nav = document.getElementById('reportDateNav');
  const content = document.getElementById('reportContent');
  if (!nav || !content) return;
  const handler = async (e) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    try {
      const el =
        t.closest('.toggle-custom-picker-btn') ||
        t.closest('[data-delta]') ||
        t.closest('[data-custom-date]') ||
        t.closest('[data-date]') ||
        t.closest('[data-start-date]') ||
        t.closest('[data-month-date]') ||
        t.closest('[data-catid]') ||
        t.closest('[data-konspid]') ||
        t.closest('[data-tglid]') ||
        t.closest('.expense-detail-item[data-id]') ||
        t.closest('.trx-detail-item[data-id]');
      if (!el) return;
      if (el.classList.contains('toggle-custom-picker-btn')) return toggleCustomPicker();
      if (el.dataset.delta) return navReportDate(Number(el.dataset.delta));
      if (el.dataset.customDate) return pickCustomDate(el.dataset.side || 'start', el.dataset.customDate);
      if (el.dataset.date) return pickDate(el.dataset.date);
      if (el.dataset.startDate) return pickWeek(el.dataset.startDate);
      if (el.dataset.monthDate) return pickMonth(el.dataset.monthDate);
      if (el.dataset.konspid) return toggleKonsp(el.dataset.konspid);
      if (el.dataset.catid) return toggleExpenseCat(el.dataset.catid);
      if (el.dataset.tglid) return toggleTrxDay(el.dataset.tglid);
      const id = Number(el.dataset.id);
      if (!Number.isFinite(id)) return;
      if (el.classList.contains('expense-detail-item')) {
        const m = await import('./expensedetail.js');
        m.showExpenseDetail(id);
      } else if (el.classList.contains('trx-detail-item')) {
        const m = await import('./trxdetail.js');
        m.showTrxDetail(id);
      }
    } catch (err) {
      console.error('[LAPORAN] click delegation:', err?.message || err);
    }
  };
  nav.addEventListener('click', handler);
  content.addEventListener('click', handler);
  _reportDelegationAttached = true;
}

export function setReportPeriodUI(p) {
  const sameTab = reportPeriod === p; // baca SEBELUM setter mengganti nilai
  setReportPeriod(p);
  document.querySelectorAll('.report-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.period === p);
  });
  // v178: date picker = akordeon, trigger dari tab periode — tab aktif diklik lagi menutupnya
  _dateNavOpen = sameTab ? !_dateNavOpen : true;
  loadReport();
}

export async function loadReport() {
  ensureReportDelegation();
  await renderReportDateNav();
  const load = showLoading('reportContent', 6); // skeleton while querying chart data
  try {
    let dateRange;
    if (reportPeriod === 'harian') {
      dateRange = { start: reportDate, end: reportDate };
    } else if (reportPeriod === 'mingguan') {
      dateRange = getWeekRange(reportDate);
    } else if (reportPeriod === 'bulanan') {
      dateRange = getMonthRange(reportDate);
    } else {
      // custom — rentang bebas pilihan user
      dateRange = { start: customStart, end: customEnd };
    }

    // v156: kecualikan row status 'held' — pesanan ditahan BELUM terjual,
    // jangan ikut omzet/transaksi/porsi/riwayat (bug lama sejak fitur held).
    const sales = (await DB.penjualan.where('tanggal').between(dateRange.start, dateRange.end, true, true).toArray()).filter(s => s.status !== 'held');
    const expenses = await DB.pengeluaran.where('tanggal').between(dateRange.start, dateRange.end, true, true).toArray();

  // Pemasukan lain disimpan di tabel yang sama dengan jenis:'pemasukan' —
  // pisahkan agar tidak terhitung sebagai pengeluaran.
  const { expenses: expOnly, incomes: incOnly } = pisahkanCatatan(expenses);

  let omzet = 0, modal = 0, totalQty = 0;
  const menuStats = {};
  sales.forEach(s => {
    omzet += s.totalHarga || 0;
    modal += s.totalModal || 0;
    if (s.items) s.items.forEach(i => {
      totalQty += i.qty || 0;
      const qty = i.qty || 0, price = i.hargaJual || 0;
      if (!menuStats[i.nama]) menuStats[i.nama] = { qty: 0, total: 0 };
      menuStats[i.nama].qty += qty;
      menuStats[i.nama].total += qty * price;
    });
  });

  // v164: Laba memakai fungsi yang sama dengan Beranda & tutup buku. Kategori
  // non-usaha (Modal Tambahan / Setor Bank / Prive) dikecualikan dari Laba tapi
  // tetap muncul di rincian — dijumlahkan terpisah, bukan dibuang diam-diam.
  const L = hitungLaba({ omzet, totalModal: modal, expenses: expOnly, incomes: incOnly });
  const totalExp = L.expenseLaba;   // biaya usaha (masuk Laba)
  const totalInc = L.incomeLaba;    // pemasukan usaha (masuk Laba)
  const sumRows = rows => (rows || []).reduce((a, r) => a + (Number(r.jumlah) || 0), 0);
  const expSemua = sumRows(expOnly); // dasar persentase rincian (semua kategori)
  const incSemua = sumRows(incOnly);
  const nonLabaTotal = L.nonLabaKeluar + L.nonLabaMasuk;
  const profit = L.laba;
  const marginPct = omzet > 0 ? Math.round(((omzet - modal) / omzet) * 100) : 0;

  // Ojol: transaksi dengan tipe order 'ojol', digroup per platform preset
  const ojolSales = sales.filter(s => s.orderType === 'ojol');
  const ojolTotal = ojolSales.reduce((a,s) => a + (s.totalHarga || 0), 0);

  let html = '';

  // Summary cards
  // v178: kartu KPI Laporan memakai palet gradasi ala Beranda (kbg-*-b = gradasi
  // + teks putih otomatis), warna mengikuti konteks data tiap kartu:
  // hijau = pendapatan, oranye = volume/komponen, merah = biaya (dan rugi),
  // biru = laba sehat & uang non-usaha.
  html += `<div class="stat-grid">
    <div class="stat-card kbg-green-b">
      <div class="stat-label">💰 Omzet</div>
      <div class="stat-value${statSizeClass(omzet + totalInc)}">${formatRp(omzet + totalInc)}</div>
    </div>
    <div class="stat-card kbg-orange-b">
      <div class="stat-label">🧮 Modal Bahan</div>
      <div class="stat-value${statSizeClass(modal)}">${formatRp(modal)}</div>
    </div>
    <div class="stat-card kbg-red-b">
      <div class="stat-label">💸 Biaya Usaha</div>
      <div class="stat-value${statSizeClass(totalExp)}">${formatRp(totalExp)}</div>
    </div>
    <div class="stat-card ${profit>=0?'kbg-blue-b':'kbg-red-b'}">
      <div class="stat-label">📈 Untung Bersih</div>
      <div class="stat-value${statSizeClass(profit)}">${formatRp(profit)}</div>
    </div>
    <div class="stat-card kbg-orange-b">
      <div class="stat-label">🛒 Transaksi</div>
      <div class="stat-value">${sales.length}</div>
    </div>
    <div class="stat-card kbg-orange-b">
      <div class="stat-label">🍽️ Porsi Terjual</div>
      <div class="stat-value">${totalQty}</div>
    </div>
    <div class="stat-card kbg-purple-b">
      <div class="stat-label">💵 Pemasukan Usaha</div>
      <div class="stat-value${statSizeClass(totalInc)}">${formatRp(totalInc)}</div>
    </div>
    ${nonLabaTotal > 0 ? `<div class="stat-card kbg-blue-b">
      <div class="stat-label">🏧 Non-Usaha (laci)</div>
      <div class="stat-value${statSizeClass(nonLabaTotal)}">${formatRp(nonLabaTotal)}</div>
    </div>` : ''}
    <div class="stat-card kbg-orange-b">
      <div class="stat-label">🛵 Ojol</div>
      <div class="stat-value${statSizeClass(ojolTotal)}">${formatRp(ojolTotal)}</div>
    </div>
  </div>`;

  // Margin
  html += `<div class="card kcenter">
    <div class="card-title" style="justify-content:center">📊 Margin Kotor</div>
    <div style="background:#f5f5f5;border-radius:10px;height:24px;overflow:hidden;margin-bottom:8px">
      <div style="background:${marginPct>30?'var(--green)':marginPct>15?'var(--primary)':'var(--red)'};height:100%;width:${marginPct}%;border-radius:10px;transition:width .5s"></div>
    </div>
    <div style="font-size:20px;font-weight:800;color:${marginPct>30?'var(--green)':marginPct>15?'var(--primary)':'var(--red)'}">${marginPct}%</div>
  </div>`;

  // Chart for weekly/monthly (uses already-fetched sales/expenses — no N+1).
  // v160 (komentar browser #4): periode Harian dulu tidak punya grafik sama
  // sekali — slot kosong itu sekarang diisi grafik omzet vs pengeluaran PER JAM.
  if (reportPeriod !== 'harian') {
    html += await renderChart(dateRange, reportPeriod, sales, expOnly);
  } else {
    html += renderHourlyChart(sales, expOnly, reportDate);
  }

  // Top menu
  const sortedMenus = Object.entries(menuStats).sort((a,b) => b[1].qty - a[1].qty).slice(0, 5);
  if (sortedMenus.length > 0) {
    html += '<div class="card"><div class="card-title">🏆 Menu Paling Laris</div>';
    sortedMenus.forEach(([name, stat], i) => {
      html += `<div class="top-menu-item">
        <div class="top-rank">${i+1}</div>
        <div class="top-menu-info">
          <div class="top-menu-name">${escapeHtml(name)}</div>
          <div class="top-menu-stat">${stat.qty} porsi terjual</div>
        </div>
        <div class="top-menu-total">${formatRp(stat.total)}</div>
      </div>`;
    });
    html += '</div>';
  }

  // 🛵 Laporan Ojol — group per platform preset (GoFood/GrabFood/ShopeeFood/
  // Maxim/Lainnya), akordeon ala rincian pengeluaran: header platform expand
  // daftar transaksinya. Record lama tanpa platform masuk 'Lainnya'.
  if (ojolSales.length > 0) {
    const byPlatform = {};
    ojolSales.forEach(s => {
      const p = s.ojolPlatform || 'Lainnya';
      if (!byPlatform[p]) byPlatform[p] = { n: 0, total: 0, items: [] };
      byPlatform[p].n++;
      byPlatform[p].total += s.totalHarga || 0;
      byPlatform[p].items.push(s);
    });
    let ojolHtml = '<div class="card"><div class="card-title">🛵 Transaksi Ojol</div>';
    Object.entries(byPlatform).sort((a,b) => b[1].total - a[1].total).forEach(([p, v], idx) => {
      const pid = `ojolp-${idx}`;
      ojolHtml += `<div class="kmt12">
        <div data-catid="${pid}" class="trx-day-header" style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 14px;background:var(--orange-bg);border-radius:12px;margin-bottom:6px;cursor:pointer;user-select:none">
          <div class="kfw800 kfs14">🛵 ${escapeHtml(p)}</div>
          <div class="kright" style="display:flex;align-items:center;gap:10px">
            <div class="kfw800 kfs13 kprimary">${formatRp(v.total)}</div>
            <span id="${pid}-arrow" style="font-size:18px;color:var(--text3);transition:transform .2s;display:inline-block">›</span>
          </div>
        </div>
        <div id="${pid}" class="trx-day-panel" style="display:none;padding-left:8px;border-left:2px solid var(--orange-bg);margin-bottom:8px">
          ${v.items.map(s => `<div class="trx-item trx-detail-item" data-id="${s.id}">
            <div class="trx-icon" style="background:var(--orange-bg);color:var(--primary)">🛒</div>
            <div class="trx-info">
              <div class="trx-title">${escapeHtml(formatTime(s.waktu))}${s.orderNote ? ' · ' + escapeHtml(s.orderNote) : ''}</div>
              <div class="trx-sub">${(s.items || []).reduce((a,i) => a + (i.qty || 0), 0)} porsi · ${escapeHtml(s.orderType || 'ojol')} · ${({tunai:'💵',qris:'📱 QRIS',transfer:'🏦 Transfer'})[s.metodeBayar] || '💵'}</div>
            </div>
            <div class="trx-amount" style="color:var(--orange)">${formatRp(s.totalHarga || 0)}</div>
          </div>`).join('')}
        </div>
      </div>`;
    });
    ojolHtml += `<div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;font-weight:800;font-size:14px">
      <span>Total Ojol · ${ojolSales.length} trx</span>
      <span style="color:var(--primary)">${formatRp(ojolTotal)}</span>
    </div></div>`;
    html += ojolHtml;
  }

  // Expense breakdown by category with accordion (expandable transaction list)
  if (expOnly.length > 0) {
    const expCats = {};
    const expCatItems = {}; // kategori -> array of expense objects
    expOnly.forEach(e => {
      if (!expCats[e.kategori]) {
        expCats[e.kategori] = 0;
        expCatItems[e.kategori] = [];
      }
      expCats[e.kategori] += e.jumlah;
      expCatItems[e.kategori].push(e);
    });
    const catEmoji = {'Bahan Baku':'🥬','Gas & BBM':'⛽','Sewa Tempat':'🏪','Peralatan':'🍳','Setoran Konsinyasi':'🤝','Retur Konsinyasi':'↩️','Setor Bank / Prive':'🏧','Lainnya':'📦'};
    html += '<div class="card"><div class="card-title">💸 Rincian Pengeluaran</div>';
    
    Object.entries(expCats).sort((a,b) => b[1]-a[1]).forEach(([cat, total]) => {
      const pct = expSemua > 0 ? Math.round((total/expSemua)*100) : 0;
      const catId = `expCat-${escapeHtml(cat).replace(/\s+/g,'')}`;
      
      // Category header (clickable to expand/collapse)
      html += `<div>
        <div data-catid="${catId}" class="expense-cat-item" style="display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid var(--border);cursor:pointer">
          <span class="kfs20">${escapeHtml(catEmoji[cat]||'📦')}</span>
          <div class="kflex-1">
            <div class="kfw600 kfs14">${escapeHtml(cat)}</div>
            <div style="background:#f5f5f5;border-radius:6px;height:8px;margin-top:4px;overflow:hidden">
              <div style="background:var(--red-light);height:100%;width:${pct}%;border-radius:6px"></div>
            </div>
          </div>
          <div class="kright">
            <div class="kfw800 kfs14 kred">${formatRp(total)}</div>
            <div style="font-size:11px;color:var(--text3)">${pct}%</div>
          </div>
          <span id="${catId}-arrow" style="font-size:18px;color:var(--text3);transition:transform .2s">›</span>
        </div>
        
        <div id="${catId}" style="display:none;padding-left:32px;border-bottom:1px solid var(--border)">`;
      
        // Daftar transaksi kategori ini — SEMUA periode. (Dulu hanya dirender
        // untuk 'harian'; di mingguan/bulanan/custom panel terbuka tapi kosong
        // sehingga akordeon tampak tidak mau membuka. Laporan user 2026-08-17.)
        expCatItems[cat]
          .sort((a, b) => String(b.tanggal || '').localeCompare(String(a.tanggal || '')) || (b.waktu || 0) - (a.waktu || 0))
          .forEach(e => {
            const sub = subCatatan(e, reportPeriod !== 'harian');
            html += `<div class="trx-item expense-detail-item" data-id="${e.id}" style="padding:10px 0;gap:10px">
            <div style="width:12px;height:12px;background:var(--red-light);border-radius:50%;flex-shrink:0"></div>
            <div class="trx-info kflex-1">
              <div class="trx-title kfs13">${escapeHtml(e.keterangan)}</div>
              <div class="trx-sub kfs11">${escapeHtml(sub)}</div>
            </div>
            <div class="trx-amount red kfs13">-${formatRp(e.jumlah)}</div>
          </div>`;
          });
      
      html += `</div></div>`;
    });
    
    html += '</div>';
  }

  // v160 (audit pemasukan): pemasukan dulu HANYA jadi satu angka di kartu
  // statistik — tidak pernah muncul di daftar mana pun, jadi salah catat tidak
  // bisa dikoreksi. Sekarang ada rincian per kategori; tiap barisnya memakai
  // class .expense-detail-item sehingga klik membuka detail + hapus.
  if (incOnly.length > 0) {
    const incCats = {};
    const incCatItems = {};
    incOnly.forEach(e => {
      if (!incCats[e.kategori]) {
        incCats[e.kategori] = 0;
        incCatItems[e.kategori] = [];
      }
      incCats[e.kategori] += e.jumlah;
      incCatItems[e.kategori].push(e);
    });
    const incEmoji = {'Pemasukan Lain':'💰','Penjualan Non-Menu':'🛍️','Bonus / Cashback':'🎁','Modal Tambahan':'🏦','Lainnya':'📦'};
    html += '<div class="card"><div class="card-title">💰 Rincian Pemasukan</div>';

    Object.entries(incCats).sort((a,b) => b[1]-a[1]).forEach(([cat, total]) => {
      const pct = incSemua > 0 ? Math.round((total/incSemua)*100) : 0;
      const catId = `incCat-${escapeHtml(cat).replace(/\s+/g,'')}`;
      html += `<div>
        <div data-catid="${catId}" class="expense-cat-item" style="display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid var(--border);cursor:pointer">
          <span class="kfs20">${escapeHtml(incEmoji[cat]||'💰')}</span>
          <div class="kflex-1">
            <div class="kfw600 kfs14">${escapeHtml(cat)}</div>
            <div style="background:#f5f5f5;border-radius:6px;height:8px;margin-top:4px;overflow:hidden">
              <div style="background:var(--green-light);height:100%;width:${pct}%;border-radius:6px"></div>
            </div>
          </div>
          <div class="kright">
            <div class="kfw800 kfs14 kgreen">${formatRp(total)}</div>
            <div style="font-size:11px;color:var(--text3)">${pct}%</div>
          </div>
          <span id="${catId}-arrow" style="font-size:18px;color:var(--text3);transition:transform .2s">›</span>
        </div>

        <div id="${catId}" style="display:none;padding-left:32px;border-bottom:1px solid var(--border)">`;

        incCatItems[cat]
          .sort((a, b) => String(b.tanggal || '').localeCompare(String(a.tanggal || '')) || (b.waktu || 0) - (a.waktu || 0))
          .forEach(e => {
            const sub = subCatatan(e, reportPeriod !== 'harian');
            html += `<div class="trx-item expense-detail-item" data-id="${e.id}" style="padding:10px 0;gap:10px">
            <div style="width:12px;height:12px;background:var(--green-light);border-radius:50%;flex-shrink:0"></div>
            <div class="trx-info kflex-1">
              <div class="trx-title kfs13">${escapeHtml(e.keterangan)}</div>
              <div class="trx-sub kfs11">${escapeHtml(sub)}</div>
            </div>
            <div class="trx-amount green kfs13">+${formatRp(e.jumlah)}</div>
          </div>`;
          });

        html += `</div></div>`;
    });

    html += `<div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;font-weight:800;font-size:14px">
      <span>Total Pemasukan · ${incOnly.length} catatan</span>
      <span style="color:var(--green)">${formatRp(incSemua)}</span>
    </div>`;
    if (L.nonLabaMasuk > 0) {
      html += `<div class="hint" style="margin-top:6px">Termasuk ${formatRp(L.nonLabaMasuk)} kategori non-usaha (mis. Modal Tambahan) yang mengisi laci tapi TIDAK menambah Laba.</div>`;
    }
    html += '</div>';
  }

  // ── Blok Kas (v161): riwayat buka/tutup shift ─────────────────────────
  // v165: hanya kartu riwayat shift yang di sini. Kartu "Tutup Buku Tahunan"
  // dipindah ke paling bawah halaman (lihat akhir fungsi ini).
  // Sengaja lewat dynamic import: kas.js memuat laporan.js saat refresh,
  // siklus impor statis akan membuat salah satu modul undefined saat boot.
  try {
    const kas = await import('./kas.js');
    html += await kas.kasReportBlocksHtml();
  } catch (e) {
    console.warn('[LAPORAN] blok kas gagal:', e?.message || e);
  }

  // ── Blok Konsinyasi ──────────────────────────────────────────────────────
  // SALDO konsinyasi (utang ke suplayer + setoran) adalah konsep SEJAK AWAL,
  // bukan per periode. Dulu dihitung dari `sales`/`expenses` yang sudah
  // difilter rentang tanggal laporan, sehingga menggeser filter tanggal
  // mengubah-ubah angka "Lunas": lihat hari tanpa penjualan → utang 0 dan
  // setoran 0 → sisa 0 → suplayer tampil LUNAS padahal masih punya sisa
  // tagihan. Koreksi retur (m.selisihQty) juga akumulatif tanpa tanggal, jadi
  // memang mustahil di-scope per periode. Yang tetap mengikuti filter periode
  // hanyalah angka "terjual" per menu, ditampilkan sebagai info tambahan.
  const allMenus = await DB.menu.toArray();
  const titipan = allMenus.filter(m => m.suplayer && m.suplayer !== 'Umum');
  if (titipan.length > 0) {
    // Terjual SEJAK AWAL — dasar utang ke suplayer.
    const allSales = (await DB.penjualan.toArray()).filter(s => s.status !== 'held'); // v156: held belum terjual
    const terjualAllPerMenu = {};
    allSales.forEach(s => {
      (s.items || []).forEach(i => { terjualAllPerMenu[i.menuId] = (terjualAllPerMenu[i.menuId] || 0) + (i.qty || 0); });
    });
    // Terjual dalam periode terpilih — info pergerakan stok, bukan dasar utang.
    const terjualPerMenu = {};
    sales.forEach(s => {
      (s.items || []).forEach(i => { terjualPerMenu[i.menuId] = (terjualPerMenu[i.menuId] || 0) + (i.qty || 0); });
    });
    // Setoran per suplayer — SEMUA setoran, tidak ikut difilter periode.
    const setorPerSuplayer = {};
    const allSetor = await DB.pengeluaran.where('kategori').equals('Setoran Konsinyasi').toArray();
    allSetor.forEach(e => {
      const sp = e.keterangan?.match(/^Setoran (.+?) ·/)?.[1] || e.suplayer || 'Lainnya';
      setorPerSuplayer[sp] = (setorPerSuplayer[sp] || 0) + (e.jumlah || 0);
    });

    // Group per suplayer
    const bySuplayer = {};
    titipan.forEach(m => {
      const sp = m.suplayer || 'Lainnya';
      if (!bySuplayer[sp]) bySuplayer[sp] = [];
      bySuplayer[sp].push(m);
    });

    // Agregat per suplayer. Keluar efektif per menu = penjualan tercatat sejak
    // awal + selisihQty (koreksi dari retur: barang hilang/lebih dianggap
    // keluar), sehingga utang & nominal setoran akurat berdasarkan barang yang
    // benar-benar keluar dari rak — dan TETAP saat filter tanggal diubah.
    const suplayerStats = Object.entries(bySuplayer).map(([sp, items]) => {
      let terjual = 0, terjualPeriode = 0, utang = 0, stok = 0;
      items.forEach(m => {
        const keluar = (terjualAllPerMenu[m.id] || 0) + (m.selisihQty || 0);
        terjual += keluar;
        terjualPeriode += terjualPerMenu[m.id] || 0;
        utang += keluar * (m.hargaModal || 0);
        stok += m.pakaiStok ? (m.stok || 0) : 0;
      });
      const setor = setorPerSuplayer[sp] || 0;
      return { sp, items, terjual, terjualPeriode, utang, stok, setor, sisa: utang - setor };
    });

    let konsoHtml = '<div class="card"><div class="card-title">🤝 Konsinyasi</div>'
      + '<div class="trx-sub kfs11" style="margin:-2px 0 4px">Saldo &amp; status lunas dihitung sejak awal (tidak berubah saat filter tanggal diganti) · terjual per menu mengikuti periode terpilih</div>';
    suplayerStats.forEach((s, idx) => {
      const konspId = `konsp-${idx}`;
      const lunas = s.sisa <= 0;
      konsoHtml += `<div class="kmt12">
        <div data-konspid="${konspId}" class="trx-day-header" style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 14px;background:var(--orange-bg);border-radius:12px;margin-bottom:6px;cursor:pointer;user-select:none">
          <div class="kfw800 kfs14">🤝 ${escapeHtml(s.sp)}</div>
          <div class="kright" style="display:flex;align-items:center;gap:10px">
            <div class="kfw800 kfs13 ${lunas ? 'kgreen' : 'kprimary'}">${lunas ? 'Lunas' : formatRp(s.sisa)}</div>
            <span id="${konspId}-arrow" style="font-size:18px;color:var(--text3);transition:transform .2s;display:inline-block">›</span>
          </div>
        </div>
        <div id="${konspId}" class="trx-day-panel" style="display:none;padding-left:8px;border-left:2px solid var(--orange-bg);margin-bottom:8px">
          ${s.items.map(m => {
            const keluar = (terjualAllPerMenu[m.id] || 0) + (m.selisihQty || 0);
            const periode = terjualPerMenu[m.id] || 0;
            const stokSub = m.pakaiStok ? ` · stok ${m.stok || 0}` : '';
            const periodeSub = periode > 0 ? ` · ${periode} di periode ini` : '';
            const catatan = m.catatanSelisih
              ? `<div class="trx-sub" style="color:var(--orange)">📝 ${escapeHtml(m.catatanSelisih)}</div>`
              : '';
            return `<div class="trx-item" style="cursor:default">
              <div class="trx-icon" style="background:var(--orange-bg);color:var(--primary)">🧾</div>
              <div class="trx-info">
                <div class="trx-title">${escapeHtml(m.nama)}</div>
                <div class="trx-sub">${keluar} terjual sejak awal${stokSub}${periodeSub}</div>
                ${catatan}
              </div>
              <div class="trx-amount" style="color:var(--orange)">${formatRp(keluar * (m.hargaModal || 0))}</div>
            </div>`;
          }).join('')}
          <div style="display:flex;gap:8px;padding-top:8px">
            <button class="btn btn-secondary" style="flex:1;height:38px;min-height:38px;font-size:12px" data-action="retur-konsinyasi" data-suplayer="${escapeHtml(s.sp)}">↩️ Retur</button>
            <button class="btn btn-primary" style="flex:1;height:38px;min-height:38px;font-size:12px" data-action="setor-konsinyasi" data-suplayer="${escapeHtml(s.sp)}" data-utang="${s.sisa}">💰 Setor</button>
          </div>
        </div>
      </div>`;
    });
    konsoHtml += '</div>';
    html += konsoHtml;
  }

  // Riwayat transaksi — dipisahkan/di-group per Hari & Tanggal
  if (sales.length > 0) {
    // Group by tanggal (YYYY-MM-DD)
    const byDay = {};
    sales.forEach(s => {
      if (!byDay[s.tanggal]) byDay[s.tanggal] = [];
      byDay[s.tanggal].push(s);
    });
    const dates = Object.keys(byDay).sort().reverse(); // terbaru dulu

    html += '<div class="card"><div class="card-title">📝 Riwayat Transaksi</div>';
    // Tanggal aktif: yang sedang dipilih user (period=harian → reportDate;
    // period lain → tanggal 'tglAktif' = todayStr atau rentang center).
    // Kita buka otomatis hanya tanggal yang match dengan reportDate (saat
    // period=harian) atau hari ini (period lain) agar UX tetap informatif;
    // tanggal lain default collapse supaya daftar tidak terlalu panjang.
    const today = todayStr();
    const activeDay = reportPeriod === 'harian' ? reportDate : today;
    dates.forEach(tgl => {
      const items = byDay[tgl].sort((a, b) => b.waktu - a.waktu);
      const daySum = items.reduce((a, s) => a + (s.totalHarga || 0), 0);
      // ID aman untuk DOM: ganti dash dengan empty (YYYYMMDD) + prefix tglDay-
      const tglId = 'trxDay-' + tgl.replace(/-/g, '');
      const isOpen = (tgl === activeDay);
      html += `<div class="kmt12">
        <div data-tglid="${tglId}" class="trx-day-header" style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 14px;background:var(--orange-bg);border-radius:12px;margin-bottom:6px;cursor:pointer;user-select:none">
          <div class="kfw800 kfs14">📅 ${escapeHtml(dayName(tgl))}, ${escapeHtml(formatDate(tgl))}</div>
          <div class="kright" style="display:flex;align-items:center;gap:10px">
            <div class="kfw800 kfs13 kprimary">${formatRp(daySum)} · ${items.length} trx</div>
            <span id="${tglId}-arrow" style="font-size:18px;color:var(--text3);transition:transform .2s;display:inline-block;${isOpen ? 'transform:rotate(90deg)' : ''}">›</span>
          </div>
        </div>
        <div id="${tglId}" class="trx-day-panel" style="display:${isOpen ? 'block' : 'none'};padding-left:8px;border-left:2px solid var(--orange-bg);margin-bottom:8px">`;
      items.forEach(s => {
        const itemNames = s.items ? s.items.map(i => `${escapeHtml(i.nama)}×${i.qty}`).join(', ') : '';
        const noteLine = s.orderNote ? `<div class="trx-sub">📝 ${escapeHtml(s.orderNote)}</div>` : ''; // v157 #4: isi catatan di baris baru
        const PAY_SHORT = { tunai: '💵', qris: '📱 QRIS', transfer: '🏦 Transfer' };
        const paySub = ' · ' + (PAY_SHORT[s.metodeBayar] || '💵');
        html += `<div class="trx-item trx-detail-item" data-id="${s.id}">
          <div class="trx-icon sale">🛒</div>
          <div class="trx-info"><div class="trx-title">${itemNames}</div><div class="trx-sub">${s.nomor ? escapeHtml(s.nomor) + ' · ' : ''}${escapeHtml(formatTime(s.waktu))}${paySub}</div>${noteLine}</div>
          <div class="trx-amount green">${formatRp(s.totalHarga)}</div>
        </div>`;
      });
      html += '</div></div>';
    });
    html += '</div>';
  }

  // ── Kartu Tutup Buku Tahunan — paling bawah (v165, komentar UI #7) ──────
  // Dibaca terakhir karena ini PENUTUP pembukuan satu tahun, bukan bagian dari
  // laporan harian yang sedang dilihat user di atasnya.
  try {
    const kas = await import('./kas.js');
    html += await kas.kasTutupBukuBlockHtml();
  } catch (e) {
    console.warn('[LAPORAN] blok tutup buku gagal:', e?.message || e);
  }

  document.getElementById('reportContent').innerHTML = html;
  } catch (err) {
    console.error('[Report] load error:', err);
    showToast('Gagal memuat laporan. Coba lagi.', 'error');
  } finally {
    load.done();
  }
}

async function renderChart(range, period, sales, expenses) {
  // Build lookup maps once — O(n) instead of N+1 queries
  const dayIncome = {};   // 'YYYY-MM-DD' -> total income
  const dayExpense = {};  // 'YYYY-MM-DD' -> total expense
  sales.forEach(s => {
    dayIncome[s.tanggal] = (dayIncome[s.tanggal] || 0) + s.totalHarga;
  });
  expenses.forEach(e => {
    dayExpense[e.tanggal] = (dayExpense[e.tanggal] || 0) + e.jumlah;
  });
  const dayTotal = (map, d) => map[d] || 0;

  let labels = [], incomeData = [], expenseData = [];
  if (period === 'mingguan') {
    let d = range.start;
    while (d <= range.end) {
      labels.push(dayName(d).substring(0,3));
      incomeData.push(dayTotal(dayIncome, d));
      expenseData.push(dayTotal(dayExpense, d));
      d = addDays(d, 1);
    }
  } else {
    // monthly - group by week (M1..M5)
    const weeks = [];
    let d = range.start;
    let weekNum = 1;
    let weekIncome = 0, weekExpense = 0, count = 0;
    while (d <= range.end) {
      weekIncome += dayTotal(dayIncome, d);
      weekExpense += dayTotal(dayExpense, d);
      count++;
      if (count === 7 || d === range.end) {
        labels.push('M' + weekNum);
        incomeData.push(weekIncome);
        expenseData.push(weekExpense);
        weekNum++;
        weekIncome = 0; weekExpense = 0; count = 0;
      }
      d = addDays(d, 1);
    }
  }

  // L6 (audit 2026-08-17): reduce, bukan spread ke Math.max — spread bisa
  // menabrak batas argument count pada dataset laporan sangat besar.
  const maxVal = [...incomeData, ...expenseData, 1].reduce((a, b) => (b > a ? b : a), 1);
  let barsHtml = '';
  for (let i = 0; i < labels.length; i++) {
    const incH = Math.max((incomeData[i] / maxVal) * 120, 4);
    const expH = Math.max((expenseData[i] / maxVal) * 120, expenseData[i] > 0 ? 4 : 0);
    barsHtml += `<div class="chart-col">
      <div class="chart-val">${incomeData[i]>0?Math.round(incomeData[i]/1000)+'k':''}</div>
      <div style="display:flex;gap:3px;align-items:flex-end;width:100%;height:120px">
        <div class="chart-bar income" style="flex:1;height:${incH}px"></div>
        <div class="chart-bar expense" style="flex:1;height:${expH}px"></div>
      </div>
      <div class="chart-label">${labels[i]}</div>
    </div>`;
  }

  return `<div class="card">
    <div class="card-title">📊 Grafik ${period === 'mingguan' ? 'Mingguan' : period === 'bulanan' ? 'Bulanan' : 'Custom'}</div>
    <div style="display:flex;gap:12px;margin-bottom:8px;justify-content:center">
      <div style="display:flex;align-items:center;gap:4px;font-size:12px"><div style="width:12px;height:12px;border-radius:3px;background:var(--green-light)"></div>Omzet</div>
      <div style="display:flex;align-items:center;gap:4px;font-size:12px"><div style="width:12px;height:12px;border-radius:3px;background:var(--red-light)"></div>Pengeluaran</div>
    </div>
    <div class="chart-bars">${barsHtml}</div>
  </div>`;
}

// v160 (komentar browser #4): grafik HARIAN per jam. Sumbernya field `waktu`
// (ms epoch) tiap transaksi penjualan & pengeluaran, bukan tabel jam terpisah.
// Sumbu X dipangkas dari jam aktif pertama s/d terakhir (+1 jam longgar di tiap
// ujung) supaya bar tetap kebaca; kalau lebih dari ~17 jam aktif, wadah grafik
// bisa digeser mendatar daripada memaksakan 24 kolom selebar 16px.
function renderHourlyChart(sales, expenses, tanggal) {
  const inc = new Array(24).fill(0);
  const exp = new Array(24).fill(0);
  const hourOf = (t) => {
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : d.getHours();
  };
  sales.forEach(s => { const h = hourOf(s.waktu); if (h !== null) inc[h] += s.totalHarga || 0; });
  expenses.forEach(e => { const h = hourOf(e.waktu); if (h !== null) exp[h] += e.jumlah || 0; });

  let lo = -1, hi = -1;
  for (let h = 0; h < 24; h++) {
    if (inc[h] > 0 || exp[h] > 0) { if (lo < 0) lo = h; hi = h; }
  }
  if (lo < 0) return '';   // belum ada transaksi hari ini → jangan render kartu kosong
  lo = Math.max(0, lo - 1);
  hi = Math.min(23, hi + 1);
  const nCols = hi - lo + 1;

  // L6 (audit 2026-08-17): reduce, bukan spread ke Math.max.
  const maxVal = [...inc.slice(lo, hi + 1), ...exp.slice(lo, hi + 1), 1].reduce((a, b) => (b > a ? b : a), 1);

  let barsHtml = '';
  for (let h = lo; h <= hi; h++) {
    const incH = inc[h] > 0 ? Math.max((inc[h] / maxVal) * 120, 4) : 0;
    const expH = exp[h] > 0 ? Math.max((exp[h] / maxVal) * 120, 4) : 0;
    barsHtml += `<div class="chart-col">
      <div class="chart-val">${inc[h] > 0 ? Math.round(inc[h] / 1000) + 'k' : ''}</div>
      <div style="display:flex;gap:3px;align-items:flex-end;width:100%;height:120px">
        <div class="chart-bar income" style="flex:1;height:${incH}px"></div>
        <div class="chart-bar expense" style="flex:1;height:${expH}px"></div>
      </div>
      <div class="chart-label">${String(h).padStart(2, '0')}</div>
    </div>`;
  }

  return `<div class="card">
    <div class="card-title">📊 Grafik Harian · Per Jam</div>
    <div class="trx-sub kfs11" style="margin:-2px 0 6px">${escapeHtml(formatDate(tanggal))} · jam ${String(lo).padStart(2, '0')}–${String(hi).padStart(2, '0')} · ${sales.length} transaksi${expenses.length ? ' · ' + expenses.length + ' pengeluaran' : ''}</div>
    <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
      <div class="chart-bars" style="min-width:${nCols * 30}px">${barsHtml}</div>
    </div>
    <!-- Legenda di bawah batang (komentar browser #3, 2026-09-04): warna dulu
         dibaca setelah bentuknya, bukan sebelum. -->
    <div style="display:flex;gap:12px;margin-top:10px;justify-content:center">
      <div style="display:flex;align-items:center;gap:4px;font-size:12px"><div style="width:12px;height:12px;border-radius:3px;background:var(--green-light)"></div>Omzet</div>
      <div style="display:flex;align-items:center;gap:4px;font-size:12px"><div style="width:12px;height:12px;border-radius:3px;background:var(--red-light)"></div>Pengeluaran</div>
    </div>
  </div>`;
}

function buildDayCalendar() {
  const [y, m, sel] = reportDate.split('-').map(Number);
  const firstDow = new Date(y, m - 1, 1).getDay(); // 0 = Minggu
  const daysInMonth = new Date(y, m, 0).getDate();
  const today = todayStr();
  const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  let cells = '';
  for (let i = 0; i < firstDow; i++) cells += '<div class="cal-cell empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const cls = 'cal-cell' + (d === sel ? ' sel' : '') + (ds === today ? ' today' : '');
    cells += `<div class="${cls}" data-date="${ds}">${d}</div>`;
  }
  const dayHeaders = ['Mn','Sn','Rb','Km','Jm','Sb','Mg'].map(h => `<div class="cal-head">${h}</div>`).join('');
  return `<div class="cal-title">${months[m-1]} ${y}</div><div class="cal-grid">${dayHeaders}${cells}</div>`;
}

function buildWeekOptions() {
  const m = parseInt(reportDate.split('-')[1]);
  const first = reportDate.slice(0, 8) + '01';
  const endOfMonth = getMonthRange(reportDate).end;
  let cursor = getWeekRange(first).start;
  let idx = 1;
  const weeks = [];
  do {
    const w = getWeekRange(cursor);
    weeks.push({ n: idx, start: w.start, end: w.end });
    cursor = addDays(w.start, 7);
    idx++;
  } while (getWeekRange(cursor).start <= endOfMonth && idx <= 6);
  const active = getWeekRange(reportDate).start;
  return weeks.map(w => {
    const a = w.start === active ? ' sel' : '';
    return `<button class="week-opt${a}" data-start-date="${w.start}"><b>Minggu ${w.n}</b><span>${formatDate(w.start)} - ${formatDate(w.end)}</span></button>`;
  }).join('');
}

function buildMonthOptions() {
  const y = reportDate.split('-')[0];
  const cur = parseInt(reportDate.split('-')[1]);
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const opts = months.map((mn, i) => {
    const mnum = i + 1;
    const a = mnum === cur ? ' sel' : '';
    return `<button class="month-opt${a}" data-month-date="${y}-${String(mnum).padStart(2,'0')}-01"><b>${mn}</b><span>${y}</span></button>`;
  }).join('');
  return `<div class="month-grid">${opts}</div>`;
}

function buildMonthCal(year, month, selDate, rangeStart, rangeEnd, side) {
  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = todayStr();
  const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  let cells = '';
  for (let i = 0; i < firstDow; i++) cells += '<div class="cal-cell empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const inRange = rangeStart && rangeEnd && ds > rangeStart && ds < rangeEnd;
    const cls = 'cal-cell' + (ds === selDate ? ' sel' : '') + (inRange ? ' inrange' : '') + (ds === today ? ' today' : '');
    cells += `<div class="${cls}" data-side="${side}" data-custom-date="${ds}">${d}</div>`;
  }
  const dayHeaders = ['Mn','Sn','Rb','Km','Jm','Sb','Mg'].map(h => `<div class="cal-head">${h}</div>`).join('');
  return `<div class="cal-title">${months[month-1]} ${year}</div><div class="cal-grid">${dayHeaders}${cells}</div>`;
}

function buildCustomPicker() {
  const [sy, sm, sd] = customStart.split('-').map(Number);
  const [ey, em] = customEnd.split('-').map(Number);
  // Kalender kanan selalu beda bulan dari kiri (geser 1 bulan) biar ga dobel
  let ry = ey, rm = em;
  if (ry === sy && rm === sm) {
    const nxt = new Date(sy, sm - 1, 1);
    nxt.setMonth(nxt.getMonth() + 1);
    ry = nxt.getFullYear();
    rm = nxt.getMonth() + 1;
  }
  return `
    <div style="width:100%;display:flex;gap:8px;flex-wrap:wrap">
      <div style="flex:1;min-width:190px">${buildMonthCal(sy, sm, customStart, customStart, customEnd, 'start')}</div>
      <div style="flex:1;min-width:190px">${buildMonthCal(ry, rm, customEnd, customStart, customEnd, 'end')}</div>
    </div>`;
}

function buildPickerBody() {
  if (reportPeriod === 'harian') return buildDayCalendar();
  if (reportPeriod === 'mingguan') return buildWeekOptions();
  if (reportPeriod === 'bulanan') return buildMonthOptions();
  return buildCustomPicker();
}

async function renderReportDateNav() {
  const box = document.getElementById('reportDateNav');
  let label = '';
  let prevStep, nextStep, prevDelta, nextDelta;
  const isCustom = reportPeriod === 'custom';

  if (isCustom) {
    label = `📅 ${formatDate(customStart)} - ${formatDate(customEnd)}`;
  } else if (reportPeriod === 'harian') {
    const isToday = reportDate === todayStr();
    label = isToday ? 'Hari Ini' : formatDate(reportDate);
    prevStep = -1; nextStep = 1;
  } else if (reportPeriod === 'mingguan') {
    const w = getWeekRange(reportDate);
    label = formatDate(w.start) + ' - ' + formatDate(w.end);
    prevStep = -7; nextStep = 7;
  } else {
    const [y,m] = reportDate.split('-');
    const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    label = months[parseInt(m)-1] + ' ' + y;
    prevDelta = -1; nextDelta = 1;
  }
  if (reportPeriod !== 'bulanan' && prevDelta === undefined) {
    prevDelta = prevStep; nextDelta = nextStep;
  }

  const navArea = isCustom
    ? `<div class="date-label${_customPickerOpen ? ' active' : ''} toggle-custom-picker-btn" style="flex:1;text-align:center;white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis;cursor:pointer;user-select:none">${escapeHtml(label)}</div>`
    : `<button class="date-btn nav-report-date-btn" data-delta="${prevDelta}">‹</button>
       <div class="date-label${_customPickerOpen ? ' active' : ''} toggle-custom-picker-btn" style="flex:1;text-align:center;white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis;cursor:pointer;user-select:none">${escapeHtml(label)}</div>
       <button class="date-btn nav-report-date-btn" data-delta="${nextDelta}">›</button>`;

  box.innerHTML = `
    <div style="width:100%;display:flex;flex-direction:column;gap:8px">
      <div style="width:100%;display:flex;align-items:center;gap:8px;flex-wrap:nowrap">
        ${navArea}
      </div>
      <div id="customPicker" class="custom-picker" style="${_customPickerOpen ? '' : 'display:none;'}">
        ${buildPickerBody()}
      </div>
    </div>
  `;
  // v178: akordeon — panel date nav hanya tampil saat aktif (dibuka dari tab periode)
  box.style.display = _dateNavOpen ? '' : 'none';
}

// Klik tanggal di kalender harian → langsung set & filter
export function pickDate(d) {
  setReportDate(d);
  _customPickerOpen = false;
  loadReport();
}

// Klik opsi minggu → set ke hari Senin minggu terpilih & filter
export function pickWeek(d) {
  setReportDate(d);
  _customPickerOpen = false;
  loadReport();
}

// Klik opsi bulan → set ke tanggal 1 bulan terpilih & filter
export function pickMonth(d) {
  setReportDate(d);
  _customPickerOpen = false;
  loadReport();
}

// Custom: klik tanggal di kalender kiri (mulai) atau kanan (selesai)
export function pickCustomDate(side, d) {
  if (side === 'start') {
    setCustomStart(d);
    if (customEnd && d > customEnd) setCustomEnd(d);
  } else {
    setCustomEnd(d);
    if (customStart && d < customStart) setCustomStart(d);
  }
  if (reportPeriod !== 'custom') setReportPeriod('custom');
  renderReportDateNav();
  loadReport();
}

// Akordeon custom: label tanggal sebagai trigger buka/tutup date picker di bawah nav
export function toggleCustomPicker() {
  _customPickerOpen = !_customPickerOpen;
  renderReportDateNav();
}

// Window-wired date navigation (handles monthly via month arithmetic, otherwise day math)
export function navReportDate(delta) {
  let next = reportDate;
  if (reportPeriod === 'bulanan') {
    const [y,m] = reportDate.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    next = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-01';
  } else {
    next = addDays(reportDate, delta);
  }
  setReportDate(next);
  loadReport();
}

// Custom period: set tanggal mulai/selesai eksplisit (dipakai kalender/picker).
// Catatan: versi lama membaca input #customStartInput/#customEndInput yang tidak
// pernah dirender (orphan ref, ketahuan test-html-refs) — kini nilai diterima
// langsung sebagai argumen dari picker, tanpa DOM lookup.
export function setCustomDate(w, value) {
  const s = w === 'start' && value ? value : customStart;
  const e = w === 'end' && value ? value : customEnd;
  if (w === 'start' && value) setCustomStart(value);
  if (w === 'end' && value) setCustomEnd(value);
  // Jika picker dibuka dari periode non-custom, pilih tanggal = switch ke custom period
  if (reportPeriod !== 'custom') setReportPeriod('custom');
  // Validasi: mulai harus <= selesai (user bisa hubungi ulang setelah diperbaiki)
  if ((s && e && s > e) || (w === 'start' && e && s > e)) {
    showToast('Tanggal mulai tidak boleh lewat dari tanggal selesai', 'error');
  }
  loadReport();
}

// v177: seluruh akordeon Laporan auto-close — membuka satu panel menutup SEMUA
// panel lain (permintaan pemilik; pola kartu menu/konsinyasi). Konvensi akordeon:
// panel `#id` + arrow `#id-arrow`, apapun prefixnya (ojolp-, expCat-, incCat-,
// tgl riwayat, konsp-). Scope ke #reportContent agar halaman lain tak tersentuh.
function closeAllAccordions(exceptId) {
  document.querySelectorAll('#reportContent [id$="-arrow"]').forEach(a => {
    const pid = a.id.slice(0, -'-arrow'.length);
    if (pid === exceptId) return;
    const panel = document.getElementById(pid);
    if (!panel || panel.style.display === 'none') return;
    panel.style.display = 'none';
    a.style.transform = 'rotate(0deg)';
  });
}

// Toggle expense category accordion (expand/collapse transaction list)
export function toggleExpenseCat(catId) {
  const panel = document.getElementById(catId);
  const arrow = document.getElementById(`${catId}-arrow`);
  if (!panel || !arrow) return;

  const isOpen = panel.style.display !== 'none';
  if (!isOpen) closeAllAccordions(catId);
  panel.style.display = isOpen ? 'none' : 'block';
  arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
}

// Toggle Riwayat Transaksi accordion per tanggal (expand/collapse daftar trx).
// Dipakai saat user tap header tanggal di card 'Riwayat Transaksi'.
export function toggleTrxDay(tglId) {
  const panel = document.getElementById(tglId);
  const arrow = document.getElementById(`${tglId}-arrow`);
  if (!panel || !arrow) return;

  const isOpen = panel.style.display !== 'none';
  if (!isOpen) closeAllAccordions(tglId);
  panel.style.display = isOpen ? 'none' : 'block';
  arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
}

// Toggle akordeon Konsinyasi per suplayer — auto-close (v177: lewat helper global,
// membuka konsinyasi ikut menutup akordeon Laporan lain, bukan hanya sesama suplayer).
export function toggleKonsp(id) {
  const panel = document.getElementById(id);
  const arrow = document.getElementById(`${id}-arrow`);
  if (!panel || !arrow) return;
  const isOpen = panel.style.display !== 'none';
  closeAllAccordions(id);
  panel.style.display = isOpen ? 'none' : 'block';
  arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
}
