// ==================== PAGE TEMPLATES & LIFECYCLE (ESM) ====================
// Extracts inline HTML from index.html into reusable template strings.
// Each page has a template function + init/cleanup lifecycle hooks.

// ---- TEMPLATE STRINGS ----
// Each template returns the INNER HTML of its page container (without the
// outer <div class="page" id="page-..."> wrapper). The page wrapper is
// already present in index.html; initPage() hydrates the inner content.

export const TEMPLATES = {
  beranda: () => `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
    <div>
    <div style="font-size:14px;color:var(--text3);font-weight:600" id="greetText">Selamat pagi! 👋</div>
    <div style="font-size:20px;font-weight:800" id="namaWarung">Warung Saya</div>
    </div>
    <div style="font-size:13px;color:var(--text3);font-weight:600;text-align:right" id="todayDate"></div>
    </div>

    <div class="stat-grid">
    <div id="platCarouselEl" style="grid-column:1/-1;margin-bottom:8px"></div>
    <div class="stat-card" style="background:var(--green-bg);border-color:#A5D6A7">
    <div class="stat-label">💰 Omzet Hari Ini</div>
    <div class="stat-value green" id="todayOmzet">Rp 0</div>
    </div>
    <div class="stat-card" style="background:var(--red-bg);border-color:#EF9A9A">
    <div class="stat-label">🧾 Pengeluaran</div>
    <div class="stat-value red" id="todayExpense">Rp 0</div>
    </div>
    <div class="stat-card" style="background:var(--blue-bg);border-color:#90CAF9">
    <div class="stat-label">📈 Laba Hari Ini</div>
    <div class="stat-value blue" id="todayProfit">Rp 0</div>
    </div>
    <div class="stat-card">
    <div class="stat-label">🛒 Jumlah Transaksi</div>
    <div class="stat-value orange" id="todayTrxCount">0</div>
    </div>
    <div class="stat-card">
    <div class="stat-label">🍽️ Porsi Terjual</div>
    <div class="stat-value orange" id="todayQtyCount">0</div>
    </div>
    <div class="stat-card">
    <div class="stat-label">💸 Rata-rata per Transaksi</div>
    <div class="stat-value orange" id="todayAvgTrx">Rp 0</div>
    </div>
    </div>

    <div class="card">
    <div class="card-title">⏱️ Transaksi Terakhir</div>
    <div id="recentTrx">
    <div class="empty-state"><div class="empty-icon">📝</div><div class="empty-text">Belum ada transaksi hari ini.<br>Yuk mulai jualan!</div></div>
    </div>
    </div>
  `,

  jualan: () => `
    <div class="search-box">
    <span class="search-icon">🔍</span>
    <input type="text" id="searchMenu" placeholder="Cari menu..." oninput="renderPOSMenu()">
    </div>
    <div class="cat-tabs" id="posCatTabs"></div>
    <div class="menu-grid" id="posMenuGrid"></div>

    <!-- Keranjang floating -->
    <div id="cartBar" style="display:none;position:fixed;bottom:calc(var(--nav-h) + 8px);left:8px;right:8px;max-width:90%;margin:0 auto;background:var(--green);color:#fff;border-radius:16px;padding:14px 20px;z-index:50;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.3)" onclick="openCartModal()">
    <div style="display:flex;align-items:center;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:10px">
    <span style="font-size:24px">🛒</span>
    <span style="font-weight:800;font-size:16px" id="cartCount">0 item</span>
    </div>
    <div style="font-weight:800;font-size:18px" id="cartTotal">Rp 0</div>
    </div>
    </div>
  `,

  menu: () => `
    <div class="search-box">
    <span class="search-icon">🔍</span>
    <input type="text" id="searchMenuList" placeholder="Cari menu..." oninput="renderMenuList()">
    </div>
    <div id="menuListContainer"></div>
    <button class="fab" onclick="openMenuForm()" title="Tambah Menu">➕</button>
  `,

  laporan: () => `
    <div class="report-tabs" id="reportPeriodTabs">
    <div class="report-tab active" data-period="harian" onclick="setReportPeriod('harian')">Harian</div>
    <div class="report-tab" data-period="mingguan" onclick="setReportPeriod('mingguan')">Mingguan</div>
    <div class="report-tab" data-period="bulanan" onclick="setReportPeriod('bulanan')">Bulanan</div>
    <div class="report-tab" data-period="custom" onclick="setReportPeriod('custom')">Custom</div>
    </div>
    <div class="date-nav" id="reportDateNav"></div>
    <div id="reportContent"></div>
    <button class="fab" onclick="openExpenseForm()" title="Catat Pengeluaran">➕</button>
  `,

  pengaturan: () => `
    <div class="card">
    <div class="card-title">👤 Profil</div>
    <div class="setting-item" onclick="openNameModal()">
    <div class="setting-icon" style="background:var(--orange-bg)">🏪</div>
    <div class="setting-info"><div class="s-title">Nama Usaha <span style="color:var(--red);font-weight:700">*</span></div><div class="s-desc" id="settingName">Warung Saya</div></div>
    <div class="setting-arrow">›</div>
    </div>
    <div class="setting-item" onclick="openOwnerModal()">
    <div class="setting-icon" style="background:var(--orange-bg)">👤</div>
    <div class="setting-info"><div class="s-title">Nama Pemilik <span style="color:var(--red);font-weight:700">*</span></div><div class="s-desc" id="settingOwner">—</div></div>
    <div class="setting-arrow">›</div>
    </div>
    <div class="setting-item" onclick="openWaModal()">
    <div class="setting-icon" style="background:var(--green-bg)">💬</div>
    <div class="setting-info"><div class="s-title">Nomor WhatsApp <span style="color:var(--red);font-weight:700">*</span></div><div class="s-desc" id="settingWa">—</div></div>
    <div class="setting-arrow">›</div>
    </div>
    <div class="setting-item" onclick="openAlamatModal()">
    <div class="setting-icon" style="background:var(--blue-bg)">📍</div>
    <div class="setting-info"><div class="s-title">Alamat <span style="color:var(--red);font-weight:700">*</span></div><div class="s-desc" id="settingAlamat">—</div></div>
    <div class="setting-arrow">›</div>
    </div>
    </div>

    <div class="card">
    <div class="card-title">🖨️ Printer Bluetooth</div>
    <div class="setting-item" onclick="connectBTPrinter()">
    <div class="setting-icon" style="background:var(--blue-bg)">📡</div>
    <div class="setting-info"><div class="s-title">Hubungkan Printer</div><div class="s-desc" id="btPrinterStatus">Belum terhubung</div></div>
    <div class="setting-arrow">›</div>
    </div>
    <div class="setting-item" onclick="testPrint()">
    <div class="setting-icon" style="background:var(--green-bg)">📄</div>
    <div class="setting-info"><div class="s-title">Cetak Tes</div><div class="s-desc">Cek apakah printer berfungsi</div></div>
    <div class="setting-arrow">›</div>
    </div>
    <div class="setting-item" onclick="disconnectBTPrinter()">
    <div class="setting-icon" style="background:var(--red-bg)">❌</div>
    <div class="setting-info"><div class="s-title">Putuskan Printer</div><div class="s-desc">Lepas koneksi Bluetooth</div></div>
    <div class="setting-arrow">›</div>
    </div>
    </div>
    <div class="card">
    <div class="card-title">💾 Data & Cadangan</div>
    <div class="setting-item" onclick="exportData()">
    <div class="setting-icon" style="background:var(--green-bg)">💾</div>
    <div class="setting-info"><div class="s-title">Simpan Cadangan</div><div class="s-desc">Simpan data ke file HP</div></div>
    <div class="setting-arrow">›</div>
    </div>
    <div class="setting-item" onclick="document.getElementById('importFile').click()">
    <div class="setting-icon" style="background:var(--blue-bg)">📂</div>
    <div class="setting-info"><div class="s-title">Pulihkan Data</div><div class="s-desc">Ambil data dari file cadangan</div></div>
    <div class="setting-arrow">›</div>
    <input type="file" id="importFile" accept=".json" style="display:none" onchange="importData(event)">
    </div>
    <div class="setting-item" onclick="confirmClearAll()">
    <div class="setting-icon" style="background:var(--red-bg)">🗑️</div>
    <div class="setting-info"><div class="s-title">Hapus Semua Data</div><div class="s-desc">Hati-hati! Data tidak bisa kembali</div></div>
    <div class="setting-arrow">›</div>
    </div>
    </div>

    <!-- ====== Footer Info Aplikasi (di luar kartu, paling bawah) ====== -->
            <div style="display:flex;flex-direction:column;align-items:center;text-align:center;margin-top:20px">
            <img src="assets/icon-old.png" style="width:64px;height:64px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.1);flex-shrink:0" alt="Logo">
            <div style="font-weight:800;color:var(--text);font-size:18px;margin-top:10px">Kasir Solo - Kaki Lima</div>
            <div style="font-weight:600;color:var(--text2);font-size:12px;margin-top:12px">PT Mesin Kasir Solo</div>
            <div style="margin-top:8px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
            <a href="https://wa.me/628816566935" style="color:var(--green);text-decoration:none;font-weight:600;font-size:12px">📱 0881-6566-935</a>
            <a id="appSiteLink" href="https://kasirsolo.app" target="_blank" rel="noopener" style="color:var(--blue);text-decoration:none;font-weight:600;font-size:12px">🌐 kasirsolo.app</a>
            </div>
            <div style="font-size:13px;color:var(--text2);margin-top:12px">Versi 1.0</div>
            <div id="licUnit" style="font-size:11px;color:var(--text3);margin-top:2px"></div>
            </div>
          `,

  bantuan: () => `
    <div class="card">
    <div class="card-title">❓ Bantuan</div>
    <div style="font-size:14px;color:var(--text2);line-height:1.6">
    Panduan singkat cara memakai <b>Kasir Solo - Kaki Lima</b>.
    </div>
    </div>
    <div id="bantuanContent"></div>
  `
};

