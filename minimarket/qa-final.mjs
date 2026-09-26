/* QA final — puppeteer-core + chrome. Setiap evaluate tanpa eval() runtime. */
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = "http://127.0.0.1:5180/";
const OUT = new URL("./qa-shots/", import.meta.url).pathname.replace(/^\//, "");
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--user-data-dir=" + OUT + "profile"],
});

// ===== MOBILE SESSION =====
const mPage = await browser.newPage();
mPage.on("pageerror", (e) => errors.push("M pageerror: " + e.message));
mPage.on("console", (m) => { if (m.type() === "error") errors.push("M console: " + m.text().slice(0, 160)); });
await mPage.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

await mPage.goto(BASE, { waitUntil: "networkidle2", timeout: 30000 });
await sleep(3000);

// Login
async function clickText(page, t, rootSel = "document") {
  return await page.evaluate((text, rootSel) => {
    const root = rootSel === "document" ? document : document.querySelector(rootSel);
    if (!root) return "no-root:" + rootSel;
    const list = [...root.querySelectorAll("button")].filter((b) => b.textContent.includes(text));
    const b = list.find((x) => x.textContent.trim() === text) || list[0];
    if (b) { b.click(); return b.textContent.trim().slice(0, 30); }
    return "no-match";
  }, t, rootSel);
}

const NAV = 'nav[class*="fixed"][class*="bottom-0"]';
const SHEET = () => `[...document.querySelectorAll('div')].find((d) => String(d.className).includes('animate-sheet-up'))`;
const SHEET_SEL = '[data-role~="sheet"], div.animate-sheet-up';

const r1 = await clickText(mPage, "Masuk sebagai Demo");
await sleep(400);
const r2 = await clickText(mPage, "Budi Santoso");
await sleep(2500);

const results = {};

results.MLogin = { r1, r2 };

// 1) Mobile dashboard
results.MDash = await mPage.evaluate((navSel) => {
  const nav = document.querySelector(navSel);
  const aside = document.querySelector("aside");
  const header = document.querySelector("header");
  const main = document.querySelector("main");
  return {
    innerW: window.innerWidth,
    text: document.body.innerText.slice(0, 80),
    navExists: !!nav,
    navVisible: nav ? nav.getBoundingClientRect().height > 0 : false,
    asideExists: !!aside,
    headerExists: !!header,
    mainPb: main ? getComputedStyle(main).paddingBottom : null,
    innerTextIncludesSelamat: /Selamat datang/.test(document.body.innerText),
  };
}, NAV);

await mPage.screenshot({ path: OUT + "f1-mobile-dash.png" });

// 2) Open sheet & dark mode
const openMenu = await mPage.evaluate((navSel) => {
  const nav = document.querySelector(navSel);
  if (!nav) return "no-nav";
  const b = [...nav.querySelectorAll("button")].find((x) => x.textContent.trim() === "Menu");
  if (b) { b.click(); return "clicked:Menu"; } return "no-menu-btn";
}, NAV);
await sleep(800);

const darkClick = await mPage.evaluate(() => {
  const panel = [...document.querySelectorAll("div")].find((d) => String(d.className).includes("animate-sheet-up"));
  if (!panel) return "no-sheet";
  const b = [...panel.querySelectorAll("button")].find((x) => /Mode Gelap/.test(x.textContent));
  if (b) { b.click(); return "clicked:Mode Gelap"; } return "no-dark-btn";
});
await sleep(900);
results.MDark = await mPage.evaluate(() => ({
  htmlClass: document.documentElement.className,
  isDark: document.documentElement.classList.contains("dark"),
}));
await mPage.screenshot({ path: OUT + "f2-mobile-dark.png" });

// toggle back
await mPage.evaluate(() => {
  const panel = [...document.querySelectorAll("div")].find((d) => String(d.className).includes("animate-sheet-up"));
  if (panel) {
    const b = [...panel.querySelectorAll("button")].find((x) => /Mode Terang/.test(x.textContent));
    b?.click();
  }
});
await sleep(500);

