/**
 * Guru / Ustadz Portal Module (ESM)
 * Portal pengajar: melihat kelas, jadwal, kurikulum; input absensi, hafalan, iqro.
 * Menggunakan query db.* langsung yang identik dengan HTML aktif agar perilaku tidak berubah.
 */
import { db } from '../../db/dexie.js';
import {
  $id, el, ini, fc, fd, fdl, today, nowLocal, monthLocal,
  snack, openSheet, closeSheet, delRec,
  getSessionUser, clearSessionUser, verifySession
} from '../../db/init.js';
import { seedDemoData } from '../../db/seed.js';

const $ = $id;

const SURAH = [{ n: 1, name: 'Al-Fatihah', ayat: 7, juz: 1 }, { n: 36, name: 'Yasin', ayat: 83, juz: 22 }, { n: 55, name: 'Ar-Rahman', ayat: 78, juz: 27 }, { n: 67, name: 'Al-Mulk', ayat: 30, juz: 29 }, { n: 78, name: 'An-Naba', ayat: 40, juz: 30 }, { n: 87, name: 'Al-Ala', ayat: 19, juz: 30 }, { n: 93, name: 'Ad-Dhuha', ayat: 11, juz: 30 }, { n: 94, name: 'Al-Insyirah', ayat: 8, juz: 30 }, { n: 95, name: 'At-Tin', ayat: 8, juz: 30 }, { n: 96, name: 'Al-Alaq', ayat: 19, juz: 30 }, { n: 97, name: 'Al-Qadr', ayat: 5, juz: 30 }, { n: 103, name: 'Al-Asr', ayat: 3, juz: 30 }, { n: 105, name: 'Al-Fil', ayat: 5, juz: 30 }, { n: 108, name: 'Al-Kausar', ayat: 3, juz: 30 }, { n: 109, name: 'Al-Kafirun', ayat: 6, juz: 30 }, { n: 110, name: 'An-Nasr', ayat: 3, juz: 30 }, { n: 112, name: 'Al-Ikhlas', ayat: 4, juz: 30 }, { n: 113, name: 'Al-Falaq', ayat: 5, juz: 30 }, { n: 114, name: 'An-Nas', ayat: 6, juz: 30 }];
const GL = { mumtaz: 'Mumtaz', jayyid_jiddan: 'Jayyid Jiddan', jayyid: 'Jayyid', maqbul: 'Maqbul', belum_lulus: 'Belum Lulus' };
const GC = { mumtaz: 'bg-green', jayyid_jiddan: 'bg-blue', jayyid: 'bg-yellow', maqbul: 'bg-orange', belum_lulus: 'bg-red', lancar: 'bg-green', cukup: 'bg-yellow', mengulang: 'bg-red' };
const SC = { pending: 'bg-yellow', paid: 'bg-green', partial: 'bg-blue', overdue: 'bg-red', planned: 'bg-gray', in_progress: 'bg-blue', completed: 'bg-green' };

let U = null, LOC = null;
window.curTab = 'home';
window.curSub = '';

async function checkAuth() {
  U = await verifySession();
  if (!U || U.role !== 'ustadz') { clearSessionUser(); window.location.href = 'login.html'; return false; }
  LOC = { id: U.locationId, name: U.locationName };
  $('prof-btn').textContent = ini(U.name);
  return true;
}

