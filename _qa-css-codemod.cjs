// Codemod style.css control — buang CSS mati (verified 0 usage) + polish enterprise.
const fs = require('fs');
const F = 'C:/Users/Admin/Documents/kasol/control/style.css';
let css = fs.readFileSync(F, 'utf8');
const reps = [];
let miss = 0, hit = 0;
function rep(name, oldS, newS) { reps.push([name, oldS, newS]); }

// ── 1. license-pill / lp-dot (mati) ──
rep('license-pill', `.license-pill{display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:var(--r-full);background:var(--orange-50);color:var(--brand-ink);font-weight:700;font-size:12px;cursor:pointer;}
.license-pill.warn{background:#fff;color:var(--brand-ink);border:1px solid var(--primary);}
.lp-dot{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 0 3px var(--green-bg);}
`, '');

// ── 2. page-head family (mati) ──
rep('page-head', `.page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:var(--s4);margin-bottom:var(--s6);flex-wrap:wrap;}
.page-h{font-size:24px;font-weight:800;letter-spacing:-.02em;color:var(--ink);}
.page-d{font-size:13.5px;color:var(--ink-3);margin-top:2px;}

`, '');

// ── 3. btn transition + polish ──
rep('btn-transition', `transition:filter .15s,transform .1s,background .15s;border:1px solid transparent;white-space:nowrap;}`, `transition:filter .15s,transform .1s,background .15s,box-shadow .15s,border-color .15s,opacity .15s;border:1px solid transparent;white-space:nowrap;}`);

// ── 4. input-mono / input-readonly (mati) ──
rep('input-readonly', `.input-mono{font-family:var(--mono);font-size:13px;background:var(--orange-50)!important;}
.input-readonly{background:var(--orange-50);font-weight:700;text-align:center;}
.input-readonly.center-lg{font-size:15px;}
.input-readonly.center-xl{font-size:19px;font-weight:800;}
.input-readonly.green{color:var(--green);}
.input-readonly.orange{color:var(--primary);}
`, '');

// ── 5. feed family + bare tone classes (mati) ──
rep('feed', `/* FEED (recent activity) */
.feed{display:flex;flex-direction:column;}
.feed-item{display:flex;align-items:center;gap:var(--s3);padding:var(--s2) 0;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s;margin:0 calc(var(--s4) * -1);padding-left:var(--s4);padding-right:var(--s4);}
.feed-item:last-child{border-bottom:none;}
.feed-item:hover{background:var(--orange-50);}
.feed-ic{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
.feed-body{flex:1;min-width:0;}
.feed-title{font-size:13px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.feed-sub{font-size:11.5px;color:var(--ink-3);}
.feed-badge{font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:var(--r-full);}
.blue{background:var(--blue-bg);color:var(--blue);}
.green{background:var(--green-bg);color:var(--green);}
.red{background:var(--red-bg);color:var(--red);}
.amber{background:var(--orange-50);color:var(--primary);}

/* CATALOG */`, `/* CATALOG */`);

// ── 6. stat-grid (mati) ──
rep('stat-grid', `/* Grid kartu stat klien — auto-fit agar 1..N kartu mengisi penuh, tanpa kolom kosong */
.stat-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:var(--s3);margin-bottom:var(--s4);}

/* Analytics KPI: 2 kolom di HP/tablet, auto-fit di desktop */
@media (min-width:1025px){
  .stat-grid{grid-template-columns:repeat(auto-fit,minmax(160px,1fr));}
}

/* BAR ROWS (charts) */`, `/* BAR ROWS (charts) */`);

