// Smoke test tipografi kaki5 (audit 2026-11-05): cek computed style token,
// error konsol, dan screenshot beberapa layer.
// playwright tidak terpasang lokal → pakai paket global @playwright/mcp.
const path = require('path');
const { chromium } = require(path.join(
  process.env.APPDATA || '', 'npm', 'node_modules', '@playwright', 'mcp', 'node_modules', 'playwright'));
const fs = require('fs');

const URL = 'http://127.0.0.1:8086/';
const OUT = '_smoke-shots';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  // Chromium build global (1246) tidak ada di cache; pakai Google Chrome sistem.
  const browser = await chromium.launch({ channel: 'chrome' });
  const errors = [], warnings = [];

  async function newPage(viewport) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('console', (m) => {
      const t = m.type();
      if (t === 'error') errors.push(m.text().slice(0, 160));
      else if (t === 'warning') warnings.push(m.text().slice(0, 160));
    });
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 160)));
    return { ctx, page };
  }

  // ── Mobile ──
  let { ctx, page } = await newPage({ width: 390, height: 844 });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  // Lepas lock login bila muncul (mode "Lanjut tanpa akun")
  const bypass = page.locator('[data-action="akun-lanjut-perangkat"]');
  if (await bypass.count() && await bypass.first().isVisible().catch(() => false)) {
    await bypass.first().click();
    await page.waitForTimeout(1200);
  }

  const probe = await page.evaluate(() => {
    const fs = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { size: cs.fontSize, weight: cs.fontWeight, h: Math.round(el.getBoundingClientRect().height) };
    };
    const root = getComputedStyle(document.documentElement);
    return {
      tokens: {
        fs16: root.getPropertyValue('--fs-16').trim(),
        fs14: root.getPropertyValue('--fs-14').trim(),
        fs22: root.getPropertyValue('--fs-22').trim(),
      },
      btn: fs('.btn'), formInput: fs('.form-input'), cardTitle: fs('.card-title'),
      modalTitle: fs('.modal-title'), navItem: fs('.nav-item'), statValue: fs('.stat-value'),
      statLabel: fs('.stat-label'), toast: fs('.toast'),
      lockOverlay: !!document.querySelector('#akunModal.show'),
      bodyFont: getComputedStyle(document.body).fontSize,
    };
  });

  await page.screenshot({ path: OUT + '/01-beranda.png', fullPage: false });

  // Pengaturan + modal akun
  await page.goto(URL + '#pengaturan', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: OUT + '/02-pengaturan.png' });

  const akunBtn = page.locator('[data-action="open-akun-modal"]');
  if (await akunBtn.count()) {
    await akunBtn.first().click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: OUT + '/03-modal-akun.png' });
    const modalProbe = await page.evaluate(() => {
      const m = document.querySelector('#akunModal .modal');
      if (!m) return null;
      const t = m.querySelector('.modal-title');
      return {
        titleSize: t ? getComputedStyle(t).fontSize : null,
        inputSize: (() => { const i = m.querySelector('.form-input'); return i ? getComputedStyle(i).fontSize : null; })(),
        btnSize: (() => { const b = m.querySelector('.btn'); return b ? getComputedStyle(b).fontSize : null; })(),
        btnH: (() => { const b = m.querySelector('.btn'); return b ? Math.round(b.getBoundingClientRect().height) : null; })(),
      };
    });
    probe.modal = modalProbe;
    await page.keyboard.press('Escape');
  }

  // Jualan (POS) — cek layer paling padat
  await page.goto(URL + '#jualan', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: OUT + '/04-jualan.png' });
  probe.pos = await page.evaluate(() => {
    const items = document.querySelectorAll('.menu-item').length;
    const qty = document.querySelector('button[data-action="menu-selector-qty"]');
    const rm = document.querySelector('.topping-rm-btn');
    const size = (el) => (el ? { w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) } : null);
    return { menuItems: items, menuQtyBtn: size(qty), toppingRm: size(rm) };
  });

  // ── Probe kelas Tahap 3 + cart sintetis (dev profile tidak punya data menu) ──
  await page.goto(URL + '#jualan', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  probe.tahap3 = await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'probeStage';
    host.style.cssText = 'position:fixed;left:-9999px;top:0;width:390px';
    host.innerHTML = `
      <div class="karrow">›</div>
      <span class="kver-chip">TERPASANG</span>
      <div class="knote-box">catatan</div>
      <div class="kreport-pct">30%</div>
      <div class="klegend"><div class="klegend-dot"></div>Omzet</div>
      <div class="ksummary-row">a <b>b</b></div>
      <div class="klic-title">x</div>
      <div class="kpay-box">pay</div>
      <div class="kamount-lg kmono">123</div>
      <div class="ktrx-sub">+ item</div>
      <table class="ktrx-table"><tr><td>x</td></tr></table>
      <button class="btn btn-secondary btn-xs">mini</button>
      <div class="akun-badge akun-badge-kasir">Kasir</div>
      <div class="cart-item">
        <div class="cart-name-row"><span class="cart-name">Es Teh</span><span class="cart-name-price">Rp 5.000</span></div>
        <div class="cart-topping-tags"><span class="topping-tag">+ gula</span></div>
      </div>`;
    document.body.appendChild(host);
    const g = (sel) => {
      const el = host.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { fs: cs.fontSize, color: cs.color, bg: cs.backgroundColor, w: Math.round(r.width), h: Math.round(r.height), disp: cs.display };
    };
    const out = {
      karrow: g('.karrow'), kverChip: g('.kver-chip'), knoteBox: g('.knote-box'),
      kreportPct: g('.kreport-pct'), klegend: g('.klegend'), ksummary: g('.ksummary-row'),
      klicTitle: g('.klic-title'), kpayBox: g('.kpay-box'), kamount: g('.kamount-lg'),
      ktrxSub: g('.ktrx-sub'), ktrxTable: g('.ktrx-table'), btnXs: g('.btn-xs'),
      akunBadgeKasir: g('.akun-badge-kasir'),
      cartItem: g('.cart-item'), cartNameRow: g('.cart-name-row'), cartName: g('.cart-name'),
      cartNamePrice: g('.cart-name-price'), cartTags: g('.cart-topping-tags'), toppingTag: g('.topping-tag'),
    };
    host.remove();
    return out;
  });

  // ── Tablet 900px (cek eskalasi breakpoint) ──
  await page.setViewportSize({ width: 900, height: 1000 });
  await page.goto(URL + '#beranda', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: OUT + '/05-beranda-tablet.png' });
  probe.tablet = await page.evaluate(() => {
    const fs = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).fontSize : null; };
    return { btn: fs('.btn'), formInput: fs('.form-input'), cardTitle: fs('.card-title'), navItem: fs('.nav-item') };
  });

  await ctx.close();
  await browser.close();

  console.log(JSON.stringify({ probe, errorCount: errors.length, errors: errors.slice(0, 8), warningCount: warnings.length, warnings: warnings.slice(0, 5) }, null, 2));
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
