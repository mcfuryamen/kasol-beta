/**
 * Wali Santri Portal Module (ESM)
 * Portal orang tua/wali — read-only: melihat progres anak, kehadiran, tagihan, notifikasi.
 * Menggunakan query db.* langsung yang identik dengan HTML aktif agar perilaku tidak berubah.
 */
import { db } from '../../db/dexie.js';
import {
  $id, el, ini, fc, fd, fdl, today, nowLocal, monthLocal,
  snack, openSheet, closeSheet, delRec, maskNis,
  getSessionUser, clearSessionUser, verifySession
} from '../../db/init.js';
import { seedDemoData } from '../../db/seed.js';

const $ = $id;

const GL = { mumtaz: 'Mumtaz', jayyid_jiddan: 'Jayyid Jiddan', jayyid: 'Jayyid', maqbul: 'Maqbul', belum_lulus: 'Belum Lulus' };
const GC = { mumtaz: 'bg-green', jayyid_jiddan: 'bg-blue', jayyid: 'bg-yellow', maqbul: 'bg-orange', belum_lulus: 'bg-red', lancar: 'bg-green', cukup: 'bg-yellow', mengulang: 'bg-red' };
const SC = { pending: 'bg-yellow', paid: 'bg-green', partial: 'bg-blue', overdue: 'bg-red', planned: 'bg-gray', in_progress: 'bg-blue', completed: 'bg-green' };

let U = null, LOC = null;
window.curTab = 'home';
window.curSub = '';

async function checkAuth() {
  U = await verifySession();
  if (!U || U.role !== 'wali') { clearSessionUser(); window.location.href = 'login.html'; return false; }
  LOC = { id: U.locationId, name: U.locationName };
  $('prof-btn').textContent = ini(U.name);
  return true;
}

function showProfile() {
  openSheet('Profil', `
    <div style="text-align:center;padding:12px 0">
      <div class="av av-xl av-o" style="margin:0 auto 12px">${ini(U.name)}</div>
      <div style="font-size:18px;font-weight:700">${U.name}</div>
      <div style="font-size:13px;color:var(--on-surface-variant)">Wali Santri</div>
      <div style="font-size:12px;color:var(--on-surface-variant);margin-top:4px">📍 ${LOC?.name || '-'}</div>
    </div>
    <div style="border-top:1px solid var(--outline-variant);margin-top:12px;padding-top:12px">
      <a href="login.html" class="btn btn-o btn-full" style="text-decoration:none;margin-bottom:8px;display:flex">↩️ Ganti Role</a>
      <button class="btn btn-d btn-full" onclick="clearSession();window.location.href='login.html'">🚪 Keluar</button>
    </div>`);
}
function goNotif() { window.curSub = 'notifications'; switchTab(window.curTab); }

const TABS = [
  { id: 'home', icon: '🏠', label: 'Beranda' },
  { id: 'progres', icon: '📈', label: 'Progres' },
  { id: 'keuangan', icon: '💰', label: 'Bayar' },
  { id: 'info', icon: '🔔', label: 'Info' },
];
const SUBS = { progres: ['hafalan', 'iqro', 'attendance'], keuangan: ['payments'], info: ['notifications'] };
const SLBL = { hafalan: 'Hafalan', iqro: 'Iqro', attendance: 'Kehadiran', payments: 'Pembayaran', notifications: 'Notifikasi' };
const TTITLES = { home: 'Kasir Solo - TPA', progres: 'Progres Anak', keuangan: 'Pembayaran', info: 'Informasi' };