// ── 7. product-card family (mati; hot-badge dipertahankan) ──
rep('product-card', `.product-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;box-shadow:var(--shadow-sm);transition:transform .15s var(--ease),box-shadow .15s var(--ease),border-color .15s;display:flex;flex-direction:column;}
.product-card:hover{transform:translateY(-3px);box-shadow:var(--shadow-md);border-color:var(--orange-200);}
.product-cover{height:120px;display:flex;align-items:center;justify-content:center;font-size:44px;background:linear-gradient(135deg,var(--orange-50),#FFE9D6);}
.product-body{padding:var(--s4) var(--s4) 0;flex:1;}
.product-name{font-size:15px;font-weight:800;color:var(--ink);}
.product-desc{font-size:12.5px;color:var(--ink-3);margin-top:4px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:35px;}
.product-foot{display:flex;align-items:center;justify-content:space-between;margin-top:var(--s3);}
.product-price{font-size:16px;font-weight:800;color:var(--primary);}
.product-tag{font-size:11px;font-weight:700;color:var(--ink-3);background:var(--bg-subtle);padding:2px 8px;border-radius:var(--r-full);display:inline-block;margin-top:2px;}
.hot-badge`, `.hot-badge`);
rep('product-actions', `.product-actions{display:flex;gap:var(--s2);padding:var(--s4);border-top:1px solid var(--border);margin-top:var(--s4);}
.product-actions .btn{flex:1;}

/* LICENSE */
.product-list,.product-registry{display:flex;flex-direction:column;gap:var(--s2);}
.product-row{display:grid;grid-template-columns:40px 1fr 1.4fr auto auto;align-items:center;gap:var(--s3);padding:var(--s3) var(--s4);background:var(--surface);border:1px solid var(--border);border-radius:var(--r-sm);}
.pr-ic{font-size:20px;text-align:center;}
.pr-info{min-width:0;}
.pr-name{font-size:14px;font-weight:700;color:var(--ink);}
.pr-prefix{font-size:11px;color:var(--ink-3);font-family:var(--mono);}
.pr-salt{justify-self:stretch;font-size:11px;padding:8px 10px;border:1px solid var(--border);border-radius:var(--r-xs);background:var(--bg-subtle);color:var(--ink-2);min-width:0;overflow:hidden;}
.pr-price{font-size:13px;font-weight:800;color:var(--ink);white-space:nowrap;}
.verify-badge{font-weight:800;margin-bottom:var(--s2);}
.verify-detail{font-size:12.5px;color:var(--ink-2);}
.stat-mini{display:grid;grid-template-columns:1fr 1fr;gap:var(--s3);margin-bottom:var(--s3);}
.stat-mini > div{background:var(--bg-subtle);border-radius:var(--r-sm);padding:var(--s3);text-align:center;}
.sm-label{display:block;font-size:11px;font-weight:700;color:var(--ink-3);text-transform:uppercase;}
.sm-val{display:block;font-size:22px;font-weight:800;margin-top:2px;}
.row-actions`, `.row-actions`);

// ── 8. client-card family (mati; .client-avatar DIPERTAHANKAN utk kanban) ──
rep('client-card', `/* CLIENTS */
.client-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:var(--s4);}
.client-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:var(--s4);box-shadow:var(--shadow-sm);transition:transform .15s var(--ease),box-shadow .15s, border-color .15s;}
.client-card:hover{transform:translateY(-2px);box-shadow:var(--shadow-md);border-color:var(--orange-200);}
.client-top{display:flex;align-items:center;gap:var(--s3);}
.client-avatar{width:46px;height:46px;border-radius:12px;background:var(--orange-50);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;}
.client-id{flex:1;min-width:0;}
.client-name{font-size:15px;font-weight:800;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.client-sub{font-size:12px;color:var(--ink-3);}
.client-status{width:11px;height:11px;border-radius:50%;flex-shrink:0;}
.client-status.on{background:var(--green);box-shadow:0 0 0 3px var(--green-bg);}
.client-status.off{background:var(--ink-3);}
.client-meta{display:flex;flex-wrap:wrap;gap:var(--s3);margin-top:var(--s3);font-size:12px;color:var(--ink-3);}
.client-card-head{display:flex;align-items:center;gap:12px;width:100%;}
.client-main{flex:1;min-width:0;}
.client-contact{display:flex;flex-wrap:wrap;gap:6px 12px;margin-top:10px;font-size:12px;color:var(--ink-3);}
.cc{display:inline-flex;align-items:center;gap:4px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.cc-loc{max-width:260px;}
.client-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:var(--s3);padding-top:var(--s3);border-top:1px solid var(--border);flex-wrap:wrap;}
.client-seen{font-size:11px;color:var(--ink-3);}
.status-select{padding:4px 8px;border:1px solid var(--border);border-radius:8px;background:var(--surface);font-size:12px;font-weight:700;color:var(--ink);cursor:pointer;}
.status-select:hover{border-color:var(--primary);}

/* Detail klien — halaman penuh */
.cd-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}
.cd-title{display:flex;align-items:center;gap:12px;min-width:0;}
.cd-title .client-avatar{width:52px;height:52px;font-size:26px;}
`, `/* CLIENTS — avatar dipakai kartu kanban */
.client-avatar{width:46px;height:46px;border-radius:12px;background:var(--orange-50);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;}
`);