// ---- PAGE-LIFECYCLE TRACKING ----
const _pageCleanupFns = new Map();  // pageId → array of cleanup callbacks

/**
 * Register a cleanup callback for a page. Called automatically by cleanupPage().
 * Useful for timers, event listeners, or state that must be torn down when leaving a page.
 * @param {string} pageId
 * @param {Function} fn
 */
export function registerCleanup(pageId, fn) {
  if (!fn) return;
  let arr = _pageCleanupFns.get(pageId);
  if (!arr) { arr = []; _pageCleanupFns.set(pageId, arr); }
  arr.push(fn);
}

/**
 * Called when a page becomes active (after its DOM is visible).
 * Hydrates the page by running the page-specific loader function.
 * For pages whose HTML is already in index.html, this only runs the JS loader.
 * For dynamically-rendered content, the loader writes into the container elements.
 *
 * @param {string} pageId - one of: 'beranda','jualan','menu','laporan','pengaturan','bantuan'
 */
export async function initPage(pageId, module) {
  // Clean up any previous cleanup fns for this page (idempotent re-init)
  if (_pageCleanupFns.has(pageId)) {
    for (const fn of _pageCleanupFns.get(pageId)) {
      try { fn(); } catch (e) { console.warn(`[initPage] cleanup fn error:`, e); }
    }
    _pageCleanupFns.delete(pageId);
  }

  // module is the dynamically imported module for this page
  const mod = module || {};

  switch (pageId) {
    case 'beranda': {
      // loadBeranda is imported from beranda.js and wired to window by app.js
      if (typeof mod.loadBeranda === 'function') await mod.loadBeranda();
      break;
    }
    case 'jualan': {
      if (typeof mod.loadPOS === 'function') await mod.loadPOS();
      break;
    }
    case 'menu': {
      if (typeof mod.renderMenuList === 'function') await mod.renderMenuList();
      break;
    }
    case 'laporan': {
      if (typeof mod.loadReport === 'function') await mod.loadReport();
      break;
    }
    case 'pengaturan': {
      if (typeof mod.loadSettings === 'function') await mod.loadSettings();
      break;
    }
    case 'bantuan': {
      if (typeof mod.initBantuan === 'function') mod.initBantuan();
      break;
    }
    default:
      console.warn(`[initPage] unknown page: ${pageId}`);
  }
}

/**
 * Called when a page becomes inactive (user navigates away).
 * Tears down timers, event listeners, and stale state associated with the page.
 *
 * @param {string} pageId
 */
export function cleanupPage(pageId) {
  const fns = _pageCleanupFns.get(pageId);
  if (!fns) return;
  for (const fn of fns) {
    try { fn(); } catch (e) { console.warn(`[cleanupPage] error:`, e); }
  }
  _pageCleanupFns.delete(pageId);

  // Page-specific cleanup
  switch (pageId) {
    case 'jualan': {
      // Cart bar is managed by updateCartBar() — no cleanup needed unless
      // we had extra listeners registered via registerCleanup().
      break;
    }
    case 'laporan': {
      // reportPeriod / reportDate are managed by app-state.js setters.
      break;
    }
    case 'bantuan': {
      // Accordion state is inline in DOM; no cleanup needed.
      break;
    }
  }
}