function renderNav() {
  const nav = $('bnav'); nav.innerHTML = '';
  TABS.forEach(t => { nav.innerHTML += `<button class="nav-item ${t.id === window.curTab ? 'active' : ''}" onclick="switchTab('${t.id}')"><div class="nav-pill">${t.icon}</div><span class="nav-label">${t.label}</span></button>` });
}
function switchTab(tab) {
  window.curTab = tab; renderNav();
  const subs = SUBS[tab]; const sn = $('sub-nav');
  if (subs) {
    sn.classList.remove('hidden'); sn.innerHTML = '';
    window.curSub = window.curSub && subs.includes(window.curSub) ? window.curSub : subs[0];
    subs.forEach(s => { sn.innerHTML += `<button class="chip ${s === window.curSub ? 'active' : ''}" onclick="curSub='${s}';switchTab('${tab}')">${SLBL[s] || s}</button>` });
  } else { sn.classList.add('hidden'); if (tab === 'home') window.curSub = ''; }
  $('bar-title').textContent = TTITLES[tab] || '';
  $('bar-sub').textContent = window.curSub ? SLBL[window.curSub] || '' : '';
  $('fab').classList.add('hidden');
  render();
}
function onFab() {}
function render() {
  const c = $('content'); c.innerHTML = ''; c.scrollTop = 0;
  const pg = window.curSub || window.curTab;
  const r = { home: pgHome, hafalan: pgHafalan, iqro: pgIqro, attendance: pgAtt, payments: pgPay, notifications: pgNotifs };
  (r[pg] || r.home)(c);
}