// ── 9. cell-main + wa-link (mati) ──
rep('cell-main', `.cell-main{font-weight:700;color:var(--ink);font-size:13px;}
.cell-sub{font-size:11.5px;color:var(--ink-3);}
.wa-link{font-size:12px;font-weight:600;color:var(--green);display:inline-block;margin-top:2px;}
.wa-link:hover{text-decoration:underline;}
`, `.cell-sub{font-size:11.5px;color:var(--ink-3);}
`);

// ── 10. tab-bar / status-select blok kedua (mati) ──
rep('tab-bar', `/* Tab bar (Klien: Outlet / Leads) */
.tab-bar{display:flex;gap:4px;margin-bottom:var(--s4);border-bottom:2px solid var(--border);}
.tab-btn{background:none;border:none;border-bottom:3px solid transparent;margin-bottom:-2px;padding:10px 14px;font-size:14px;font-weight:700;color:var(--ink-2);cursor:pointer;border-radius:4px 4px 0 0;}
.tab-btn:hover{color:var(--brand-ink);background:var(--orange-50);}
.tab-btn.active{color:var(--brand-ink);border-bottom-color:var(--primary);}
.tab-panel{animation:tabFade .18s ease;}
@keyframes tabFade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.status-select{padding:6px 10px;border:1.5px solid var(--border);border-radius:var(--r-sm);font-size:12.5px;font-weight:700;background:var(--surface);color:var(--ink-2);cursor:pointer;min-width:120px;}
.status-select.blue{border-color:var(--blue);color:var(--blue);}
.status-select.green{border-color:var(--green);color:var(--green);}
.status-select.red{border-color:var(--red);color:var(--red);}
.status-select.amber{border-color:var(--primary);color:var(--primary);}

/* SHEETS / MODALS */`, `/* SHEETS / MODALS */`);

// ── 11. sheet polish (hardcoded → token + a11y focus) ──
rep('sheet-handle', `  width: 40px; height: 4px; background: #ddd; border-radius: 2px; margin: 0 auto var(--space-4);`, `  width: 40px; height: 4px; background: var(--border); border-radius: 2px; margin: 0 auto var(--space-4);`);
rep('sheet-close', `.sheet-close {
  background: #f2f2f2; border: 2px solid #ea5800; width: 40px; height: 40px; border-radius: 50%; font-size: 18px; cursor: pointer; color: var(--text2); flex-shrink: 0;
  position: absolute;
  top: 0;
  right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  outline: none;
  box-shadow: 0 0 0 1px rgba(234, 88, 0, 0.15);
}`, `.sheet-close {
  background: var(--bg-subtle); border: 2px solid var(--primary); width: 40px; height: 40px; border-radius: 50%; font-size: 18px; cursor: pointer; color: var(--ink-2); flex-shrink: 0;
  position: absolute;
  top: 0;
  right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  transition: background .15s var(--ease), color .15s var(--ease), border-color .15s var(--ease);
}
.sheet-close:hover { background: var(--red-bg); border-color: var(--red); color: var(--red); }`);

