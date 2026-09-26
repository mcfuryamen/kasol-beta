/* QA harness v4 — puppeteer-core + Chrome sistem. Semua evaluate pakai arg passing. */
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = "http://127.0.0.1:5180/";
const OUT = new URL("./qa-shots/", import.meta.url).pathname.replace(/^\//, "");
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--user-data-dir=" + OUT + "profile"],
});
const page = await browser.newPage();
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 160)); });
const shot = (name) => page.screenshot({ path: OUT + name + ".png" });
const ev = async (label, fn, ...args) => {
  try { return await page.evaluate(fn, ...args); }
  catch (e) { errors.push(label + ": " + e.message.slice(0, 120)); return null; }
};

/* Klik tombol ber-teks <txt> dalam root elemen hasil <findFn> (arg: fnSource string di-eval) */
const clickIn = async (label, txt, finder) => ev("click:" + label, (t, findSrc) => {
  const find = eval(findSrc);
  const root = find();
  if (!root) return "no-root";
  const matches = [...root.querySelectorAll("button")].filter((b) => b.textContent.includes(t));
  const b = matches.find((x) => x.textContent.trim() === t) || matches[0];
  if (b) { b.click(); return b.textContent.trim().slice(0, 30); }
  return "no-match";
}, txt, finder);

const FIND_NAV = "() => document.querySelector('nav[class*=\"fixed\"][class*=\"bottom-0\"]')";
const FIND_SHEET = "() => [...document.querySelectorAll('div')].find((d) => String(d.className).includes('animate-sheet-up'))";
const FIND_MAIN = "() => document.querySelector('main')";
const FIND_KASMODAL = "() => [...document.querySelectorAll('div')].find((d) => String(d.className).includes('bg-black/60') && String(d.className).includes('z-['))";
const FIND_HEADER = "() => document.querySelector('header')";