async function getMyKids() {
  const gs = await db.guardians.where('locationId').equals(U.locationId).toArray();
  const g = gs.find(x => x.name === U.name) || gs[0];
  return g ? await db.students.where('guardianId').equals(g.id).toArray() : [];
}
async function pgHome(c) {
  const kids = await getMyKids();
  c.innerHTML = `<div class="hero"><p style="opacity:.8">${fdl(new Date())}</p><h2>Assalamu'alaikum 👋</h2><p>${U.name}</p></div><div id="wk"></div><div class="sec"><span class="sec-t">Update Terbaru</span></div><div class="m-card" id="wu"></div>`;
  const kbox = $('wk');
  kids.forEach(ch => { kbox.innerHTML += `<div class="m-card el"><div class="m-card-body"><div class="flex items-center gap-12"><div class="av av-l av-o">${ini(ch.name)}</div><div><div style="font-size:16px;font-weight:700">${ch.name}</div><div style="font-size:12px;color:var(--on-surface-variant)">NIS: ${maskNis(ch.nis)}</div><span class="badge ${ch.isActive ? 'bg-green' : 'bg-gray'}">${ch.isActive ? 'Aktif' : 'Off'}</span></div></div></div></div>` });
  const ubox = $('wu'); const ids = kids.map(k => k.id);
  if (!ids.length) { ubox.innerHTML = '<div class="empty"><span class="ei">👨‍👩‍👧</span><div class="et">Belum ada data anak</div></div>'; return; }
  const rec = await db.hafalanProgress.where('studentId').anyOf(ids).filter(h => h.locationId === U.locationId).reverse().sortBy('recordedAt');
  if (!rec.length) { ubox.innerHTML = '<div class="empty"><span class="ei">📖</span><div>Belum ada hafalan</div></div>'; return; }
  rec.slice(0, 8).forEach(h => {
    const st = kids.find(k => k.id === h.studentId);
    ubox.innerHTML += `<div class="li"><div class="li-icon av av-o">${ini(st?.name)}</div><div class="li-body"><div class="li-title">${st?.name || '-'}</div><div class="li-sub">${h.surahName} (${h.ayatFrom}-${h.ayatTo})</div></div><span class="badge ${GC[h.grade]}">${GL[h.grade] || h.grade}</span></div>`;
  });
}
async function pgHafalan(c) {
  const kids = await getMyKids(); c.innerHTML = '';
  for (const ch of kids) {
    const rec = await db.hafalanProgress.where('studentId').equals(ch.id).filter(h => h.locationId === U.locationId).reverse().sortBy('recordedAt');
    c.innerHTML += `<div class="sec"><span class="sec-t">${ch.name}</span></div><div class="m-card">${rec.length ? rec.slice(0, 10).map(h => `<div class="li"><div class="li-body"><div class="li-title">${h.surahName} (${h.ayatFrom}-${h.ayatTo})</div><div class="li-sub">${h.type} · ${fd(h.recordedAt)}</div></div><span class="badge ${GC[h.grade]}">${GL[h.grade] || h.grade}</span></div>`).join('') : '<div class="empty" style="padding:20px"><div>Belum ada</div></div>'}</div>`;
  }
}
async function pgIqro(c) {
  const kids = await getMyKids(); c.innerHTML = '';
  for (const ch of kids) {
    const rec = await db.iqroProgress.where('studentId').equals(ch.id).filter(h => h.locationId === U.locationId).reverse().sortBy('recordedAt');
    const last = rec[0];
    c.innerHTML += `<div class="m-card"><div class="m-card-body"><div style="font-weight:700;margin-bottom:8px">${ch.name}</div>${last ? `<div style="background:var(--brand-light);padding:14px;border-radius:var(--radius);text-align:center"><span style="font-size:18px;font-weight:800">Jilid ${last.jilid} · Halaman ${last.page}</span><br><span class="badge ${GC[last.grade]}" style="margin-top:6px">${last.grade}</span></div>` : '<div class="empty" style="padding:16px"><div>Belum ada data</div></div>'}</div></div>`;
  }
}
async function pgAtt(c) {
  const kids = await getMyKids(); c.innerHTML = '';
  for (const ch of kids) {
    const att = await db.attendances.where('studentId').equals(ch.id).toArray();
    const h = att.filter(a => a.status === 'hadir').length;
    c.innerHTML += `<div class="m-card"><div class="m-card-body"><div style="font-weight:700;margin-bottom:8px">${ch.name}</div><div style="display:flex;gap:8px;justify-content:center">${[['✅', h, 'bg-green'], ['📝', att.filter(a => a.status === 'izin').length, 'bg-blue'], ['🤒', att.filter(a => a.status === 'sakit').length, 'bg-yellow'], ['❌', att.filter(a => a.status === 'alpha').length, 'bg-red']].map(([i, v, cl]) => `<div style="text-align:center"><span class="badge ${cl}" style="font-size:16px;padding:6px 14px">${v}</span><div style="font-size:10px;margin-top:4px">${i}</div></div>`).join('')}</div><div style="margin-top:8px;font-size:14px;font-weight:700;text-align:center">${att.length ? Math.round(h / att.length * 100) + '%' : '-%'} hadir</div></div></div>`;
  }
}
async function pgPay(c) {
  const kids = await getMyKids(); const types = await db.sppTypes.toArray(); c.innerHTML = '';
  for (const ch of kids) {
    const bills = await db.sppBills.where('studentId').equals(ch.id).filter(b => b.locationId === U.locationId).toArray();
    c.innerHTML += `<div class="sec"><span class="sec-t">${ch.name}</span></div><div class="m-card">${bills.length ? bills.map(b => { const tp = types.find(t => t.id === b.sppTypeId); return `<div class="li"><div class="li-body"><div class="li-title">${tp?.name || '-'} (${b.billMonth})</div><div class="li-sub">${fc(b.amount)}</div></div><span class="badge ${SC[b.status]}">${b.status}</span></div>`; }).join('') : '<div class="empty" style="padding:16px"><div>Belum ada</div></div>'}</div>`;
  }
}
async function pgNotifs(c) {
  const data = await db.notifications.where('locationId').equals(U.locationId).reverse().sortBy('createdAt').then(a => a.slice(0, 50));
  c.innerHTML = '<div class="m-card" id="nfl"></div>'; const box = $('nfl');
  if (!data.length) { box.innerHTML = '<div class="empty"><span class="ei">🔔</span><div class="et">Belum ada</div></div>'; return; }
  data.forEach(n => { box.innerHTML += `<div class="li" onclick="markR(${n.id})"><div class="li-icon av av-o">🔔</div><div class="li-body"><div class="li-title">${n.title}</div><div class="li-sub">${n.message}</div></div></div>`; });
}
async function markR(id) { await db.notifications.update(id, { isRead: true }); render(); }