// ── 12. empty-state unify (2 varian markup) ──
rep('empty-unify', `.empty-ic{font-size:54px;margin-bottom:var(--s3);opacity:.5;}
.empty-t{font-weight:800;font-size:16px;color:var(--ink);margin-bottom:var(--s1);}
.empty-d{font-size:13px;max-width:300px;margin:0 auto;line-height:1.5;}`, `.empty-ic,.empty-state .empty-icon{font-size:54px;margin-bottom:var(--s3);opacity:.5;display:flex;align-items:center;justify-content:center;}
.empty-t,.empty-state .empty-title{font-weight:800;font-size:16px;color:var(--ink);margin-bottom:var(--s1);}
.empty-d,.empty-state .empty-desc{font-size:13px;max-width:300px;margin:0 auto;line-height:1.5;}`);
rep('empty-old', `.empty-state .empty-icon {
  font-size: 60px; margin-bottom: var(--space-3); opacity: .5;
}
.empty-state .empty-title {
  font-weight: 700; font-size: 16px; color: var(--text); margin-bottom: var(--space-2);
}
.empty-state .empty-desc {
  font-size: 13px; max-width: 280px; margin: 0 auto;
}
`, '');

// ── 13. menu-toggle hover ──
rep('menu-toggle', `.menu-toggle span{width:18px;height:2px;background:var(--ink);border-radius:2px;}`, `.menu-toggle span{width:18px;height:2px;background:var(--ink);border-radius:2px;}
.menu-toggle:hover{background:var(--orange-100);}`);

// ── 14. content max-width (enterprise: nyaman di layar lebar) ──
rep('content-max', `.content{flex:1;padding:var(--s4);width:100%;}`, `.content{flex:1;padding:var(--s4);width:100%;max-width:1440px;margin-inline:auto;}`);

// ── 15. scrollbar Firefox + hover ──
rep('scrollbar', `::-webkit-scrollbar{width:9px;height:9px;}
::-webkit-scrollbar-thumb{background:#CBD2DC;border-radius:5px;}
::-webkit-scrollbar-track{background:transparent;}`, `html{scrollbar-width:thin;scrollbar-color:#CBD2DC transparent;}
::-webkit-scrollbar{width:9px;height:9px;}
::-webkit-scrollbar-thumb{background:#CBD2DC;border-radius:5px;border:2px solid transparent;background-clip:content-box;}
::-webkit-scrollbar-thumb:hover{background:#AEB7C4;background-clip:content-box;}
::-webkit-scrollbar-track{background:transparent;}`);