async function loginAsDemo() {
  await page.goto(BASE, { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(3000);
  const a = await clickIn("demoBtn", "Masuk sebagai Demo", "() => document");
  if (a === "no-match" || a === "no-root") return false;
  await sleep(400);
  const b = await clickIn("demoUser", "Budi Santoso", "() => document");
  if (b === "no-match" || b === "no-root") return false;
  await sleep(2500);
  return await ev("logged", () => !/Masuk sebagai Demo/.test(document.body.innerText));
}

const results = {};

// ---------- MOBILE 390x844 ----------
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
results.login = await loginAsDemo();

results.mobileDashboard = await ev("mDom", (findNavSrc) => {
  const nav = eval(findNavSrc)();
  const sidebar = document.querySelector("aside");
  const header = document.querySelector("header");
  const main = document.querySelector("main");
  return {
    bottomNavVisible: !!nav && nav.getBoundingClientRect().height > 0,
    bottomNavBtns: nav ? [...nav.querySelectorAll("button")].map((b) => b.textContent.trim()) : [],
    sidebarHiddenOnMobile: !sidebar || sidebar.getBoundingClientRect().width === 0,
    headerPt: header ? getComputedStyle(header).paddingTop : null,
    mainPb: main ? getComputedStyle(main).paddingBottom : null,
    innerW: window.innerWidth,
  };
}, FIND_NAV);
await shot("m1-dashboard");

results.openSheet = await clickIn("menuBtn", "Menu", FIND_NAV);
await sleep(700);
results.sheetItems = await ev("sheet", (findSheetSrc) => {
  const panel = eval(findSheetSrc)();
  if (!panel) return false;
  return [...panel.querySelectorAll("button")].map((b) => b.textContent.trim()).filter(Boolean).slice(0, 16);
}, FIND_SHEET);
await shot("m2-menu-sheet");

// navigasi via item DI DALAM sheet (bukan sidebar tersembunyi) → sheet harus tertutup
results.toReports = await clickIn("sheetLaporan", "Laporan", FIND_SHEET);
await sleep(1500);
results.reportsOk = await ev("reports", (findSheetSrc) => ({
  sheetClosed: !eval(findSheetSrc)(),
  isReports: /Laporan/.test(document.body.innerText) && !/Selamat datang/.test(document.body.innerText),
}), FIND_SHEET);
await shot("m3-reports");

// bottom nav → Kasir (POS)
results.toPos = await clickIn("navKasir", "Kasir", FIND_NAV);
await sleep(2000);
results.posNavHidden = await ev("posNav", (findNavSrc) => {
  const nav = eval(findNavSrc)();
  return !nav || nav.getBoundingClientRect().height === 0;
}, FIND_NAV);
results.kasRequiredScreen = await ev("kas", () => /Kas Belum Dibuka|Buka Kas Terlebih/.test(document.body.innerText));

// buka kas: klik "Buka Kas Sekarang" di main → modal → submit "Buka Kas" di modal
results.kasStep1 = await clickIn("bukaKasSekarang", "Buka Kas Sekarang", FIND_MAIN);
await sleep(900);
results.kasModalOpen = await ev("kasModal", (findModalSrc) => !!eval(findModalSrc)(), FIND_KASMODAL);
results.kasStep2 = await clickIn("modalSubmit", "Buka Kas", FIND_KASMODAL);
await sleep(1800);
results.shiftActive = await ev("shift", () => !/Kas Belum Dibuka|Buka Kas Terlebih/.test(document.body.innerText));
results.posMobileGrid = await ev("grid", () =>
  [...document.querySelectorAll("button")].filter((b) => /Stok \d+/.test(b.textContent)).length
);
await shot("m4-pos");

// tambah item lewat kartu produk grid mobile
results.addItem = await ev("add", () => {
  const card = [...document.querySelectorAll("button")].find((b) => /Stok \d+/.test(b.textContent) && !b.disabled);
  if (card) { card.click(); return card.textContent.trim().slice(0, 40); }
  return false;
});
await sleep(1200);
results.cartState = await ev("cart", () => ({
  subtotal: /Subtotal/i.test(document.body.innerText),
  totalText: (document.body.innerText.match(/Total[^\n]*/) || [""])[0],
}));
await shot("m5-pos-cart");

// dark mode: POS tanpa bottom nav → buka sheet via hamburger header → toggle dalam sheet
results.openSheetHeader = await clickIn("hamburger", "x", FIND_HEADER);
await sleep(700);
results.darkToggle = await clickIn("modeGelap", "Mode Gelap", FIND_SHEET);
await sleep(900);
results.darkState = await ev("darkState", () => document.documentElement.classList.contains("dark") ? "dark-on" : "dark-off");
await shot("m7-dark");
await clickIn("modeTerang", "Mode Terang", FIND_SHEET);
await sleep(600);
results.darkStateBack = await ev("darkBack", () => document.documentElement.classList.contains("dark") ? "dark-on" : "dark-off");

// ---------- DESKTOP 1360x900 ----------
await page.setViewport({ width: 1360, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false });
await sleep(2000);
results.desktop = await ev("desk", (findNavSrc) => {
  const nav = eval(findNavSrc)();
  const sidebar = document.querySelector("aside");
  const wrap = sidebar ? sidebar.parentElement : null;
  const t = document.body.innerText;
  return {
    innerW: window.innerWidth,
    sidebarExists: !!sidebar,
    sidebarDisplay: sidebar ? getComputedStyle(sidebar).display : null,
    sidebarWidth: sidebar ? Math.round(sidebar.getBoundingClientRect().width) : null,
    wrapDisplay: wrap ? getComputedStyle(wrap).display : null,
    bottomNavHidden: !nav || nav.getBoundingClientRect().height === 0,
    chip: (t.match(/[^\n]*(Trial|Siap Pakai|DITANGGUHKAN|KEDALUWARSA|TIDAK AKTIF|tersisa)[^\n]*/i) || [null])[0],
  };
}, FIND_NAV);
await shot("d1-desktop");

fs.writeFileSync("./qa-run.json", JSON.stringify({ results, errors: errors.slice(0, 25) }, null, 2), "utf8");
console.log("DONE");
await browser.close();