const HELP_ITEMS = [
  { icon: '🏠', title: 'Dashboard', desc: 'Melihat data anak dan update terbaru.', steps: `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">1</div><div style="font-size:13px">Buka tab Beranda</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">2</div><div style="font-size:13px">Lihat kartu profil setiap anak</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">3</div><div style="font-size:13px">Scroll ke bawah untuk update hafalan terbaru</div></div>` },
  { icon: '🕌', title: 'Progres Hafalan', desc: 'Memantau hafalan Al-Quran anak Anda.', steps: `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">1</div><div style="font-size:13px">Buka tab Progres → chip Hafalan</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">2</div><div style="font-size:13px">Lihat daftar hafalan per anak</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">3</div><div style="font-size:13px">Nilai: Mumtaz, Jayyid Jiddan, Jayyid, Maqbul</div></div>` },
  { icon: '📕', title: 'Progres Iqro', desc: 'Memantau progres Iqro anak.', steps: `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">1</div><div style="font-size:13px">Buka tab Progres → chip Iqro</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">2</div><div style="font-size:13px">Lihat posisi terakhir: Jilid dan Halaman</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">3</div><div style="font-size:13px">Nilai: Lancar, Cukup, Mengulang</div></div>` },
  { icon: '✅', title: 'Kehadiran', desc: 'Melihat rekap kehadiran anak.', steps: `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">1</div><div style="font-size:13px">Buka tab Progres → chip Kehadiran</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">2</div><div style="font-size:13px">Lihat statistik: Hadir, Izin, Sakit, Alpha</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">3</div><div style="font-size:13px">Persentase kehadiran ditampilkan otomatis</div></div>` },
  { icon: '💰', title: 'Pembayaran', desc: 'Melihat status tagihan SPP anak.', steps: `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">1</div><div style="font-size:13px">Buka tab Bayar</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">2</div><div style="font-size:13px">Lihat daftar tagihan per anak per bulan</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">3</div><div style="font-size:13px">Status: Pending (belum), Partial (cicilan), Paid (lunas)</div></div>` },
];

function showHelp() {
  let listHtml = '<div style="text-align:center;padding:8px 0 16px"><div style="font-size:40px;margin-bottom:8px">📚</div><div style="font-size:16px;font-weight:800">Bantuan & Tutorial</div><p style="font-size:12px;color:var(--on-surface-variant)">Tap topik untuk melihat panduan langkah demi langkah</p></div>';
  HELP_ITEMS.forEach((h, i) => {
    listHtml += `<div class="li" style="border-bottom:1px solid var(--outline-variant);cursor:pointer" onclick="showTutorial(${i})"><div class="li-icon av av-o" style="font-size:18px">${h.icon}</div><div class="li-body"><div class="li-title">${h.title}</div><div class="li-sub">${h.desc}</div></div><span style="color:var(--brand);font-size:14px;font-weight:700">›</span></div>`;
  });
  openSheet('📚 Bantuan', listHtml);
}

function showTutorial(idx) {
  const h = HELP_ITEMS[idx]; if (!h) return;
  closeSheet();
  setTimeout(() => {
    openSheet(h.icon + ' ' + h.title, `
      <div style="background:var(--brand-light);border-radius:var(--radius);padding:16px;margin-bottom:16px;text-align:center">
        <div style="font-size:36px;margin-bottom:8px">${h.icon}</div>
        <div style="font-size:16px;font-weight:800">${h.title}</div>
        <p style="font-size:13px;color:var(--on-surface-variant);margin-top:4px">${h.desc}</p>
      </div>
      <div style="font-size:12px;font-weight:700;color:var(--on-surface-variant);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px">📋 Langkah-langkah</div>
      <div style="background:var(--surface-dim);border-radius:var(--radius);padding:4px 12px">
        ${h.steps}
      </div>
    `, `<button class="btn btn-t" onclick="closeSheet();setTimeout(showHelp,200)">← Kembali</button><button class="btn btn-p" onclick="closeSheet()">Mengerti 👍</button>`);
  }, 250);
}

export function initWali() {
  // Ekspos fungsi global yang dipanggil dari inline onclick di HTML
  window.closeSheet = closeSheet;
  window.goNotif = goNotif;
  window.showHelp = showHelp;
  window.showProfile = showProfile;
  window.switchTab = switchTab;
  window.onFab = onFab;
  window.markR = markR;
  window.showTutorial = showTutorial;
  window.clearSession = clearSessionUser;
  window.render = render;

  (async () => {
    try { await seedDemoData(); } catch (e) { console.warn('[wali] seed skip:', e); }
    if (!(await checkAuth())) return;
    renderNav();
    switchTab('home');
  })();
}