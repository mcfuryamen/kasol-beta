/**
 * Guru / Ustadz Portal Module (ESM)
 * Portal pengajar: melihat kelas, jadwal, kurikulum; input absensi, hafalan, iqro.
 * Input digabung ke tab Kelas: guru tap kelas → daftar santri → tap santri → pilih aksi (Absensi / Hafalan / Iqro).
 * Menggunakan query db.* langsung yang identik dengan HTML aktif agar perilaku tidak berubah.
 */
import { db } from '../../db/dexie.js';
import {
  $id, el, ini, fc, fd, fdl, today, nowLocal, monthLocal, escapeHtml,
  snack, openSheet, closeSheet, delRec,
  getSessionUser, clearSessionUser, verifySession
} from '../../db/init.js';
import {
  listRemoteTeacherClasses,
  listRemoteTeacherStudents,
  listRemoteTeacherSchedules
} from '../../services/tpa-remote.js';
import { normalizeRemoteTeacherRoster } from '../../services/tpa-remote-normalize.js';
import { seedDemoData } from '../../db/seed.js';
import {
  listRemoteTeacherSessions,
  upsertRemoteAttendance,
  listRemoteSessionAttendance
} from '../../services/tpa-attendance-remote.js';
import {
  createRemoteHafalan,
  createRemoteIqro,
  listRemoteStudentHafalan,
  listRemoteStudentIqro
} from '../../services/tpa-progress-remote.js';

const $ = $id;

const SURAH = [{ n: 1, name: 'Al-Fatihah', ayat: 7, juz: 1 }, { n: 36, name: 'Yasin', ayat: 83, juz: 22 }, { n: 55, name: 'Ar-Rahman', ayat: 78, juz: 27 }, { n: 67, name: 'Al-Mulk', ayat: 30, juz: 29 }, { n: 78, name: 'An-Naba', ayat: 40, juz: 30 }, { n: 87, name: 'Al-Ala', ayat: 19, juz: 30 }, { n: 93, name: 'Ad-Dhuha', ayat: 11, juz: 30 }, { n: 94, name: 'Al-Insyirah', ayat: 8, juz: 30 }, { n: 95, name: 'At-Tin', ayat: 8, juz: 30 }, { n: 96, name: 'Al-Alaq', ayat: 19, juz: 30 }, { n: 97, name: 'Al-Qadr', ayat: 5, juz: 30 }, { n: 103, name: 'Al-Asr', ayat: 3, juz: 30 }, { n: 105, name: 'Al-Fil', ayat: 5, juz: 30 }, { n: 108, name: 'Al-Kausar', ayat: 3, juz: 30 }, { n: 109, name: 'Al-Kafirun', ayat: 6, juz: 30 }, { n: 110, name: 'An-Nasr', ayat: 3, juz: 30 }, { n: 112, name: 'Al-Ikhlas', ayat: 4, juz: 30 }, { n: 113, name: 'Al-Falaq', ayat: 5, juz: 30 }, { n: 114, name: 'An-Nas', ayat: 6, juz: 30 }];
const GL = { mumtaz: 'Mumtaz', jayyid_jiddan: 'Jayyid Jiddan', jayyid: 'Jayyid', maqbul: 'Maqbul', belum_lulus: 'Belum Lulus' };
const GC = { mumtaz: 'bg-green', jayyid_jiddan: 'bg-blue', jayyid: 'bg-yellow', maqbul: 'bg-orange', belum_lulus: 'bg-red', lancar: 'bg-green', cukup: 'bg-yellow', mengulang: 'bg-red' };
const SC = { pending: 'bg-yellow', paid: 'bg-green', partial: 'bg-blue', overdue: 'bg-red', planned: 'bg-gray', in_progress: 'bg-blue', completed: 'bg-green' };