function showProfile() {
  openSheet('Profil', `
    <div style="text-align:center;padding:12px 0">
      <div class="av av-xl av-o" style="margin:0 auto 12px">${ini(U.name)}</div>
      <div style="font-size:18px;font-weight:700">${U.name}</div>
      <div style="font-size:13px;color:var(--on-surface-variant)">Ustadz / Pengajar</div>
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
  { id: 'kelas', icon: '🏫', label: 'Kelas' },
  { id: 'input', icon: '✏️', label: 'Input' },
  { id: 'lainnya', icon: '📁', label: 'Lainnya' },
];
const SUBS = { kelas: ['myclasses', 'schedules', 'curriculum'], input: ['attendance', 'hafalan', 'iqro'], lainnya: ['projects', 'notifications'] };
const SLBL = { myclasses: 'Kelas Saya', schedules: 'Jadwal', curriculum: 'Kurikulum', attendance: 'Absensi', hafalan: 'Hafalan', iqro: 'Iqro', projects: 'Proyek', notifications: 'Notifikasi' };
const TTITLES = { home: 'Kasir Solo - TPA', kelas: 'Kelas', input: 'Input Harian', lainnya: 'Lainnya' };
const FABS = { attendance: '✅', hafalan: '📖', iqro: '📕' };

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
  const fab = $('fab'); const fc2 = FABS[window.curSub];
  fab.classList.toggle('hidden', !fc2); if (fc2) fab.textContent = fc2;
  render();
}
function onFab() { const h = { attendance: loadAtt, hafalan: showHafalanForm, iqro: showIqroForm }; (h[window.curSub] || function () { })(); }
function render() {
  const c = $('content'); c.innerHTML = ''; c.scrollTop = 0;
  const pg = window.curSub || window.curTab;
  const r = { home: pgHome, myclasses: pgMyClasses, schedules: pgSchedules, curriculum: pgCurriculum, attendance: pgAtt, hafalan: pgHafalan, iqro: pgIqro, projects: pgProjects, notifications: pgNotifs };
  (r[pg] || r.home)(c);
}

async function pgHome(c) {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']; const td = days[new Date().getDay()];
  const tea = await db.teachers.where('locationId').equals(U.locationId).toArray();
  const me = tea.find(t => t.name === U.name) || tea[0];
  let myC = []; if (me) { const ct = await db.classTeachers.where('teacherId').equals(me.id).toArray(); myC = ct.map(x => x.classId); }
  let sc = 0; for (const cid of myC) sc += await db.classStudents.where('classId').equals(cid).count();
  const todaySch = me ? await db.schedules.where({ teacherId: me.id, day: td }).toArray() : [];
  c.innerHTML = `<div class="hero"><p style="opacity:.8">${fdl(new Date())}</p><h2>Assalamu'alaikum 👋</h2><p>${U.name}</p></div>
    <div class="stats-row"><div class="stat-chip"><div class="sc-icon">🏫</div><div class="sc-val">${myC.length}</div><div class="sc-lbl">Kelas</div></div><div class="stat-chip"><div class="sc-icon">👨‍🎓</div><div class="sc-val">${sc}</div><div class="sc-lbl">Santri</div></div><div class="stat-chip"><div class="sc-icon">📅</div><div class="sc-val">${todaySch.length}</div><div class="sc-lbl">Hari ini</div></div></div>
    <div class="sec"><span class="sec-t">Jadwal Hari Ini (${td})</span></div><div class="m-card" id="gsch"></div>`;
  const box = $('gsch'); if (!todaySch.length) { box.innerHTML = '<div class="empty"><span class="ei">🎉</span><div class="et">Tidak ada jadwal</div></div>'; return; }
  for (const s of todaySch) { const cls = await db.classes.get(s.classId); box.innerHTML += `<div class="li"><div class="li-icon av av-o">${cls?.name?.[0] || '?'}</div><div class="li-body"><div class="li-title">${cls?.name || '-'}</div><div class="li-sub">Ruang ${s.room || '-'}</div></div><span style="font-weight:700;color:var(--brand)">${s.startTime}-${s.endTime}</span></div>`; }
}
async function pgMyClasses(c) {
  const tea = await db.teachers.where('locationId').equals(U.locationId).toArray(); const me = tea.find(t => t.name === U.name) || tea[0];
  if (!me) { c.innerHTML = '<div class="empty"><span class="ei">🏫</span><div class="et">Belum terdaftar</div></div>'; return; }
  const ct = await db.classTeachers.where('teacherId').equals(me.id).toArray(); c.innerHTML = '<div id="mcl"></div>';
  for (const item of ct) {
    const cls = await db.classes.get(item.classId); if (!cls) continue; const sc = await db.classStudents.where('classId').equals(cls.id).count();
    $('mcl').innerHTML += `<div class="m-card el" style="margin:0 16px 12px"><div class="m-card-body"><div class="flex items-center gap-12"><div class="av av-l av-o">🏫</div><div style="flex:1"><div style="font-size:15px;font-weight:700">${cls.name}</div><div style="font-size:12px;color:var(--on-surface-variant)">${cls.level || ''} · ${sc} santri</div></div>${item.isPrimary ? '<span class="badge bg-orange">Wali Kelas</span>' : ''}</div></div></div>`;
  }
}
async function pgSchedules(c) {
  const data = await db.schedules.toArray(); const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']; c.innerHTML = '<div class="m-card" id="sch"></div>'; const box = $('sch');
  if (!data.length) { box.innerHTML = '<div class="empty"><span class="ei">📅</span><div class="et">Belum ada</div></div>'; return; }
  data.sort((a, b) => days.indexOf(a.day) - days.indexOf(b.day));
  for (const s of data) { const cls = await db.classes.get(s.classId); box.innerHTML += `<div class="li"><div class="li-icon av av-o">${s.day?.slice(0, 2)}</div><div class="li-body"><div class="li-title">${s.day} · ${cls?.name || '-'}</div><div class="li-sub">${s.startTime}-${s.endTime} · Ruang ${s.room || '-'}</div></div></div>`; }
}

async function pgCurriculum(c) {
  const cats = await db.curriculumCategories.where('locationId').equals(U.locationId).toArray();
  const allMats = await db.curriculumMaterials.toArray();
  const totalMats = allMats.length;
  c.innerHTML = `
    <div class="stats-row">
      <div class="stat-chip"><div class="sc-icon">📚</div><div class="sc-val">${cats.length}</div><div class="sc-lbl">Kategori</div></div>
      <div class="stat-chip"><div class="sc-icon">📄</div><div class="sc-val">${totalMats}</div><div class="sc-lbl">Total Materi</div></div>
    </div>
    <div id="cur-cats"></div>`;
  const box = $('cur-cats');
  for (const cat of cats.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))) {
    const cm = allMats.filter(m => m.categoryId === cat.id).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const catColors = ['#fff7ed', '#eff6ff', '#f0fdf4', '#faf5ff', '#fffbeb', '#fef2f2', '#f0f9ff'];
    const catEmojis = ['📕', '🕌', '📖', '🕋', '💎', '🤲', '📜'];
    const idx = cats.indexOf(cat);
    const emoji = catEmojis[idx % catEmojis.length];
    const bg = catColors[idx % catColors.length];
    box.innerHTML += `
      <div class="sec"><span class="sec-t">${emoji} ${cat.name}</span><span class="badge bg-orange">${cm.length} materi</span></div>
      <div class="m-card">
        ${cm.length ? cm.map((m, i) => `
          <div class="li" onclick="showMaterialDetail(${m.id})">
            <div class="li-icon" style="background:${bg};font-size:14px;font-weight:800;width:32px;height:32px;border-radius:8px">${i + 1}</div>
            <div class="li-body">
              <div class="li-title">${m.title}</div>
              <div class="li-sub">${m.level || 'Umum'}${m.durationMinutes ? ' · ' + m.durationMinutes + ' menit' : ''}</div>
            </div>
            <span style="color:var(--on-surface-variant);font-size:14px">›</span>
          </div>
        `).join('') : `
          <div class="empty" style="padding:20px">
            <div class="et">Belum ada materi</div>
            <div style="font-size:12px;margin-top:4px">Tap + untuk menambahkan</div>
          </div>
        `}
      </div>`;
  }
}

async function showMaterialDetail(id) {
  const m = await db.curriculumMaterials.get(id); if (!m) return;
  const cat = await db.curriculumCategories.get(m.categoryId);
  const body = `
    <div style="text-align:center;padding:16px 0">
      <div style="font-size:40px;margin-bottom:8px">📄</div>
      <div style="font-size:18px;font-weight:800;margin-bottom:4px">${m.title}</div>
      <span class="badge bg-orange">${cat?.name || '-'}</span>
    </div>
    <div style="background:var(--surface-dim);border-radius:var(--radius);padding:14px;margin:12px 0">
      <div class="sr"><span class="sr-l">Level</span><span class="sr-v">${m.level || 'Umum'}</span></div>
      <div class="sr"><span class="sr-l">Durasi</span><span class="sr-v">${m.durationMinutes || '-'} menit</span></div>
      <div class="sr"><span class="sr-l">Urutan</span><span class="sr-v">#${m.sortOrder || '-'}</span></div>
      <div class="sr"><span class="sr-l">Status</span><span class="sr-v">${m.isActive !== false ? '✅ Aktif' : '❌ Nonaktif'}</span></div>
    </div>
    ${m.description ? `<div style="margin-top:12px"><div style="font-size:12px;font-weight:600;color:var(--on-surface-variant);margin-bottom:4px">DESKRIPSI</div><div style="font-size:13px;line-height:1.6;color:var(--on-surface-variant)">${m.description}</div></div>` : ''}
    ${m.content ? `<div style="margin-top:12px"><div style="font-size:12px;font-weight:600;color:var(--on-surface-variant);margin-bottom:4px">KONTEN MATERI</div><div style="font-size:13px;line-height:1.7;background:var(--surface-dim);padding:14px;border-radius:var(--radius)">${m.content}</div></div>` : ''}
  `;
  openSheet(m.title, body);
}

async function pgAtt(c) {
  const data = await db.classSessions.where('locationId').equals(U.locationId).reverse().sortBy('sessionDate').then(a => a.slice(0, 20)); c.innerHTML = '<div class="m-card" id="at"></div>'; const box = $('at');
  if (!data.length) { box.innerHTML = '<div class="empty"><span class="ei">✅</span><div class="et">Belum ada</div><div>Tap ✅ untuk mulai</div></div>'; return; }
  for (const s of data) { const cls = await db.classes.get(s.classId); const cnt = await db.attendances.where('sessionId').equals(s.id).count(); box.innerHTML += `<div class="li"><div class="li-icon av av-g">✅</div><div class="li-body"><div class="li-title">${cls?.name || '-'}</div><div class="li-sub">${fd(s.sessionDate)} · ${cnt} santri</div></div></div>`; }
}
async function loadAtt() {
  const cls = await db.classes.where('locationId').equals(U.locationId).toArray(); if (!cls.length) { snack('err', 'Belum ada kelas'); return; }
  openSheet('Input Absensi', `<div class="ff"><label>Kelas</label><select class="fi" id="ac" onchange="loadAS()">${cls.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></div><div id="as"></div><div id="asv" style="margin-top:12px"></div>`);
  loadAS();
}
async function loadAS() {
  const cid = parseInt($('ac')?.value); if (!cid) return;
  const cs = await db.classStudents.where('classId').equals(cid).toArray(); const box = $('as'); box.innerHTML = ''; window._aM = {};
  for (const item of cs) {
    const s = await db.students.get(item.studentId); if (!s) continue; window._aM[s.id] = 'hadir';
    box.innerHTML += `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div class="av av-s av-o">${ini(s.name)}</div><div style="flex:1;font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.name}</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:3px;width:160px">${['hadir', 'izin', 'sakit', 'alpha'].map(st => `<button class="att-opt ${st === 'hadir' ? 's-h' : ''}" onclick="setA(${s.id},'${st}')" id="a-${s.id}-${st}">${st === 'hadir' ? '✅' : st === 'izin' ? '📝' : st === 'sakit' ? '🤒' : '❌'}</button>`).join('')}</div></div>`;
  }
  $('asv').innerHTML = `<button class="btn btn-p btn-full" onclick="saveA(${cid})">💾 Simpan</button>`;
}
function setA(sid, st) { window._aM[sid] = st; ['hadir', 'izin', 'sakit', 'alpha'].forEach(s => { const b = $(`a-${sid}-${s}`); if (b) b.className = `att-opt ${s === st ? 's-' + s[0] : ''}`; }); }
async function saveA(cid) {
  const sid = await db.classSessions.add({ locationId: U.locationId, classId: cid, sessionDate: today(), startTime: new Date().toTimeString().slice(0, 5) });
  await db.attendances.bulkAdd(Object.entries(window._aM).map(([s, st]) => ({ sessionId: sid, studentId: parseInt(s), status: st })));
  snack('ok', 'Disimpan!'); closeSheet(); render();
}
async function pgHafalan(c) {
  const data = await db.hafalanProgress.where('locationId').equals(U.locationId).reverse().sortBy('recordedAt').then(a => a.slice(0, 30)); c.innerHTML = '<div class="m-card" id="hl"></div>'; const box = $('hl');
  if (!data.length) { box.innerHTML = '<div class="empty"><span class="ei">🕌</span><div class="et">Belum ada</div></div>'; return; }
  for (const h of data) { const s = await db.students.get(h.studentId); box.innerHTML += `<div class="li"><div class="li-icon av av-o">${ini(s?.name)}</div><div class="li-body"><div class="li-title">${s?.name || '-'}</div><div class="li-sub">${h.surahName} (${h.ayatFrom}-${h.ayatTo})</div></div><span class="badge ${GC[h.grade]}">${GL[h.grade] || h.grade}</span></div>`; }
}
async function showHafalanForm() {
  const cls = await db.classes.where('locationId').equals(U.locationId).toArray();
  const sO = SURAH.map(s => `<option value="${s.n}">${s.n}. ${s.name} (${s.ayat})</option>`).join('');
  openSheet('Input Hafalan', `<div class="form-row"><div class="ff"><label>Kelas</label><select class="fi" id="hc" onchange="loadHS()">${cls.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></div><div class="ff"><label>Santri</label><select class="fi" id="hs"></select></div></div><div class="ff"><label>Jenis</label><select class="fi" id="ht"><option value="ziyadah">Ziyadah</option><option value="murajaah">Murajaah</option><option value="tasmi">Tasmi'</option></select></div><div class="ff"><label>Surat</label><select class="fi" id="hsu">${sO}</select></div><div class="form-row"><div class="ff"><label>Dari</label><input class="fi" type="number" id="hf" value="1"></div><div class="ff"><label>Sampai</label><input class="fi" type="number" id="hto" value="7"></div></div><div class="ff"><label>Nilai</label><div class="gr-row" id="hgr"></div></div><div class="ff"><label>Catatan</label><textarea class="fi" id="hn" rows="2"></textarea></div>`, `<button class="btn btn-t" onclick="closeSheet()">Batal</button><button class="btn btn-p" onclick="saveH()">💾 Simpan</button>`);
  window._hG = 'jayyid'; const gb = $('hgr');
  Object.entries(GL).forEach(([k, v]) => { gb.innerHTML += `<button class="gr-btn ${k === 'jayyid' ? 'active' : ''}" onclick="window._hG='${k}';document.querySelectorAll('#hgr .gr-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active')">${v}</button>`; });
  loadHS();
}
async function loadHS() {
  const cid = parseInt($('hc')?.value); if (!cid) return;
  const cs = await db.classStudents.where('classId').equals(cid).toArray(); const sel = $('hs'); sel.innerHTML = '<option value="">Pilih...</option>';
  for (const i of cs) { const s = await db.students.get(i.studentId); if (s) sel.innerHTML += `<option value="${s.id}">${s.name}</option>`; }
}
async function saveH() {
  const sid = parseInt($('hs').value); if (!sid) { snack('err', 'Pilih santri'); return; }
  const sn = parseInt($('hsu').value); const su = SURAH.find(s => s.n === sn);
  await db.hafalanProgress.add({ locationId: U.locationId, studentId: sid, surahNumber: sn, surahName: su?.name || '', ayatFrom: parseInt($('hf').value), ayatTo: parseInt($('hto').value), juz: su?.juz, type: $('ht').value, grade: window._hG, notes: $('hn').value, recordedAt: nowLocal() });
  snack('ok', 'Disimpan!'); closeSheet(); render();
}
async function pgIqro(c) {
  const data = await db.iqroProgress.where('locationId').equals(U.locationId).reverse().sortBy('recordedAt').then(a => a.slice(0, 30)); c.innerHTML = '<div class="m-card" id="il"></div>'; const box = $('il');
  if (!data.length) { box.innerHTML = '<div class="empty"><span class="ei">📕</span><div class="et">Belum ada</div></div>'; return; }
  for (const h of data) { const s = await db.students.get(h.studentId); box.innerHTML += `<div class="li"><div class="li-icon av av-o">${ini(s?.name)}</div><div class="li-body"><div class="li-title">${s?.name || '-'}</div><div class="li-sub">Jilid ${h.jilid} Hal ${h.page}</div></div><span class="badge ${GC[h.grade]}">${h.grade}</span></div>`; }
}
async function showIqroForm() {
  const cls = await db.classes.where('locationId').equals(U.locationId).toArray();
  openSheet('Input Iqro', `<div class="form-row"><div class="ff"><label>Kelas</label><select class="fi" id="ic" onchange="loadIS()">${cls.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></div><div class="ff"><label>Santri</label><select class="fi" id="is2"></select></div></div><div class="form-row"><div class="ff"><label>Jilid</label><select class="fi" id="ij">${[1, 2, 3, 4, 5, 6].map(j => `<option value="${j}">Jilid ${j}</option>`).join('')}</select></div><div class="ff"><label>Halaman</label><input class="fi" type="number" id="ip" value="1"></div></div><div class="ff"><label>Nilai</label><div class="gr-row" id="igr"></div></div><div class="ff"><label>Catatan</label><textarea class="fi" id="in2" rows="2"></textarea></div>`, `<button class="btn btn-t" onclick="closeSheet()">Batal</button><button class="btn btn-p" onclick="saveI()">💾 Simpan</button>`);
  window._iG = 'lancar'; const gb = $('igr');
  [{ v: 'lancar', l: '✅ Lancar' }, { v: 'cukup', l: '⚡ Cukup' }, { v: 'mengulang', l: '🔄 Ulang' }].forEach(g => { gb.innerHTML += `<button class="gr-btn ${g.v === 'lancar' ? 'active' : ''}" onclick="window._iG='${g.v}';document.querySelectorAll('#igr .gr-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active')">${g.l}</button>`; });
  loadIS();
}
async function loadIS() {
  const cid = parseInt($('ic')?.value); if (!cid) return;
  const cs = await db.classStudents.where('classId').equals(cid).toArray(); const sel = $('is2'); sel.innerHTML = '<option value="">Pilih...</option>';
  for (const i of cs) { const s = await db.students.get(i.studentId); if (s) sel.innerHTML += `<option value="${s.id}">${s.name}</option>`; }
}
async function saveI() {
  const sid = parseInt($('is2').value); if (!sid) { snack('err', 'Pilih santri'); return; }
  await db.iqroProgress.add({ locationId: U.locationId, studentId: sid, jilid: parseInt($('ij').value), page: parseInt($('ip').value), grade: window._iG, notes: $('in2').value, recordedAt: nowLocal() });
  snack('ok', 'Disimpan!'); closeSheet(); render();
}
async function pgProjects(c) {
  const data = await db.projects.where('locationId').equals(U.locationId).toArray(); c.innerHTML = '<div class="m-card" id="pjl"></div>'; const box = $('pjl');
  if (!data.length) { box.innerHTML = '<div class="empty"><span class="ei">📁</span><div class="et">Belum ada</div></div>'; return; }
  data.forEach(p => { box.innerHTML += `<div class="li"><div class="li-body"><div class="li-title">${p.title}</div><div class="li-sub">${p.status} · ${p.priority}</div></div><span class="badge ${SC[p.status] || 'bg-gray'}">${p.status.replace('_', ' ')}</span></div>`; });
}
async function pgNotifs(c) {
  const data = await db.notifications.where('locationId').equals(U.locationId).reverse().sortBy('createdAt').then(a => a.slice(0, 50)); c.innerHTML = '<div class="m-card" id="nfl"></div>'; const box = $('nfl');
  if (!data.length) { box.innerHTML = '<div class="empty"><span class="ei">🔔</span><div class="et">Belum ada</div></div>'; return; }
  data.forEach(n => { box.innerHTML += `<div class="li" onclick="markR(${n.id})"><div class="li-icon av av-o">🔔</div><div class="li-body"><div class="li-title">${n.title}</div><div class="li-sub">${n.message}</div></div></div>`; });
}
async function markR(id) { await db.notifications.update(id, { isRead: true }); render(); }

const HELP_ITEMS = [
  { icon: '🏠', title: 'Dashboard', desc: 'Melihat ringkasan kelas dan jadwal hari ini.', steps: `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">1</div><div style="font-size:13px">Buka tab Beranda</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">2</div><div style="font-size:13px">Lihat jumlah kelas, santri, dan sesi hari ini</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">3</div><div style="font-size:13px">Scroll ke bawah untuk jadwal hari ini</div></div>` },
  { icon: '🏫', title: 'Kelas Saya', desc: 'Melihat daftar kelas yang diampu dan santri di dalamnya.', steps: `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">1</div><div style="font-size:13px">Buka tab Kelas → chip Kelas Saya</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">2</div><div style="font-size:13px">Lihat semua kelas yang Anda ampu</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">3</div><div style="font-size:13px">Badge "Wali Kelas" menandakan Anda wali kelas tersebut</div></div>` },
  { icon: '✅', title: 'Input Absensi', desc: 'Mencatat kehadiran santri setiap pertemuan.', steps: `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">1</div><div style="font-size:13px">Buka tab Input → chip Absensi</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">2</div><div style="font-size:13px">Tap ✅ (FAB) untuk mulai</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">3</div><div style="font-size:13px">Pilih kelas → daftar santri muncul</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">4</div><div style="font-size:13px">Tap tombol status per santri: ✅ Hadir, 📝 Izin, 🤒 Sakit, ❌ Alpha</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">5</div><div style="font-size:13px">Tap 💾 Simpan</div></div>` },
  { icon: '🕌', title: 'Input Hafalan', desc: 'Mencatat progres hafalan santri per surat dan ayat.', steps: `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">1</div><div style="font-size:13px">Buka tab Input → chip Hafalan</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">2</div><div style="font-size:13px">Tap 📖 (FAB) untuk input baru</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">3</div><div style="font-size:13px">Pilih kelas → santri</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">4</div><div style="font-size:13px">Pilih jenis: Ziyadah (baru), Murajaah (ulang), Tasmi' (setoran)</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">5</div><div style="font-size:13px">Pilih surat, ayat dari-sampai</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">6</div><div style="font-size:13px">Pilih nilai → tambah catatan jika perlu</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">7</div><div style="font-size:13px">Tap 💾 Simpan</div></div>` },
  { icon: '📕', title: 'Input Iqro', desc: 'Mencatat progres Iqro jilid dan halaman.', steps: `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">1</div><div style="font-size:13px">Buka tab Input → chip Iqro</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">2</div><div style="font-size:13px">Tap 📕 (FAB) untuk input baru</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">3</div><div style="font-size:13px">Pilih kelas → santri → jilid (1-6) → halaman</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">4</div><div style="font-size:13px">Pilih nilai: Lancar/Cukup/Mengulang</div></div>` },
  { icon: '📖', title: 'Kurikulum', desc: 'Melihat materi pembelajaran yang harus diajarkan.', steps: `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">1</div><div style="font-size:13px">Buka tab Kelas → chip Kurikulum</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">2</div><div style="font-size:13px">Lihat 7 kategori kurikulum</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">3</div><div style="font-size:13px">Tap materi untuk detail</div></div>` },
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

export function initGuru() {
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
  window.showMaterialDetail = showMaterialDetail;
  window.loadAtt = loadAtt;
  window.loadAS = loadAS;
  window.setA = setA;
  window.saveA = saveA;
  window.loadHS = loadHS;
  window.saveH = saveH;
  window.loadIS = loadIS;
  window.saveI = saveI;

  (async () => {
    try { await seedDemoData(); } catch (e) { console.warn('[guru] seed skip:', e); }
    if (!(await checkAuth())) return;
    renderNav();
    switchTab('home');
  })();
}