// ── 16. summary-card + stat-card family (mati) + section-label/mb8 ──
rep('summary-card', `.mb8 {
  margin-bottom: var(--space-3);
}
.text-xs {
  font-size: 11px;
}
/* ===== SECTION LABEL ===== */
.section-label {
  font-size: 13px; font-weight: 700; color: var(--text2); margin-bottom: var(--space-3);
}
.section-label.mb0 {
  margin-bottom: 0;
}
.hint {
  font-size: 12px; color: var(--text3);
}
/* summary-card — diadopsi langsung dari app GEROBAK */
.summary-card {
  border-radius: var(--radius-sm);
  padding: var(--space-4);
  color: #fff;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transition: transform 0.2s, box-shadow 0.2s;
}
.summary-card:active {
  transform: scale(0.98);
}
/* Gradient varian — sama persis dengan gerobak */
.summary-card.brand {
  background: linear-gradient(135deg, var(--primary), var(--primary-light));
}
.summary-card.green {
  background: linear-gradient(135deg, #4CC583, var(--green));
}
.summary-card.red {
  background: linear-gradient(135deg, #F17B65, var(--red));
}
.summary-card.teal {
  background: linear-gradient(135deg, #5CB6CC, var(--teal));
}
.summary-card.purple {
  background: linear-gradient(135deg, #9B59B6, var(--purple));
}
.summary-card.blue {
  background: linear-gradient(135deg, #5CB6CC, var(--blue));
}
.summary-card .label {
  font-size: 11px; font-weight: 500; opacity: 0.85;
  text-transform: uppercase; letter-spacing: 0.5px;
}
.summary-card .value {
  font-size: 22px; font-weight: 900; line-height: 1.2;
}
.summary-card .icon {
  font-size: 22px;
}
/* Kepala kartu KPI: emoji di kiri label, proporsional dengan ukuran label */
.summary-card .kpi-head {
  display: flex; align-items: center; gap: 6px;
  min-width: 0;
}
.summary-card .kpi-head .icon {
  font-size: 14px; line-height: 1;
  flex-shrink: 0;
}
.summary-card .kpi-head .label {
  font-size: 11px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
/* Stat card (klien) — kartu surface seragam dengan kartu lain di admin */
.stat-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: var(--s3) var(--s4);
  box-shadow: var(--shadow-sm);
}
.stat-value {
  font-size: 19px; font-weight: 800; color: var(--ink); line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.stat-label {
  font-size: 10.5px; color: var(--ink-3); font-weight: 800; text-transform: uppercase; letter-spacing: .06em;
  display: flex; align-items: center; gap: 5px;
}
/* nilai kartu: warna teks saja (bukan badge background) */
.stat-value.green,.stat-mini .sm-val.green{background:none;color:var(--green);}
.stat-value.orange,.stat-mini .sm-val.orange{background:none;color:var(--primary);}
`, `.text-xs {
  font-size: 11px;
}
.hint {
  font-size: 12px; color: var(--text3);
}
`);

// ── 17. badge.compact (mati) ──
rep('badge-compact', `.badge.compact {
  font-size: 13px; padding: 6px 14px;
}
`, '');

// ── 18. lead family (mati) ──
rep('lead', `/* ===== LEADS PAGE ===== */
/* Kolom Nama/Kontak: nama, alamat, WA tersusun rapi vertikal */
.lead-contact {
  min-width: 180px; display: flex; flex-direction: column; gap: 3px;
}
.lead-name {
  font-size: 14px; font-weight: 700; color: var(--text); line-height: 1.3;
}
.lead-addr {
  font-size: 12px; color: var(--text3); line-height: 1.3; display: flex; align-items: center; gap: 4px;
}
.lead-addr::before {
  content: '📍'; font-size: 11px;
}
/* Kolom Sumber & Tanggal */
.lead-app,
.lead-date {
  white-space: nowrap; color: var(--text2); font-size: 13px;
}
`, '');

// ── 19. app-row family + license-header + status-pill (mati) ──
rep('app-row', `/* Produk registry — baris produk lisensi */
.app-row {
  display: grid; gap: var(--space-2) var(--space-3);
  padding: var(--space-3); background: var(--bg);
  border: 1px solid var(--border); border-radius: var(--radius);
  margin-bottom: var(--space-2);
}
.app-row-main {
  display: flex; align-items: center; gap: var(--space-3); min-width: 0;
}
.app-row-icon {
  font-size: 22px; text-align: center; flex-shrink: 0;
}
.app-row-info {
  min-width: 0; display: flex; flex-direction: column; gap: 2px;
}
.app-row-name {
  font-size: 14px; font-weight: 700; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.app-row-prefix {
  font-size: 12px; color: var(--text3);
}
.app-row-salt {
  font-family: 'Space Mono', monospace; font-size: 12px;
  padding: var(--space-2) var(--space-3); width: 100%;
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--bg-card); color: var(--text2); min-width: 0;
}
.app-row-price {
  font-size: 14px; font-weight: 800; color: var(--primary); white-space: nowrap;
}
.app-row-actions {
  display: flex; gap: var(--space-2); justify-content: flex-end;
}
/* HP: tumpuk vertikal (icon + info satu baris, salt, harga, aksi) */
.app-row {
  grid-template-columns: 1fr;
}
.app-row .app-row-salt, .app-row .app-row-price, .app-row .app-row-actions {
  grid-column: 1 / -1;
}
.license-header .badge {
  margin-left: 6px;
}
.status-pill {
  display: inline-block; padding: 3px 10px; border-radius: var(--radius-full); background: var(--orange-50); color: var(--primary-dark); font-size: 12px; font-weight: 600;
}
`, '');