let U = null, LOC = null;
const rosterCache = new Map(); // studentId -> {id, name, class_id} untuk sheet aksi santri
window.curTab = 'home';
window.curSub = '';
window.activeClass = null;

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
      <div class="av av-xl av-o" style="margin:0 auto 12px">${escapeHtml(ini(U.name))}</div>
      <div style="font-size:18px;font-weight:700">${escapeHtml(U.name)}</div>
      <div style="font-size:13px;color:var(--on-surface-variant)">Ustadz / Pengajar</div>
      <div style="font-size:12px;color:var(--on-surface-variant);margin-top:4px">📍 ${escapeHtml(LOC?.name || '-')}</div>
    </div>
    <div style="border-top:1px solid var(--outline-variant);margin-top:12px;padding-top:12px">
      <a href="login.html" class="btn btn-o btn-full" style="text-decoration:none;margin-bottom:8px;display:flex">↩️ Ganti Role</a>
      <button class="btn btn-d btn-full" onclick="clearSession();window.location.href='login.html'">🚪 Keluar</button>
    </div>`);
}
function goNotif() { window.curSub = 'notifications'; switchTab('lainnya'); }

const TABS = [
  { id: 'home', icon: '🏠', label: 'Beranda' },
  { id: 'kelas', icon: '🏫', label: 'Kelas' },
  { id: 'lainnya', icon: '📁', label: 'Lainnya' },
];
const SUBS = { kelas: ['myclasses', 'schedules', 'curriculum'], lainnya: ['projects', 'notifications'] };
const SLBL = { myclasses: 'Kelas Saya', schedules: 'Jadwal', curriculum: 'Kurikulum', projects: 'Proyek', notifications: 'Notifikasi' };
const TTITLES = { home: 'Kasir Solo - TPA', kelas: 'Kelas', lainnya: 'Lainnya' };

function renderNav() {
  const nav = $('bnav'); nav.innerHTML = '';
  TABS.forEach(t => { nav.innerHTML += `<button class="nav-item ${t.id === window.curTab ? 'active' : ''}" onclick="switchTab('${t.id}')"><div class="nav-pill">${t.icon}</div><span class="nav-label">${t.label}</span></button>` });
}
function switchTab(tab) {
  window.curTab = tab; renderNav();
  let subs = SUBS[tab];
  const inClass = tab === 'kelas' && !!window.activeClass;
  if (inClass) subs = null;
  const sn = $('sub-nav');
  if (subs) {
    sn.classList.remove('hidden'); sn.innerHTML = '';
    window.curSub = window.curSub && subs.includes(window.curSub) ? window.curSub : subs[0];
    subs.forEach(s => { sn.innerHTML += `<button class="chip ${s === window.curSub ? 'active' : ''}" onclick="curSub='${s}';switchTab('${tab}')">${SLBL[s] || s}</button>` });
  } else { sn.classList.add('hidden'); if (tab === 'home' || inClass) window.curSub = ''; }
  $('bar-title').textContent = TTITLES[tab] || '';
  $('bar-sub').textContent = inClass ? window.activeClass.name : (window.curSub ? SLBL[window.curSub] || '' : '');
  $('fab').classList.add('hidden');
  render();
}
function render() {
  const c = $('content'); c.innerHTML = ''; c.scrollTop = 0;
  const pg = window.curSub || window.curTab;
  const r = { home: pgHome, myclasses: pgMyClasses, schedules: pgSchedules, curriculum: pgCurriculum, projects: pgProjects, notifications: pgNotifs };
  const fn = r[pg] || r.home;
  if (window.activeClass) { renderClassRoster(c); return; }
  fn(c);
}
function renderClassRoster(c) {
  const cls = window.activeClass;
  c.innerHTML = `
    <div class="hero" style="padding:16px 20px">
      <button class="btn btn-t" style="background:rgba(255,255,255,.22);color:#fff;padding:6px 14px;font-size:13px;margin-bottom:10px" onclick="closeClass()">← Daftar Kelas</button>
      <h2 style="font-size:18px;font-weight:800;margin-bottom:2px">🏫 ${escapeHtml(cls.name)}</h2>
      <p>${cls.student_count ? escapeHtml(String(cls.student_count)) + ' santri · ' : ''}Tap santri untuk input</p>
    </div>
    <div class="sec" style="padding-top:6px"><span class="sec-t">Daftar Santri</span></div>
    <div class="m-card" id="crs"><div class="empty"><span class="ei">⏳</span><div class="et">Memuat santri…</div></div></div>`;
  loadClassRoster();
}
async function loadClassRoster() {
  try {
    const students = await listRemoteTeacherStudents(U.teacherId);
    const cid = window.activeClass?.id; if (!cid) return;
    const roster = students.filter(s => s.class_id === cid).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    roster.forEach(s => rosterCache.set(s.id, s));
    const box = $('crs'); if (!box) return;
    if (!roster.length) { box.innerHTML = '<div class="empty"><span class="ei">👨‍🎓</span><div class="et">Belum ada santri di kelas ini</div></div>'; return; }
    box.innerHTML = roster.map(s => `<div class="li" style="cursor:pointer" onclick="openSantriActions('${escapeHtml(s.id)}')"><div class="li-icon av av-o">${escapeHtml(ini(s.name))}</div><div class="li-body"><div class="li-title">${escapeHtml(s.name)}</div></div><span style="color:var(--brand);font-size:16px;font-weight:700">›</span></div>`).join('');
  } catch (error) { console.warn('[guru] remote roster unavailable', error?.code || error?.message || error); const box = $('crs'); if (box) box.innerHTML = '<div class="empty"><span class="ei">☁️</span><div class="et">Daftar santri belum tersedia</div></div>'; }
}
function attRow(st, ic, lb) {
  const sel = window._saStatus === st ? ' s-' + st[0] : '';
  return `<button class="att-opt${sel}" style="padding:12px 4px" id="sa-${st}" onclick="setSA('${st}')"><div style="font-size:18px">${ic}</div><div style="font-size:11px">${lb}</div></button>`;
}
const ATTLBL = { hadir: 'Hadir', izin: 'Izin', sakit: 'Sakit', alpha: 'Alpha' };
const ILBL = { lancar: 'Lancar', cukup: 'Cukup', mengulang: 'Ulang' };
const htype = t => t === 'murajaah' ? 'Murajaah' : t === 'tasmi' ? "Tasmi'" : 'Ziyadah';
function fmtDT(v) {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
async function loadSantriHistory(studentId, recentSessions) {
  const sec = $('hist-sec'); if (!sec) return;
  try {
    const [haf, iqr] = await Promise.all([listRemoteStudentHafalan(studentId, 8), listRemoteStudentIqro(studentId, 8)]);
    const attRows = await Promise.all(recentSessions.map(s => listRemoteSessionAttendance(s.id).catch(() => [])));
    const att = attRows.flatMap((rows, i) => (rows || []).filter(r => r.student_id === studentId).map(r => ({ kind: 'absensi', date: recentSessions[i].session_date, detail: 'Absensi · ' + (ATTLBL[r.status] || r.status), grade: '', raw: r, session: recentSessions[i] })));
    const items = [
      ...haf.map(h => ({ kind: 'hafalan', date: String(h.recorded_at || '').slice(0, 10), detail: `${htype(h.type)} · ${h.surah_name || 'Surat ' + h.surah_number} ${h.ayat_from}-${h.ayat_to}`, grade: GL[h.grade] || '', raw: h })),
      ...iqr.map(x => ({ kind: 'iqro', date: String(x.recorded_at || '').slice(0, 10), detail: `Iqro · Jilid ${x.jilid} Hal ${x.page}`, grade: ILBL[x.grade] || '', raw: x })),
      ...att
    ].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 12);
    const target = $('hist-sec'); if (!target) return;
    window._histItems = items;
    target.innerHTML = items.length
      ? '<div style="display:grid;gap:8px">' + items.map((it, i) => {
          const ikon = it.kind === 'absensi' ? '📅' : it.kind === 'hafalan' ? '📖' : '📕';
          const det = `<div id="hist-d${i}" style="display:none;margin-top:6px;padding:8px 14px;border:1px dashed var(--outline-variant);border-radius:var(--radius);background:var(--surface)">${histDetailRows(it).map(([k, v]) => `<div class="sr" style="padding:3px 0"><span class="sr-l" style="flex-shrink:0">${escapeHtml(k)}</span><span class="sr-v" style="text-align:right">${escapeHtml(String(v))}</span></div>`).join('')}</div>`;
          return `<div><button class="btn btn-o btn-full" style="display:flex;justify-content:flex-start;gap:10px;padding:10px 16px" onclick="toggleHistDetail(${i})"><span style="font-size:16px;flex-shrink:0">${ikon}</span><span style="flex:1;min-width:0;text-align:left"><span style="display:block;font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(it.detail)}</span><span style="display:block;font-size:11px;color:var(--on-surface-variant);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(String(it.date))}${it.grade ? ' · ' + escapeHtml(it.grade) : ''}</span></span><span id="hist-c${i}" style="color:var(--on-surface-variant);font-size:12px;flex-shrink:0">▾</span></button>${det}</div>`;
        }).join('') + '</div>'
      : '<div class="empty" style="padding:10px 0"><span class="ei">🗂️</span><div class="et" style="font-size:12px">Belum ada riwayat pengajaran</div></div>';
  } catch (error) {
    console.warn('[guru] riwayat santri unavailable', error?.code || error?.message || error);
    const target = $('hist-sec');
    if (target) target.innerHTML = '<div class="empty" style="padding:10px 0"><span class="ei">☁️</span><div class="et" style="font-size:12px">Riwayat belum tersedia</div></div>';
  }
}
function histDetailRows(it) {
  const r = it.raw || {};
  const rows = [];
  if (it.kind === 'hafalan') {
    rows.push(['Jenis', htype(r.type)]);
    rows.push(['Surat', `${r.surah_name || 'Surat ' + (r.surah_number ?? '-')} · Ayat ${r.ayat_from ?? '-'}-${r.ayat_to ?? '-'}`]);
    if (r.juz) rows.push(['Juz', String(r.juz)]);
    rows.push(['Nilai', GL[r.grade] || r.grade || '-']);
    rows.push(['Dicatat', fmtDT(r.recorded_at)]);
    if (r.notes) rows.push(['Catatan', r.notes]);
  } else if (it.kind === 'iqro') {
    rows.push(['Materi', `Jilid ${r.jilid ?? '-'} · Halaman ${r.page ?? '-'}`]);
    rows.push(['Nilai', ILBL[r.grade] || r.grade || '-']);
    rows.push(['Dicatat', fmtDT(r.recorded_at)]);
    if (r.notes) rows.push(['Catatan', r.notes]);
  } else {
    rows.push(['Status', ATTLBL[r.status] || r.status || '-']);
    if (it.session) rows.push(['Sesi', `${it.session.session_date || '-'} · ${String(it.session.start_time || '').slice(0, 5)}`]);
    rows.push(['Dicatat', fmtDT(r.created_at)]);
    if (r.notes) rows.push(['Catatan', r.notes]);
  }
  return rows;
}
function toggleHistDetail(i) {
  const det = $('hist-d' + i);
  if (!det) return;
  const wasOpen = det.style.display !== 'none';
  (window._histItems || []).forEach((_, k) => {
    if (k === i) return;
    const other = $('hist-d' + k);
    if (other) other.style.display = 'none';
    const otherChev = $('hist-c' + k);
    if (otherChev) otherChev.textContent = '▾';
  });
  det.style.display = wasOpen ? 'none' : 'block';
  const chev = $('hist-c' + i);
  if (chev) chev.textContent = wasOpen ? '▾' : '▴';
}
async function openSantriActions(studentId) {
  const cls = window.activeClass;
  if (!cls || !studentId) return;
  const student = rosterCache.get(studentId);
  const name = student?.name || 'Santri';
  window._sa = null;
  window._saStatus = '';
  openSheet('Input · ' + name, `
    <div style="text-align:center;padding:8px 0 4px">
      <div class="av av-xl av-o" style="margin:0 auto 8px">${escapeHtml(ini(name))}</div>
      <div style="font-size:16px;font-weight:800">${escapeHtml(name)}</div>
      <div style="font-size:12px;color:var(--on-surface-variant)">🏫 ${escapeHtml(cls.name)}</div>
    </div>
    <div style="font-size:11px;font-weight:700;color:var(--on-surface-variant);letter-spacing:.08em;margin:12px 0 8px">ABSENSI</div>
    <div id="sa-sec"><div class="empty" style="padding:10px 0"><span class="ei">⏳</span><div class="et" style="font-size:12px">Memuat sesi absensi…</div></div></div>
    <div style="font-size:11px;font-weight:700;color:var(--on-surface-variant);letter-spacing:.08em;margin:14px 0 8px">METODE PENGAJARAN</div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">
      <button class="btn btn-o" onclick="showHafalanForm('${escapeHtml(cls.id)}','${escapeHtml(studentId)}')">📖 Hafalan</button>
      <button class="btn btn-o" onclick="showIqroForm('${escapeHtml(cls.id)}','${escapeHtml(studentId)}')">📕 Iqro</button>
    </div>
    <div style="font-size:11px;font-weight:700;color:var(--on-surface-variant);letter-spacing:.08em;margin:14px 0 8px">RIWAYAT PENGAJARAN</div>
    <div id="hist-sec"><div class="empty" style="padding:10px 0"><span class="ei">⏳</span><div class="et" style="font-size:12px">Memuat riwayat…</div></div></div>`, `<button class="btn btn-t" onclick="closeSheet()">Tutup</button><button class="btn btn-p" onclick="saveSA()">💾 Simpan Absensi</button>`);
  let histStarted = false;
  try {
    if (!U?.teacherId || typeof U.teacherId !== 'string' || !U.locationId) throw new Error('TEACHER_REQUIRED');
    const allSessions = await listRemoteTeacherSessions(U.teacherId);
    const planned = allSessions.filter(s => s.status === 'planned' && s.class_id === cls.id);
    histStarted = true;
    loadSantriHistory(studentId, allSessions.slice(0, 4));
    const sec = $('sa-sec');
    if (!sec) return;
    if (!planned.length) {
      sec.innerHTML = '<div class="empty" style="padding:10px 0"><span class="ei">📅</span><div class="et" style="font-size:12px">Belum ada sesi absensi planned. Minta admin membuat sesi.</div></div>';
      return;
    }
    const session = planned[0];
    const existing = await listRemoteSessionAttendance(session.id);
    window._sa = { sessionId: session.id, studentId, saving: false };
    window._saStatus = existing.find(r => r.student_id === studentId)?.status || '';
    sec.innerHTML = `
      <div class="sr" style="margin-bottom:8px"><span class="sr-l">Sesi</span><span class="sr-v">${escapeHtml(session.session_date)} · ${escapeHtml((session.start_time || '').slice(0, 5))}</span></div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
        ${attRow('hadir', '✅', 'Hadir')}${attRow('izin', '📝', 'Izin')}${attRow('sakit', '🤒', 'Sakit')}${attRow('alpha', '❌', 'Alpha')}
      </div>`;
  } catch (error) {
    console.warn('[guru] absensi section unavailable', error?.code || error?.message || error);
    const sec = $('sa-sec');
    if (sec) sec.innerHTML = '<div class="empty" style="padding:10px 0"><span class="ei">☁️</span><div class="et" style="font-size:12px">Absensi cloud belum tersedia</div></div>';
    if (!histStarted) {
      const hist = $('hist-sec');
      if (hist) hist.innerHTML = '<div class="empty" style="padding:10px 0"><span class="ei">☁️</span><div class="et" style="font-size:12px">Riwayat belum tersedia</div></div>';
    }
  }
}

function remoteUnavailable(c, title = 'Data cloud belum tersedia') {
  c.innerHTML = `<div class="empty"><span class="ei">☁️</span><div class="et">${title}</div><div class="es">Pastikan session guru, membership, dan migration akademik sudah aktif.</div></div>`;
}

async function remoteTeacherData() {
  if (!U?.teacherId) throw new Error('TEACHER_REQUIRED');
  const [classes, students, schedules] = await Promise.all([
    listRemoteTeacherClasses(U.teacherId),
    listRemoteTeacherStudents(U.teacherId),
    listRemoteTeacherSchedules(U.teacherId)
  ]);
  return { classes: normalizeRemoteTeacherRoster(classes, students), students, schedules };
}

async function pgHome(c) {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']; const td = days[new Date().getDay()];
  let remote;
  try { remote = await remoteTeacherData(); } catch (error) { console.warn('[guru] remote home unavailable', error?.code || error?.message || error); remoteUnavailable(c); return; }
  const todaySch = remote.schedules.filter(item => item.day === td);
  c.innerHTML = `<div class="hero"><p style="opacity:.8">${fdl(new Date())}</p><h2>Assalamu'alaikum 👋</h2><p>${escapeHtml(U.name)}</p></div>
    <div class="stats-row"><div class="stat-chip"><div class="sc-icon">🏫</div><div class="sc-val">${remote.classes.length}</div><div class="sc-lbl">Kelas</div></div><div class="stat-chip"><div class="sc-icon">👨🎓</div><div class="sc-val">${remote.students.length}</div><div class="sc-lbl">Santri</div></div><div class="stat-chip"><div class="sc-icon">📅</div><div class="sc-val">${todaySch.length}</div><div class="sc-lbl">Hari ini</div></div></div>
    <div class="sec"><span class="sec-t">Jadwal Hari Ini (${escapeHtml(td)})</span></div><div class="m-card" id="gsch"></div>`;
  const box = $('gsch'); if (!todaySch.length) { box.innerHTML = '<div class="empty"><span class="ei">🎉</span><div class="et">Tidak ada jadwal</div></div>'; return; }
  for (const s of todaySch) box.innerHTML += `<div class="li"><div class="li-icon av av-o">${escapeHtml(s.class_name?.[0] || '?')}</div><div class="li-body"><div class="li-title">${escapeHtml(s.class_name || '-')}</div><div class="li-sub">Ruang ${escapeHtml(s.room || '-')}</div></div><span style="font-weight:700;color:var(--brand)">${escapeHtml(s.start_time)}-${escapeHtml(s.end_time)}</span></div>`;
}
const classCache = new Map();
const progressRoster = { classes: [], students: [] };
async function pgMyClasses(c) {
  let remote;
  try { remote = await remoteTeacherData(); } catch (error) { console.warn('[guru] remote classes unavailable', error?.code || error?.message || error); remoteUnavailable(c); return; }
  remote.classes.forEach(cls => classCache.set(cls.id, cls));
  c.innerHTML = '<div class="sec" style="padding-top:6px"><span class="sec-t">Tap kelas untuk mulai pembelajaran</span></div><div id="mcl"></div>'; const box = $('mcl');
  if (!remote.classes.length) { box.innerHTML = '<div class="empty"><span class="ei">🏫</span><div class="et">Belum ada kelas yang diampu</div></div>'; return; }
  for (const cls of remote.classes) box.innerHTML += `<div class="m-card" style="margin:0 16px 12px;cursor:pointer" onclick="openClass('${escapeHtml(cls.id)}')"><div class="m-card-body"><div class="flex items-center gap-12"><div class="av av-l av-o">🏫</div><div style="flex:1"><div style="font-size:15px;font-weight:700">${escapeHtml(cls.name)}</div><div style="font-size:12px;color:var(--on-surface-variant)">${escapeHtml(cls.level || '')} · ${cls.student_count} santri</div></div>${cls.is_primary ? '<span class="badge bg-orange">Wali Kelas</span>' : ''}<span style="color:var(--brand);font-size:16px;font-weight:700">›</span></div></div></div>`;
}
function openClass(clsId) {
  const cls = classCache.get(clsId);
  if (!cls) { snack('err', 'Kelas belum termuat, coba lagi'); return; }
  window.activeClass = cls; window.curSub = ''; switchTab('kelas');
}
function closeClass() { window.activeClass = null; window.curSub = 'myclasses'; switchTab('kelas'); }
async function pgSchedules(c) {
  let data;
  try { data = await listRemoteTeacherSchedules(U.teacherId); } catch (error) { console.warn('[guru] remote schedules unavailable', error?.code || error?.message || error); remoteUnavailable(c, 'Jadwal cloud belum tersedia'); return; }
  c.innerHTML = '<div class="m-card" id="sch"></div>'; const box = $('sch');
  if (!data.length) { box.innerHTML = '<div class="empty"><span class="ei">📅</span><div class="et">Belum ada jadwal</div></div>'; return; }
  for (const s of data) box.innerHTML += `<div class="li"><div class="li-icon av av-o">${escapeHtml(s.day?.slice(0, 2) || '--')}</div><div class="li-body"><div class="li-title">${escapeHtml(s.day)} · ${escapeHtml(s.class_name || '-')}</div><div class="li-sub">${escapeHtml(s.start_time)}-${escapeHtml(s.end_time)} · Ruang ${escapeHtml(s.room || '-')}</div></div></div>`;
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
      <div class="sec"><span class="sec-t">${emoji} ${escapeHtml(cat.name)}</span><span class="badge bg-orange">${cm.length} materi</span></div>
      <div class="m-card">
        ${cm.length ? cm.map((m, i) => `
          <div class="li" onclick="showMaterialDetail(${m.id})">
            <div class="li-icon" style="background:${bg};font-size:14px;font-weight:800;width:32px;height:32px;border-radius:8px">${i + 1}</div>
            <div class="li-body">
              <div class="li-title">${escapeHtml(m.title)}</div>
              <div class="li-sub">${escapeHtml(m.level || 'Umum')}${m.durationMinutes ? ' · ' + m.durationMinutes + ' menit' : ''}</div>
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
      <div style="font-size:18px;font-weight:800;margin-bottom:4px">${escapeHtml(m.title)}</div>
      <span class="badge bg-orange">${escapeHtml(cat?.name || '-')}</span>
    </div>
    <div style="background:var(--surface-dim);border-radius:var(--radius);padding:14px;margin:12px 0">
      <div class="sr"><span class="sr-l">Level</span><span class="sr-v">${escapeHtml(m.level || 'Umum')}</span></div>
      <div class="sr"><span class="sr-l">Durasi</span><span class="sr-v">${m.durationMinutes || '-'} menit</span></div>
      <div class="sr"><span class="sr-l">Urutan</span><span class="sr-v">#${m.sortOrder || '-'}</span></div>
      <div class="sr"><span class="sr-l">Status</span><span class="sr-v">${m.isActive !== false ? '✅ Aktif' : '❌ Nonaktif'}</span></div>
    </div>
    ${m.description ? `<div style="margin-top:12px"><div style="font-size:12px;font-weight:600;color:var(--on-surface-variant);margin-bottom:4px">DESKRIPSI</div><div style="font-size:13px;line-height:1.6;color:var(--on-surface-variant)">${escapeHtml(m.description)}</div></div>` : ''}
    ${m.content ? `<div style="margin-top:12px"><div style="font-size:12px;font-weight:600;color:var(--on-surface-variant);margin-bottom:4px">KONTEN MATERI</div><div style="font-size:13px;line-height:1.7;background:var(--surface-dim);padding:14px;border-radius:var(--radius)">${escapeHtml(m.content)}</div></div>` : ''}
  `;
  openSheet(m.title, body);
}

function setSA(status) {
  if (!window._sa) return;
  window._saStatus = status;
  ['hadir', 'izin', 'sakit', 'alpha'].forEach(st => { const button = $('sa-' + st); if (button) button.className = 'att-opt' + (st === status ? ' s-' + st[0] : ''); });
}
async function saveSA() {
  const sa = window._sa;
  if (sa?.saving) return;
  if (!sa?.sessionId || !sa.studentId) { snack('err', 'Sesi absensi belum termuat'); return; }
  if (!window._saStatus) { snack('err', 'Pilih status kehadiran'); return; }
  if (!U?.teacherId || typeof U.teacherId !== 'string') { snack('err', 'Sesi Guru cloud belum siap'); return; }
  sa.saving = true;
  try {
    await upsertRemoteAttendance(sa.sessionId, [{ student_id: sa.studentId, status: window._saStatus, notes: null }], U.teacherId);
    snack('ok', 'Absensi tersimpan di cloud'); render();
  } catch (error) { console.warn('[guru] remote attendance save failed', error?.code || error?.message || error); handleSaveAuthError(error, 'Absensi gagal disimpan ke cloud'); }
  finally { sa.saving = false; }
}
async function loadGuruProgressRoster() {
  if (!U?.teacherId || typeof U.teacherId !== 'string') throw new Error('TEACHER_REQUIRED');
  const [classes, students] = await Promise.all([listRemoteTeacherClasses(U.teacherId), listRemoteTeacherStudents(U.teacherId)]);
  progressRoster.classes = classes; progressRoster.students = students;
}
async function showHafalanForm(classId, studentId) {
  try { await loadGuruProgressRoster(); } catch (error) { console.warn('[guru] remote class roster unavailable', error?.code || error?.message || error); snack('err', 'Data kelas cloud belum tersedia'); return; }
  const clsList = classId ? progressRoster.classes.filter(c => c.id === classId) : progressRoster.classes;
  if (!clsList.length) { snack('err', 'Kelas tidak ditemukan dalam penugasan Anda'); return; }
  const student = studentId ? progressRoster.students.find(s => s.id === studentId) : null;
  if (studentId && !student) { snack('err', 'Santri tidak ditemukan'); return; }
  const cO = clsList.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('');
  const sO = SURAH.map(s => `<option value="${s.n}">${s.n}. ${s.name} (${s.ayat})</option>`).join('');
  const head = student
    ? `<div class="sr"><span class="sr-l">Kelas</span><span class="sr-v">${escapeHtml(clsList[0].name)}</span></div><div class="sr"><span class="sr-l">Santri</span><span class="sr-v">${escapeHtml(student.name)}</span></div><input type="hidden" id="hc" value="${escapeHtml(classId)}"><input type="hidden" id="hs" value="${escapeHtml(student.id)}">`
    : `<div class="form-row"><div class="ff"><label>Kelas</label><select class="fi" id="hc" onchange="loadHS()"${classId ? ' disabled' : ''}>${cO}</select></div><div class="ff"><label>Santri</label><select class="fi" id="hs"></select></div></div>`;
  openSheet('Input Hafalan Cloud', `${head}<div class="ff"><label>Jenis</label><select class="fi" id="ht"><option value="ziyadah">Ziyadah</option><option value="murajaah">Murajaah</option><option value="tasmi">Tasmi'</option></select></div><div class="ff"><label>Surat</label><select class="fi" id="hsu">${sO}</select></div><div class="form-row"><div class="ff"><label>Dari</label><input class="fi" type="number" id="hf" value="1"></div><div class="ff"><label>Sampai</label><input class="fi" type="number" id="hto" value="7"></div></div><div class="ff"><label>Nilai</label><div class="gr-row" id="hgr"></div></div><div class="ff"><label>Catatan</label><textarea class="fi" id="hn" rows="2"></textarea></div>`, `<button class="btn btn-t" onclick="closeSheet()">Batal</button><button class="btn btn-p" onclick="saveH()">💾 Simpan</button>`);
  window._hG = 'jayyid'; const gb = $('hgr');
  Object.entries(GL).forEach(([k, v]) => { gb.innerHTML += `<button class="gr-btn ${k === 'jayyid' ? 'active' : ''}" onclick="window._hG='${k}';document.querySelectorAll('#hgr .gr-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active')">${v}</button>`; });
  if (!student) loadHS();
}
function loadHS() {
  const cid = $('hc')?.value; const sel = $('hs'); if (!cid || !sel) return;
  const students = progressRoster.students.filter(s => s.class_id === cid);
  sel.innerHTML = '<option value="">Pilih...</option>' + students.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join('');
}
function handleSaveAuthError(error, label) {
  const text = String(error?.code || '') + ' ' + String(error?.message || '');
  if (/AUTH_REQUIRED|session missing/i.test(text) || error?.status === 401) {
    snack('err', 'Sesi berakhir. Mengalihkan ke halaman login…');
    setTimeout(() => { window.location.href = 'login.html'; }, 1200);
    return;
  }
  snack('err', label);
}
async function saveH() {
  const sid = $('hs')?.value; if (!sid) { snack('err', 'Pilih santri'); return; }
  if (!U?.teacherId || typeof U.teacherId !== 'string') { snack('err', 'Sesi Guru cloud belum siap'); return; }
  const sn = parseInt($('hsu').value); const su = SURAH.find(s => s.n === sn);
  try {
    await createRemoteHafalan({ student_id: sid, teacher_id: U.teacherId, surah_number: sn, surah_name: su?.name || '', ayat_from: parseInt($('hf').value), ayat_to: parseInt($('hto').value), juz: su?.juz, type: $('ht').value, grade: window._hG, notes: $('hn').value });
    snack('ok', 'Hafalan tersimpan di cloud'); closeSheet(); render();
  } catch (error) { console.warn('[guru] remote hafalan save failed', error?.code || error?.message || error); handleSaveAuthError(error, 'Hafalan gagal disimpan ke cloud'); }
}
async function showIqroForm(classId, studentId) {
  try { await loadGuruProgressRoster(); } catch (error) { console.warn('[guru] remote class roster unavailable', error?.code || error?.message || error); snack('err', 'Data kelas cloud belum tersedia'); return; }
  const clsList = classId ? progressRoster.classes.filter(c => c.id === classId) : progressRoster.classes;
  if (!clsList.length) { snack('err', 'Kelas tidak ditemukan dalam penugasan Anda'); return; }
  const student = studentId ? progressRoster.students.find(s => s.id === studentId) : null;
  if (studentId && !student) { snack('err', 'Santri tidak ditemukan'); return; }
  const cO = clsList.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('');
  const head = student
    ? `<div class="sr"><span class="sr-l">Kelas</span><span class="sr-v">${escapeHtml(clsList[0].name)}</span></div><div class="sr"><span class="sr-l">Santri</span><span class="sr-v">${escapeHtml(student.name)}</span></div><input type="hidden" id="ic" value="${escapeHtml(classId)}"><input type="hidden" id="is2" value="${escapeHtml(student.id)}">`
    : `<div class="form-row"><div class="ff"><label>Kelas</label><select class="fi" id="ic" onchange="loadIS()"${classId ? ' disabled' : ''}>${cO}</select></div><div class="ff"><label>Santri</label><select class="fi" id="is2"></select></div></div>`;
  openSheet('Input Iqro Cloud', `${head}<div class="form-row"><div class="ff"><label>Jilid</label><select class="fi" id="ij">${[1, 2, 3, 4, 5, 6].map(j => `<option value="${j}">Jilid ${j}</option>`).join('')}</select></div><div class="ff"><label>Halaman</label><input class="fi" type="number" id="ip" value="1"></div></div><div class="ff"><label>Nilai</label><div class="gr-row" id="igr"></div></div><div class="ff"><label>Catatan</label><textarea class="fi" id="in2" rows="2"></textarea></div>`, `<button class="btn btn-t" onclick="closeSheet()">Batal</button><button class="btn btn-p" onclick="saveI()">💾 Simpan</button>`);
  window._iG = 'lancar'; const gb = $('igr');
  [{ v: 'lancar', l: '✅ Lancar' }, { v: 'cukup', l: '⚡ Cukup' }, { v: 'mengulang', l: '🔄 Ulang' }].forEach(g => { gb.innerHTML += `<button class="gr-btn ${g.v === 'lancar' ? 'active' : ''}" onclick="window._iG='${g.v}';document.querySelectorAll('#igr .gr-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active')">${g.l}</button>`; });
  if (!student) loadIS();
}
function loadIS() {
  const cid = $('ic')?.value; const sel = $('is2'); if (!cid || !sel) return;
  const students = progressRoster.students.filter(s => s.class_id === cid);
  sel.innerHTML = '<option value="">Pilih...</option>' + students.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join('');
}
async function saveI() {
  const sid = $('is2')?.value; if (!sid) { snack('err', 'Pilih santri'); return; }
  if (!U?.teacherId || typeof U.teacherId !== 'string') { snack('err', 'Sesi Guru cloud belum siap'); return; }
  try {
    await createRemoteIqro({ student_id: sid, teacher_id: U.teacherId, jilid: parseInt($('ij').value), page: parseInt($('ip').value), grade: window._iG, notes: $('in2').value });
    snack('ok', 'Iqro tersimpan di cloud'); closeSheet(); render();
  } catch (error) { console.warn('[guru] remote iqro save failed', error?.code || error?.message || error); handleSaveAuthError(error, 'Iqro gagal disimpan ke cloud'); }
}
async function pgProjects(c) {
  const data = await db.projects.where('locationId').equals(U.locationId).toArray(); c.innerHTML = '<div class="m-card" id="pjl"></div>'; const box = $('pjl');
  if (!data.length) { box.innerHTML = '<div class="empty"><span class="ei">📁</span><div class="et">Belum ada</div></div>'; return; }
  data.forEach(p => { box.innerHTML += `<div class="li"><div class="li-body"><div class="li-title">${escapeHtml(p.title)}</div><div class="li-sub">${escapeHtml(p.status)} · ${escapeHtml(p.priority)}</div></div><span class="badge ${SC[p.status] || 'bg-gray'}">${escapeHtml(p.status.replace('_', ' '))}</span></div>`; });
}
async function pgNotifs(c) {
  const data = await db.notifications.where('locationId').equals(U.locationId).reverse().sortBy('createdAt').then(a => a.slice(0, 50)); c.innerHTML = '<div class="m-card" id="nfl"></div>'; const box = $('nfl');
  if (!data.length) { box.innerHTML = '<div class="empty"><span class="ei">🔔</span><div class="et">Belum ada</div></div>'; return; }
  data.forEach(n => { box.innerHTML += `<div class="li" onclick="markR(${n.id})"><div class="li-icon av av-o">🔔</div><div class="li-body"><div class="li-title">${escapeHtml(n.title)}</div><div class="li-sub">${escapeHtml(n.message)}</div></div></div>`; });
}
async function markR(id) { await db.notifications.update(id, { isRead: true }); render(); }

