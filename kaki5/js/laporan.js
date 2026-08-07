// ==================== LAPORAN (ESM) ====================
import { DB } from './db.js';
import { escapeHtml, formatRp, formatDate, formatTime, todayStr, addDays, dayName, getWeekRange, getMonthRange, showLoading, showToast } from './helpers.js';
import { reportPeriod, setReportPeriod, reportDate, setReportDate, customStart, customEnd, setCustomStart, setCustomEnd } from './app-state.js';

export function setReportPeriodUI(p) {
  setReportPeriod(p);
  document.querySelectorAll('.report-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.period === p);
  });
  loadReport();
}

export async function loadReport() {
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

    const sales = await DB.penjualan.where('tanggal').between(dateRange.start, dateRange.end, true, true).toArray();
    const expenses = await DB.pengeluaran.where('tanggal').between(dateRange.start, dateRange.end, true, true).toArray();

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

  const totalExp = expenses.reduce((a,e) => a + e.jumlah, 0);
  const profit = omzet - modal - totalExp;
  const marginPct = omzet > 0 ? Math.round(((omzet - modal) / omzet) * 100) : 0;

  let html = '';

  // Summary cards
  html += `<div class="stat-grid">
    <div class="stat-card" style="background:var(--green-bg);border-color:#A5D6A7">
      <div class="stat-label">💰 Omzet</div>
      <div class="stat-value green">${formatRp(omzet)}</div>
    </div>
    <div class="stat-card" style="background:var(--orange-bg);border-color:#FFCC80">
      <div class="stat-label">🧮 Modal Bahan</div>
      <div class="stat-value orange">${formatRp(modal)}</div>
    </div>
    <div class="stat-card" style="background:var(--red-bg);border-color:#EF9A9A">
      <div class="stat-label">💸 Pengeluaran</div>
      <div class="stat-value red">${formatRp(totalExp)}</div>
    </div>
    <div class="stat-card" style="background:var(--blue-bg);border-color:#90CAF9">
      <div class="stat-label">📈 Untung Bersih</div>
      <div class="stat-value ${profit>=0?'blue':'red'}">${formatRp(profit)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">🛒 Transaksi</div>
      <div class="stat-value orange">${sales.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">🍽️ Porsi Terjual</div>
      <div class="stat-value orange">${totalQty}</div>
    </div>
  </div>`;

  // Margin
  html += `<div class="card" style="text-align:center">
    <div class="card-title" style="justify-content:center">📊 Margin Kotor</div>
    <div style="background:#f5f5f5;border-radius:10px;height:24px;overflow:hidden;margin-bottom:8px">
      <div style="background:${marginPct>30?'var(--green)':marginPct>15?'var(--primary)':'var(--red)'};height:100%;width:${marginPct}%;border-radius:10px;transition:width .5s"></div>
    </div>
    <div style="font-size:20px;font-weight:800;color:${marginPct>30?'var(--green)':marginPct>15?'var(--primary)':'var(--red)'}">${marginPct}%</div>
  </div>`;

  // Chart for weekly/monthly (uses already-fetched sales/expenses — no N+1)
  if (reportPeriod !== 'harian') {
    html += await renderChart(dateRange, reportPeriod, sales, expenses);
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

  // Expense breakdown by category with accordion (expandable transaction list)
  if (expenses.length > 0) {
    const expCats = {};
    const expCatItems = {}; // kategori -> array of expense objects
    expenses.forEach(e => {
      if (!expCats[e.kategori]) {
        expCats[e.kategori] = 0;
        expCatItems[e.kategori] = [];
      }
      expCats[e.kategori] += e.jumlah;
      expCatItems[e.kategori].push(e);
    });
    const catEmoji = {'Bahan Baku':'🥬','Gas & BBM':'⛽','Sewa Tempat':'🏪','Peralatan':'🍳','Lainnya':'📦'};
    html += '<div class="card"><div class="card-title">💸 Rincian Pengeluaran</div>';
    
    Object.entries(expCats).sort((a,b) => b[1]-a[1]).forEach(([cat, total]) => {
      const pct = totalExp > 0 ? Math.round((total/totalExp)*100) : 0;
      const catId = `expCat-${escapeHtml(cat).replace(/\s+/g,'')}`;
      
      // Category header (clickable to expand/collapse)
      html += `<div>
        <div onclick="toggleExpenseCat('${catId}')" style="display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid var(--border);cursor:pointer">
          <span style="font-size:20px">${escapeHtml(catEmoji[cat]||'📦')}</span>
          <div style="flex:1">
            <div style="font-weight:600;font-size:14px">${escapeHtml(cat)}</div>
            <div style="background:#f5f5f5;border-radius:6px;height:8px;margin-top:4px;overflow:hidden">
              <div style="background:var(--red-light);height:100%;width:${pct}%;border-radius:6px"></div>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:800;font-size:14px;color:var(--red)">${formatRp(total)}</div>
            <div style="font-size:11px;color:var(--text3)">${pct}%</div>
          </div>
          <span id="${catId}-arrow" style="font-size:18px;color:var(--text3);transition:transform .2s">›</span>
        </div>
        
        <div id="${catId}" style="display:none;padding-left:32px;border-bottom:1px solid var(--border)">`;
      
      // Transaction list for this category (sorted by time, newest first)
      if (reportPeriod === 'harian') {
        expCatItems[cat].sort((a,b) => b.waktu - a.waktu).forEach(e => {
          html += `<div class="trx-item" onclick="showExpenseDetail(${e.id})" style="padding:10px 0;gap:10px">
            <div style="width:12px;height:12px;background:var(--red-light);border-radius:50%;flex-shrink:0"></div>
            <div class="trx-info" style="flex:1">
              <div class="trx-title" style="font-size:13px">${escapeHtml(e.keterangan)}</div>
              <div class="trx-sub" style="font-size:11px">${escapeHtml(formatTime(e.waktu))}</div>
            </div>
            <div class="trx-amount red" style="font-size:13px">-${formatRp(e.jumlah)}</div>
          </div>`;
        });
      }
      
      html += `</div></div>`;
    });
    
    html += '</div>';
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
    dates.forEach(tgl => {
      const items = byDay[tgl].sort((a, b) => b.waktu - a.waktu);
      const daySum = items.reduce((a, s) => a + (s.totalHarga || 0), 0);
      html += `<div style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 14px;background:var(--orange-bg);border-radius:12px;margin-bottom:6px">
          <div style="font-weight:800;font-size:14px;color:var(--text)">📅 ${escapeHtml(dayName(tgl))}, ${escapeHtml(formatDate(tgl))}</div>
          <div style="font-weight:800;font-size:13px;color:var(--primary);text-align:right">${formatRp(daySum)} · ${items.length} trx</div>
        </div>`;
      items.forEach(s => {
        const itemNames = s.items ? s.items.map(i => `${escapeHtml(i.nama)}×${i.qty}`).join(', ') : '';
        html += `<div class="trx-item" onclick="showTrxDetail(${s.id})">
          <div class="trx-icon sale">🛒</div>
          <div class="trx-info"><div class="trx-title">${itemNames}</div><div class="trx-sub">${escapeHtml(formatTime(s.waktu))}</div></div>
          <div class="trx-amount green">${formatRp(s.totalHarga)}</div>
        </div>`;
      });
      html += '</div>';
    });
    html += '</div>';
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

  const maxVal = Math.max(...incomeData, ...expenseData, 1);
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

async function renderReportDateNav() {
  const box = document.getElementById('reportDateNav');
  let label = '';
  let prevStep, nextStep;

  // Custom period — tampilkan dua input tanggal (mulai → selesai), tanpa ‹ ›
  if (reportPeriod === 'custom') {
    box.innerHTML = `
      <div style="width:100%;display:flex;flex-direction:column;gap:8px;align-items:stretch">
        <div style="display:flex;gap:6px;align-items:center">
          <input type="date" id="customStartInput" value="${customStart}" class="custom-date-input"
            onchange="setCustomDate('start')" style="flex:1" />
          <span style="color:var(--text3);font-size:14px">→</span>
          <input type="date" id="customEndInput" value="${customEnd}" class="custom-date-input"
            onchange="setCustomDate('end')" style="flex:1" />
        </div>
        <div class="date-label" style="text-align:center">📅 ${formatDate(customStart)} - ${formatDate(customEnd)}</div>
      </div>`;
    return;
  }

  if (reportPeriod === 'harian') {
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
  }

  let prevDelta, nextDelta;
  if (reportPeriod === 'bulanan') {
    prevDelta = -1; nextDelta = 1;
  } else {
    prevDelta = prevStep; nextDelta = nextStep;
  }

  box.innerHTML = `
    <button class="date-btn" onclick="navReportDate(${prevDelta})">‹</button>
    <div class="date-label">📅 ${label}</div>
    <button class="date-btn" onclick="navReportDate(${nextDelta})">›</button>
  `;
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

// Custom period: dipanggil saat user memilih tanggal mulai/selesai di input date
export function setCustomDate(w) {
  const sEl = document.getElementById('customStartInput');
  const eEl = document.getElementById('customEndInput');
  const s = sEl ? sEl.value : customStart;
  const e = eEl ? eEl.value : customEnd;
  if (w === 'start' && s) setCustomStart(s);
  if (w === 'end' && e) setCustomEnd(e);
  // Validasi: mulai harus <= selesai (user bisa hubungi ulang setelah diperbaiki)
  if ((s && e && s > e) || (w === 'start' && e && s > e)) {
    showToast('Tanggal mulai tidak boleh lewat dari tanggal selesai', 'error');
  }
  loadReport();
}

// Toggle expense category accordion (expand/collapse transaction list)
export function toggleExpenseCat(catId) {
  const panel = document.getElementById(catId);
  const arrow = document.getElementById(`${catId}-arrow`);
  if (!panel || !arrow) return;
  
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
}