// ── 20. row-icon (mati) ──
rep('row-icon', `.row-icon{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;background:var(--bg);flex-shrink:0;}
`, '');

// ── 21. seg family (mati) ──
rep('seg', `/* Segmented toggle List / Kanban */
.seg {
  display: inline-flex; background: var(--bg-card, var(--surface)); border: 1px solid var(--border); border-radius: var(--radius-full, 999px); padding: 3px; gap: 2px;
}
.seg .client-view-btn {
  border: none; background: transparent; padding: 7px 16px; border-radius: var(--radius-full, 999px); font-size: 13px; font-weight: 700; color: var(--ink-2, var(--text2)); cursor: pointer; transition: all .15s var(--ease, ease);
}
.seg .client-view-btn:hover { color: var(--brand-ink, var(--primary)); }
.seg .client-view-btn.active { background: var(--primary); color: #fff; }
.panel-sub`, `.panel-sub`);

// ── 22. kb-status family (mati) ──
rep('kb-status', `/* Status chip — selalu tampil */
.kb-status {
  flex-shrink: 0;
  font-size: 10.5px;
  font-weight: 700;
  line-height: 1;
  padding: 4px 8px;
  border-radius: var(--radius-full, 999px);
  background: var(--bg-muted, rgba(0,0,0,.05));
  color: var(--text2);
  white-space: nowrap;
}
.kb-status.blue   { background: rgba(37,99,235,.12); color: #1d4ed8; }
.kb-status.orange { background: rgba(217,80,20,.12); color: #c2410c; }
.kb-status.amber  { background: rgba(217,119,6,.13); color: #b45309; }
.kb-status.teal   { background: rgba(15,123,123,.13); color: #0e7490; }
.kb-status.green  { background: rgba(22,128,76,.13); color: #15803d; }
.kb-status.red    { background: rgba(192,57,43,.12); color: #b91c1c; }
.kb-status.gray   { background: rgba(0,0,0,.06); color: var(--text2); }

`, '');

// ── 23. kb-manage (mati) ──
rep('kb-manage', `/* Panel Kelola Klien — sub-akordeon trigger */
.kb-manage { margin-top: 12px; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; background: var(--bg-card, var(--surface)); }
.kb-manage-t { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; padding: 8px 10px; background: var(--bg-muted, rgba(0,0,0,.03)); border: none; color: var(--text); font-size: 12px; font-weight: 800; cursor: pointer; }
.kb-manage-t:hover { background: var(--bg-muted, rgba(0,0,0,.06)); }
/* Sub-akordeon body — sama pola grid 0fr→1fr */


`, '');

// ── 24. kb-card-status (mati) ──
rep('kb-card-status', `.kb-card-status { margin-left: auto; flex-shrink: 0; }
`, '');

// ── 25. media 640 cleanups ──
rep('media640-a', `  .page-h{font-size:20px;}
  .kpi-grid{grid-template-columns:repeat(2,1fr);gap:var(--s3);}
    .summary-card .value{font-size:19px;}
  .stat-value{font-size:19px;}
  .field-grid-2{grid-template-columns:1fr;}
  .toolbar-right{flex-direction:column;align-items:stretch;width:100%;}`, `  .field-grid-2{grid-template-columns:1fr;}
  .toolbar-right{flex-direction:column;align-items:stretch;width:100%;}`);