const stepHtml = (n, text) => `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">${n}</div><div style="font-size:13px">${text}</div></div>`;
const stepsHtml = (...texts) => texts.map((t, i) => stepHtml(i + 1, t)).join('');
const HELP_ITEMS = [
  { icon: '🏠', title: 'Dashboard', desc: 'Melihat ringkasan kelas dan jadwal hari ini.', steps: `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">1</div><div style="font-size:13px">Buka tab Beranda</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">2</div><div style="font-size:13px">Lihat jumlah kelas, santri, dan sesi hari ini</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">3</div><div style="font-size:13px">Scroll ke bawah untuk jadwal hari ini</div></div>` },
  { icon: '🏫', title: 'Kelas Saya', desc: 'Melihat daftar kelas yang diampu dan santri di dalamnya.', steps: `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">1</div><div style="font-size:13px">Buka tab Kelas → chip Kelas Saya</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">2</div><div style="font-size:13px">Lihat semua kelas yang Anda ampu</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">3</div><div style="font-size:13px">Badge "Wali Kelas" menandakan Anda wali kelas tersebut</div></div>` },
  { icon: '✅', title: 'Absensi Santri', desc: 'Mencatat kehadiran per santri pada sesi planned terakhir.', steps: stepsHtml('Buka tab Kelas → tap kelas', 'Tap santri — seksi ABSENSI langsung tampil di sheet', 'Sesi planned otomatis terpilih', 'Tap status: ✅ Hadir / 📝 Izin / 🤒 Sakit / ❌ Alpha', 'Tap 💾 Simpan Absensi') },
  { icon: '🕌', title: 'Input Hafalan', desc: 'Mencatat progres hafalan santri per surat dan ayat.', steps: stepsHtml('Buka tab Kelas → tap kelas', 'Tap santri yang akan diinput', 'Pilih 📖 Hafalan (kelas & santri terisi otomatis)', 'Pilih jenis (Ziyadah/Murajaah/Tasmi), surat, dan ayat', 'Pilih nilai → 💾 Simpan') },
  { icon: '📕', title: 'Input Iqro', desc: 'Mencatat progres Iqro jilid dan halaman.', steps: stepsHtml('Buka tab Kelas → tap kelas', 'Tap santri yang akan diinput', 'Pilih 📕 Iqro (kelas & santri terisi otomatis)', 'Pilih jilid (1-6) dan halaman', 'Pilih nilai → 💾 Simpan') },
  { icon: '🗂️', title: 'Riwayat Pengajaran', desc: 'Melihat riwayat absensi, hafalan, dan Iqro per santri.', steps: stepsHtml('Buka tab Kelas → tap kelas', 'Tap santri — seksi RIWAYAT PENGAJARAN tampil di sheet', 'Maksimal 12 catatan terbaru (gabungan absensi, hafalan, Iqro)', 'Ketuk kartu riwayat untuk membuka detail: jenis, nilai, waktu catat, dan catatan') },
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
  window.markR = markR;
  window.showTutorial = showTutorial;
  window.clearSession = clearSessionUser;
  window.render = render;
  window.showMaterialDetail = showMaterialDetail;
  window.openSantriActions = openSantriActions;
  window.setSA = setSA;
  window.saveSA = saveSA;
  window.toggleHistDetail = toggleHistDetail;
  window.loadHS = loadHS;
  window.saveH = saveH;
  window.loadIS = loadIS;
  window.saveI = saveI;
  window.showHafalanForm = showHafalanForm;
  window.showIqroForm = showIqroForm;
  window.openClass = openClass;
  window.closeClass = closeClass;

  (async () => {
    if (!(await checkAuth())) return;
    renderNav();
    switchTab('home');
  })();
}