// 3) Sheet → klik Laporan
const r3 = await mPage.evaluate(() => {
  const panel = [...document.querySelectorAll("div")].find((d) => String(d.className).includes("animate-sheet-up"));
  if (!panel) return "no-sheet";
  const b = [...panel.querySelectorAll("button")].find((x) => x.textContent.trim() === "Laporan");
  if (b) { b.click(); return "clicked:Laporan"; } return "no-Laporan-btn";
});
await sleep(1500);
results.MReports = await mPage.evaluate((navSel) => ({
  innerW: window.innerWidth,
  onReports: /Selamat datang|Selamat/.test(document.body.innerText) ? "still-dashboard" : "moved",
  text: document.body.innerText.slice(0, 80),
  navExists: !!document.querySelector(navSel),
}), NAV);
await mPage.screenshot({ path: OUT + "f3-mobile-reports.png" });

// 4) POS → buka kas → tambah
const r4 = await clickText(mPage, "Kasir", NAV);
await sleep(2000);
const isKasRequired = await mPage.evaluate(() => /Kas Belum Dibuka|Buka Kas Terlebih/.test(document.body.innerText));
results.MPosBefore = { isKasRequired, click: r4 };

if (isKasRequired) {
  await clickText(mPage, "Buka Kas Sekarang", "main");
  await sleep(900);
  const open = await mPage.evaluate(() => !![...document.querySelectorAll("div")].find((d) => String(d.className).includes("bg-black/60") && String(d.className).includes("z-[100")));
  if (open) await clickText(mPage, "Buka Kas");
  await sleep(2000);
}

results.MPosAfter = await mPage.evaluate(() => {
  const cards = [...document.querySelectorAll("button")].filter((b) => /Stok \d+/.test(b.textContent));
  const card = cards.find((b) => !b.disabled);
  if (card) { card.click(); return card.textContent.trim().slice(0, 40); }
  return "no-card";
});
await sleep(1200);
results.MCart = await mPage.evaluate(() => ({ subtotal: /Subtotal/i.test(document.body.innerText) }));
await mPage.screenshot({ path: OUT + "f4-mobile-pos-cart.png" });

// ===== DESKTOP SESSION (tidak resize, pakai sesi kedua) =====
const dPage = await browser.newPage();
dPage.on("pageerror", (e) => errors.push("D pageerror: " + e.message));
dPage.on("console", (m) => { if (m.type() === "error") errors.push("D console: " + m.text().slice(0, 160)); });

// TIDAK ada persistensi login → pakai login terpisah
await dPage.setViewport({ width: 1360, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false });
await dPage.goto(BASE, { waitUntil: "networkidle2", timeout: 30000 });
await sleep(3000);
await clickText(dPage, "Masuk sebagai Demo");
await sleep(400);
await clickText(dPage, "Budi Santoso");
await sleep(2500);

results.DLogin = await dPage.evaluate(() => !/Masuk sebagai Demo/.test(document.body.innerText));

results.DDash = await dPage.evaluate(() => {
  const aside = document.querySelector("aside");
  const header = document.querySelector("header");
  const nav = document.querySelector('nav[class*="fixed"][class*="bottom-0"]');
  const wrap = aside ? aside.parentElement : null;
  const t = document.body.innerText;
  return {
    innerW: window.innerWidth,
    loggedIn: /Selamat datang/.test(t),
    asideExists: !!aside,
    asideRect: aside ? aside.getBoundingClientRect() : null,
    wrapClasses: wrap ? String(wrap.className).slice(0, 80) : null,
    headerExists: !!header,
    bottomNavExists: !!nav,
    bottomNavHeight: nav ? nav.getBoundingClientRect().height : null,
    chip: (t.match(/[^\n]*(Trial|Siap Pakai|DEMO|tersisa|Kas Aktif|Buka Kas)[^\n]*/i) || [null])[0],
  };
});
await dPage.screenshot({ path: OUT + "f5-desktop.png" });

fs.writeFileSync("./qa-final.json", JSON.stringify({ results, errors: errors.slice(0, 30) }, null, 2), "utf8");
console.log("DONE");
await browser.close();