rep('media640-b', `  .product-row{grid-template-columns:32px 1fr;grid-auto-rows:auto;gap:var(--s2);}
  .pr-salt,.pr-price{grid-column:1/-1;}
  /* Form detail: tumpuk di layar kecil */`, `  /* Form detail: tumpuk di layar kecil */`);
rep('media640-c', `  .cd-head{flex-direction:column;align-items:flex-start;}
  /* Catalog card: kompak di HP */`, `  /* Catalog card: kompak di HP */`);

// ── 26. landscape stat-grid (mati) ──
rep('landscape', `
/* Landscape: phone + tablet → KPI jadi 4 kolom */
@media (max-width:1024px) and (orientation:landscape){
  .stat-grid{grid-template-columns:repeat(4,1fr);}
  .stat-value{font-size:18px);}
}
`, '\n');
rep('landscape-fix', `
/* Landscape: phone + tablet → KPI jadi 4 kolom */
@media (max-width:1024px) and (orientation:landscape){
  .stat-grid{grid-template-columns:repeat(4,1fr);}
  .stat-value{font-size:18px;}
}
`, '\n');

// ── 27. kpi-grid & grid-2col (mati) ──
rep('kpi-grid-1280', `@media (max-width:1280px){.kpi-grid{grid-template-columns:repeat(3,1fr);}}
`, '');
rep('grid-2col', `.grid-2col{display:grid;grid-template-columns:1fr 1fr;gap:var(--s3);}
`, '');
rep('kpi-grid-1024', `  .kpi-grid{grid-template-columns:repeat(2,1fr);}
`, '');
rep('kpi-grid-640', `  .kpi-grid{grid-template-columns:repeat(2,1fr);gap:var(--s3);}
`, '');

// ── 28. Enterprise polish block (append) ──
rep('polish-append', `.content-badge-warn{font-size:10.5px;font-weight:800;color:var(--red);background:var(--red-bg);padding:2px 8px;border-radius:999px;margin-left:6px;}`, `.content-badge-warn{font-size:10.5px;font-weight:800;color:var(--red);background:var(--red-bg);padding:2px 8px;border-radius:999px;margin-left:6px;}

/* ===== ENTERPRISE POLISH (2026-09-10) — state, a11y, konsistensi ===== */
/* Disabled states */
.btn:disabled,.btn[disabled],.btn[aria-disabled="true"]{opacity:.45;cursor:not-allowed;pointer-events:none;}
.field input:disabled,.field select:disabled,.field textarea:disabled{background:var(--bg-subtle);color:var(--ink-3);cursor:not-allowed;}
/* Validasi inline: field bertipe (url/email/number) invalid = aksen merah */
.field input:not(:placeholder-shown):invalid,.field textarea:not(:placeholder-shown):invalid{border-color:var(--red);}
.field input:not(:placeholder-shown):invalid:focus,.field textarea:not(:placeholder-shown):invalid:focus{box-shadow:0 0 0 3px var(--red-bg);}
/* Link telanjang di konten: underline saat hover */
.content a:not([class]):hover{text-decoration:underline;}
/* Print: cetak data tanpa chrome admin */
@media print{
  .sidebar,.topbar,.bottom-nav,.fab,.scrim,.overlay,.skip-link{display:none!important;}
  .app{grid-template-columns:1fr;}
  .content{padding:0;max-width:none;}
  .panel{box-shadow:none;break-inside:avoid;}
}`);

// ── run ──
for (const [name, oldS, newS] of reps) {
  if (css.includes(oldS)) { css = css.replace(oldS, newS); hit++; }
  else { miss++; console.log('MISS: ' + name); }
}
fs.writeFileSync(F, css);
console.log(`done: ${hit}/${reps.length} applied, ${miss} missed`);
