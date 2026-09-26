/* Probe v2 — pakai Function() agar finder dieksekusi di dalam browser scope */
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = "http://127.0.0.1:5180/";
const OUT = new URL("./qa-shots/", import.meta.url).pathname.replace(/^\//, "");
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--user-data-dir=" + OUT + "profile"],
});
const page = await browser.newPage();
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 160)); });
page.on("framenavigated", (f) => { if (f === page.mainFrame()) errors.push("NAV: " + f.url()); });

const ev = async (label, fn) => {
  try { return await page.evaluate(fn); }
  catch (e) { errors.push(label + ": " + e.message.slice(0, 120)); return null; }
};

/* clickIn(label, text, finderSource) → eval sumber di dalam page */
const clickIn = async (label, text, finderSrc) => ev("click:" + label, (t, src) => {
  const find = new Function("return " + src)();
  const root = find();
  if (!root) return "no-root";
  const list = [...root.querySelectorAll("button")].filter((b) => b.textContent.includes(t));
  const b = list.find((x) => x.textContent.trim() === t) || list[0];
  if (b) { b.click(); return b.textContent.trim().slice(0, 30); }
  return "no-match";
}, text, finderSrc);

const FIND_NAV = "document.querySelector('nav[class*=\"fixed\"][class*=\"bottom-0\"]')";
const FIND_SHEET = "[...document.querySelectorAll('div')].find((d) => String(d.className).includes('animate-sheet-up'))";

// Login
await page.goto(BASE, { waitUntil: "networkidle2", timeout: 30000 });
await sleep(3000);
const a = await clickIn("demoBtn", "Masuk sebagai Demo", "document");
await sleep(400);
const b = await clickIn("demoUser", "Budi Santoso", "document");
await sleep(2500);
errors.push("loginSteps: " + a + " / " + b);
errors.push("loggedIn: " + await ev("loginCheck", () => !/Masuk sebagai Demo/.test(document.body.innerText)));

// 1) kondisi MOBILE
const mState = await ev("mState", () => ({
  innerW: window.innerWidth,
  innerH: window.innerHeight,
  aside: !!document.querySelector("aside"),
  header: !!document.querySelector("header"),
  nav: !!document.querySelector('nav[class*="fixed"][class*="bottom-0"]'),
  text: document.body.innerText.slice(0, 80),
}));

// 2) resize desktop
await page.setViewport({ width: 1360, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false });
await sleep(2500);
const dState = await ev("dState", () => {
  const aside = document.querySelector("aside");
  const wrap = aside ? aside.parentElement : null;
  return {
    innerW: window.innerWidth,
    aside: !!aside,
    asideDisplay: aside ? getComputedStyle(aside).display : null,
    asideW: aside ? Math.round(aside.getBoundingClientRect().width) : null,
    wrapDisplay: wrap ? getComputedStyle(wrap).display : null,
    wrapClasses: wrap ? String(wrap.className).slice(0, 80) : null,
    header: !!document.querySelector("header"),
    text: document.body.innerText.slice(0, 80),
  };
});
await page.screenshot({ path: OUT + "probe-desktop.png" });

// 3) balik mobile → dark mode via sheet (pakai FIND_NAV & FIND_SHEET)
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await sleep(2000);
errors.push("afterMobileWait: innerW=" + await ev("w", () => window.innerWidth));
const openMenu = await clickIn("menuBtn", "Menu", FIND_NAV);
await sleep(800);
const darkClick = await clickIn("modeGelap", "Mode Gelap", FIND_SHEET);
await sleep(900);
const darkState = await ev("dark", () => document.documentElement.classList.contains("dark") ? "dark-on" : "dark-off");
await page.screenshot({ path: OUT + "probe-dark.png" });
const darkBack = await clickIn("modeTerang", "Mode Terang", FIND_SHEET);
await sleep(600);
const darkBackState = await ev("darkBack", () => document.documentElement.classList.contains("dark") ? "dark-on" : "dark-off");

fs.writeFileSync("./qa-probe.json", JSON.stringify({ mState, dState, openMenu, darkClick, darkState, darkBack, darkBackState, errors }, null, 2), "utf8");
console.log("DONE");
await browser.close();
