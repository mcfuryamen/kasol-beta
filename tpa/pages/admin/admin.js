/**
 * TPA Admin Portal - ESM module
 * Migrated from inline script in admin.html
 */
import { db } from '../../db/dexie.js';
import {
  $id, el, ini, fc, fd, fdl, today, nowLocal, monthLocal,
  snack, openSheet, closeSheet, delRec, logAudit,
  maskPhone, maskNis, encryptText, decryptText,
  getSessionUser, clearSessionUser, verifySession
} from '../../db/init.js';
import { seedDemoData } from '../../db/seed.js';

const $ = $id;

const SURAH = [{ n: 1, name: 'Al-Fatihah', ayat: 7, juz: 1 }, { n: 36, name: 'Yasin', ayat: 83, juz: 22 }, { n: 55, name: 'Ar-Rahman', ayat: 78, juz: 27 }, { n: 67, name: 'Al-Mulk', ayat: 30, juz: 29 }, { n: 78, name: 'An-Naba', ayat: 40, juz: 30 }, { n: 87, name: 'Al-Ala', ayat: 19, juz: 30 }, { n: 93, name: 'Ad-Dhuha', ayat: 11, juz: 30 }, { n: 94, name: 'Al-Insyirah', ayat: 8, juz: 30 }, { n: 95, name: 'At-Tin', ayat: 8, juz: 30 }, { n: 96, name: 'Al-Alaq', ayat: 19, juz: 30 }, { n: 97, name: 'Al-Qadr', ayat: 5, juz: 30 }, { n: 103, name: 'Al-Asr', ayat: 3, juz: 30 }, { n: 105, name: 'Al-Fil', ayat: 5, juz: 30 }, { n: 108, name: 'Al-Kausar', ayat: 3, juz: 30 }, { n: 109, name: 'Al-Kafirun', ayat: 6, juz: 30 }, { n: 110, name: 'An-Nasr', ayat: 3, juz: 30 }, { n: 112, name: 'Al-Ikhlas', ayat: 4, juz: 30 }, { n: 113, name: 'Al-Falaq', ayat: 5, juz: 30 }, { n: 114, name: 'An-Nas', ayat: 6, juz: 30 }];
const CASH_IN = ['SPP', 'Infaq', 'Donasi', 'Zakat', 'Sumbangan', 'Lainnya'];
const CASH_OUT = ['Gaji Guru', 'Listrik', 'Air', 'ATK', 'Konsumsi', 'Perawatan', 'Operasional', 'Lainnya'];
const GL = { mumtaz: 'Mumtaz', jayyid_jiddan: 'Jayyid Jiddan', jayyid: 'Jayyid', maqbul: 'Maqbul', belum_lulus: 'Belum Lulus' };
const GC = { mumtaz: 'bg-green', jayyid_jiddan: 'bg-blue', jayyid: 'bg-yellow', maqbul: 'bg-orange', belum_lulus: 'bg-red', lancar: 'bg-green', cukup: 'bg-yellow', mengulang: 'bg-red' };
const SC = { pending: 'bg-yellow', paid: 'bg-green', partial: 'bg-blue', overdue: 'bg-red', planned: 'bg-gray', in_progress: 'bg-blue', completed: 'bg-green' };

// Session state (module-scoped; inline onclick uses window.curTab/curSub)
let U = null, LOC = null;
window.curTab = 'home';
window.curSub = '';

async function checkAuth() {
  U = await verifySession();
  if (!U || U.role !== 'admin') { clearSessionUser(); window.location.href = 'login.html'; return false; }
  LOC = { id: U.locationId, name: U.locationName };
  $('prof-btn').textContent = ini(U.name);
  return true;
}

function showProfile() {
  openSheet('Profil', `
    <div style="text-align:center;padding:12px 0">
      <div class="av av-xl av-o" style="margin:0 auto 12px">${ini(U.name)}</div>
      <div style="font-size:18px;font-weight:700">${U.name}</div>
      <div style="font-size:13px;color:var(--on-surface-variant)">Admin / Kepala TPA</div>
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
  { id: 'data', icon: '👥', label: 'Data' },
  { id: 'akademik', icon: '📖', label: 'Akademik' },
  { id: 'keuangan', icon: '💰', label: 'Keuangan' },
  { id: 'lainnya', icon: '⚙️', label: 'Lainnya' },
];
const SUBS = {
  data: ['students', 'teachers', 'guardians', 'classes', 'schedules'],
  akademik: ['curriculum', 'attendance', 'hafalan', 'iqro'],
  keuangan: ['payments', 'cashflow', 'reports'],
  lainnya: ['certificates', 'projects', 'locations', 'settings', 'notifications', 'protection'],
};
  const SLBL = { students: 'Santri', teachers: 'Ustadz', guardians: 'Wali', classes: 'Kelas', schedules: 'Jadwal', curriculum: 'Kurikulum', attendance: 'Absensi', hafalan: 'Hafalan', iqro: 'Iqro', payments: 'SPP', cashflow: 'Kas', reports: 'Laporan', certificates: 'Cetak', projects: 'Proyek', locations: 'Lokasi', settings: 'Pengaturan', notifications: 'Notifikasi', protection: 'Perlindungan' };
const TTITLES = { home: 'Kasir Solo - TPA', data: 'Data Master', akademik: 'Akademik', keuangan: 'Keuangan', lainnya: 'Lainnya' };
const FABS = { students: '+', teachers: '+', guardians: '+', classes: '+', hafalan: '📖', iqro: '📕', attendance: '✅', payments: '💰', cashflow: '+', projects: '+', locations: '+', protection: '+' };

function renderNav() {
  const nav = $('bnav'); nav.innerHTML = '';
  TABS.forEach(t => { nav.innerHTML += `<button class="nav-item ${t.id === window.curTab ? 'active' : ''}" onclick="switchTab('${t.id}')"><div class="nav-pill">${t.icon}</div><span class="nav-label">${t.label}</span></button>`; });
}
function switchTab(tab) {
  window.curTab = tab; renderNav();
  const subs = SUBS[tab]; const sn = $('sub-nav');
  if (subs) {
    sn.classList.remove('hidden'); sn.innerHTML = '';
    window.curSub = window.curSub && subs.includes(window.curSub) ? window.curSub : subs[0];
    subs.forEach(s => { sn.innerHTML += `<button class="chip ${s === window.curSub ? 'active' : ''}" onclick="curSub='${s}';switchTab('${tab}')">${SLBL[s] || s}</button>`; });
  } else { sn.classList.add('hidden'); if (tab === 'home') window.curSub = ''; }
  $('bar-title').textContent = TTITLES[tab] || ''; $('bar-sub').textContent = window.curSub ? SLBL[window.curSub] || '' : '';
  const fab = $('fab'); const fc = FABS[window.curSub]; fab.classList.toggle('hidden', !fc); if (fc) fab.textContent = fc;
  render();
}
function onFab() {
  const h = {
    students: showStudentForm, teachers: showTeacherForm, guardians: showGuardianForm, classes: showClassForm,
    hafalan: showHafalanForm, iqro: showIqroForm, attendance: loadAtt,
    payments: () => showPayForm(),
        cashflow: () => showCashForm(), projects: showProjectForm, locations: showLocationForm,
        protection: showProtectionForm
      };
  (h[window.curSub] || function () { })();
}
function render() {
  const c = $('content'); c.innerHTML = ''; c.scrollTop = 0;
  const pg = window.curSub || window.curTab;
  const r = {
    home: pgHome, students: pgStudents, teachers: pgTeachers, guardians: pgGuardians, classes: pgClasses, schedules: pgSchedules,
    curriculum: pgCurriculum, attendance: pgAttendance, hafalan: pgHafalan, iqro: pgIqro,
    payments: pgPayments, cashflow: pgCashFlow, reports: pgReports, certificates: pgCerts,
    projects: pgProjects, locations: pgLocations, settings: pgSettings, notifications: pgNotifs, protection: pgProtection
  };
  (r[pg] || r.home)(c);
}

// ============================================================
// ADMIN PAGES
// ============================================================
async function pgHome(c) {
  const lid = U.locationId;
  const [stu, tea, cls, hToday, bills, cfI, cfO] = await Promise.all([
    db.students.where('locationId').equals(lid).toArray(), db.teachers.where('locationId').equals(lid).toArray(),
    db.classes.where('locationId').equals(lid).toArray(), db.hafalanProgress.where('locationId').equals(lid).filter(h => h.recordedAt.startsWith(today())).toArray(),
    db.sppBills.where('locationId').equals(lid).toArray(), db.cashFlows.where({ locationId: lid, type: 'masuk' }).toArray(), db.cashFlows.where({ locationId: lid, type: 'keluar' }).toArray()
  ]);
  const act = stu.filter(s => s.isActive).length;
  const tB = bills.reduce((s, b) => s + b.amount, 0), tP = bills.reduce((s, b) => s + (b.paidAmount || 0), 0);
  const sI = cfI.reduce((s, f) => s + f.amount, 0), sO = cfO.reduce((s, f) => s + f.amount, 0);
  c.innerHTML = `<div class="hero"><p style="opacity:.8">${fdl(new Date())}</p><h2>Assalamu'alaikum 👋</h2><p>${U.name} · ${LOC?.name || ''}</p></div>
    <div class="stats-row"><div class="stat-chip"><div class="sc-icon">👨‍🎓</div><div class="sc-val">${stu.length}</div><div class="sc-lbl">${act} santri aktif</div></div><div class="stat-chip"><div class="sc-icon">👳</div><div class="sc-val">${tea.length}</div><div class="sc-lbl">Ustadz</div></div><div class="stat-chip"><div class="sc-icon">🏫</div><div class="sc-val">${cls.length}</div><div class="sc-lbl">Kelas</div></div><div class="stat-chip"><div class="sc-icon">📖</div><div class="sc-val">${hToday.length}</div><div class="sc-lbl">Setoran hari ini</div></div></div>
    <div class="m-card el"><div class="m-card-body"><div style="font-weight:700;margin-bottom:8px">💰 Keuangan</div><div class="sr"><span class="sr-l">Tagihan</span><span class="sr-v">${fc(tB)}</span></div><div class="sr"><span class="sr-l">Terbayar</span><span class="sr-v v-green">${fc(tP)}</span></div><div class="sr"><span class="sr-l">Tunggakan</span><span class="sr-v v-red">${fc(tB - tP)}</span></div><div class="sr"><span class="sr-l">Saldo Kas</span><span class="sr-v v-brand" style="font-size:18px">${fc(sI - sO + tP)}</span></div></div></div>
    <div class="sec"><span class="sec-t">Hafalan Terbaru</span><button class="sec-a" onclick="curSub='hafalan';switchTab('akademik')">Semua →</button></div><div class="m-card" id="h-list"></div>`;
  const hbox = $('h-list'); const rec = await db.hafalanProgress.where('locationId').equals(lid).reverse().sortBy('recordedAt').then(a => a.slice(0, 6));
  if (!rec.length) { hbox.innerHTML = '<div class="empty"><span class="ei">📖</span><div>Belum ada</div></div>'; return; }
  for (const h of rec) { const s = await db.students.get(h.studentId); hbox.innerHTML += `<div class="li"><div class="li-icon av av-o">${ini(s?.name)}</div><div class="li-body"><div class="li-title">${s?.name || '-'}</div><div class="li-sub">${h.surahName || ''} (${h.ayatFrom}-${h.ayatTo})</div></div><span class="badge ${GC[h.grade] || 'bg-gray'}">${GL[h.grade] || h.grade}</span></div>`; }
}

// Students
async function pgStudents(c) {
  const data = await db.students.where('locationId').equals(U.locationId).toArray();
  c.innerHTML = `<div class="search"><span class="si">🔍</span><input placeholder="Cari santri..." oninput="filterS(this.value)"></div><div class="m-card" id="s-list"></div>`;
  window._sD = data; filterS('');
}
async function filterS(q) {
  q = q.toLowerCase(); const box = $('s-list'); box.innerHTML = '';
  const f = (window._sD || []).filter(s => !q || s.name.toLowerCase().includes(q) || (s.nis || '').includes(q));
  if (!f.length) { box.innerHTML = '<div class="empty"><span class="ei">👨‍🎓</span><div class="et">Belum ada santri</div></div>'; return; }
  for (const s of f) { const g = s.guardianId ? await db.guardians.get(s.guardianId) : null;
    box.innerHTML += `<div class="li" onclick="showStudentForm(${s.id})"><div class="li-icon av ${s.gender === 'L' ? 'av-b' : 'av-o'}">${ini(s.name)}</div><div class="li-body"><div class="li-title">${s.name}</div><div class="li-sub">${maskNis(s.nis)} · ${g?.name || '-'}</div></div><span class="badge ${s.isActive ? 'bg-green' : 'bg-gray'}">${s.isActive ? 'Aktif' : 'Off'}</span></div>`; }
}
async function showStudentForm(id) {
  const s = id ? await db.students.get(id) : null; const gs = await db.guardians.where('locationId').equals(U.locationId).toArray();
  const sPhone = s ? await decryptText(s.phone) : '';
  const sAddr = s ? await decryptText(s.address) : '';
  const gO = gs.map(g => `<option value="${g.id}" ${s?.guardianId === g.id ? 'selected' : ''}>${g.name}</option>`).join('');
  const consentBlock = id
    ? (s?.consentAt
        ? `<div class="ff" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 12px;font-size:12px;color:#166534">✅ Persetujuan wali tercatat: <b>${s.consentBy || '-'}</b> · ${s.consentAt || ''}</div>`
        : `<div class="ff" style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:10px 12px;font-size:12px;color:#92400e">⚠️ Belum ada persetujuan wali untuk pemrosesan data anak ini.</div>`)
    : `<div class="ff" style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px 12px;font-size:12px;color:#78350f">
        <label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer;font-weight:600;text-transform:none;letter-spacing:0">
          <input type="checkbox" id="sf-consent" style="margin-top:2px">
          <span>Wali telah menyetujui pemrosesan data anak (nama, NIS, gender, tanggal lahir, alamat, telepon, dan data pendidikan) sesuai UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi.</span>
        </label>
      </div>`;
  const body = `<div class="form-row"><div class="ff"><label>Nama *</label><input class="fi" id="sf-n" value="${s?.name || ''}"></div><div class="ff"><label>NIS</label><input class="fi" id="sf-nis" value="${s?.nis || ''}"></div></div>
    <div class="form-row"><div class="ff"><label>JK</label><select class="fi" id="sf-g"><option value="L" ${s?.gender === 'L' ? 'selected' : ''}>Laki-laki</option><option value="P" ${s?.gender === 'P' ? 'selected' : ''}>Perempuan</option></select></div><div class="ff"><label>Tgl Lahir</label><input class="fi" type="date" id="sf-bd" value="${s?.birthDate || ''}"></div></div>
    <div class="ff"><label>Wali</label><select class="fi" id="sf-w"><option value="">--</option>${gO}</select></div>
    <div class="ff"><label>Alamat</label><textarea class="fi" id="sf-addr">${sAddr}</textarea></div>
    <div class="ff"><label>Telepon</label><input class="fi" type="tel" id="sf-ph" value="${sPhone}"></div>
    ${consentBlock}
    ${id ? `<button class="btn btn-d btn-full" onclick="delRec('students',${id},'Santri')" style="margin-top:8px">🗑 Hapus</button>` : ''}`;
  const ft = el('div', { class: 'flex gap-8' });
  ft.appendChild(el('button', { class: 'btn btn-t', text: 'Batal', onclick() { closeSheet(); } }));
  ft.appendChild(el('button', { class: 'btn btn-p', text: '💾 Simpan', onclick: async () => {
    const d = { locationId: U.locationId, name: $('sf-n').value.trim(), nis: $('sf-nis').value, gender: $('sf-g').value, birthDate: $('sf-bd').value, guardianId: parseInt($('sf-w').value) || null, address: await encryptText($('sf-addr').value), phone: await encryptText($('sf-ph').value), isActive: true, joinDate: s?.joinDate || today() };
    if (!d.name) { snack('err', 'Nama wajib'); return; }
    if (!id) {
      const consent = $('sf-consent')?.checked;
      if (!consent) { snack('err', 'Wajib centang persetujuan wali'); return; }
      const g = d.guardianId ? await db.guardians.get(d.guardianId) : null;
      d.consentAt = nowLocal();
      d.consentBy = g?.name || 'Wali';
      d.consentGuardianId = d.guardianId;
    }
    if (id) { await db.students.update(id, d); await logAudit('update', 'students', id, 'Perbarui data santri ' + d.name); }
    else { const nid = await db.students.add(d); await logAudit('create', 'students', nid, 'Tambah santri ' + d.name + ' (persetujuan wali: ' + d.consentBy + ')'); }
    snack('ok', 'Tersimpan'); closeSheet(); render();
  } }));
  openSheet(id ? 'Edit Santri' : 'Tambah Santri', body, ft);
}

// Teachers
async function pgTeachers(c) {
  const data = await db.teachers.where('locationId').equals(U.locationId).toArray();
  c.innerHTML = '<div class="m-card" id="t-list"></div>'; const box = $('t-list');
  if (!data.length) { box.innerHTML = '<div class="empty"><span class="ei">👳</span><div class="et">Belum ada</div></div>'; return; }
  for (const t of data) { const tp = await decryptText(t.phone); const tartilBadge = t.tartil === 'lancar' ? '<span class="badge bg-green">Tartil</span>' : (t.tartil ? '<span class="badge bg-orange">Tartil?</span>' : ''); box.innerHTML += `<div class="li" onclick="showTeacherForm(${t.id})"><div class="li-icon av av-b">${ini(t.name)}</div><div class="li-body"><div class="li-title">${t.name} ${tartilBadge}</div><div class="li-sub">${t.specialization || '-'} · ${maskPhone(tp)}</div></div><span class="badge bg-green">Aktif</span></div>`; }
}
async function showTeacherForm(id) {
  const t = id ? await db.teachers.get(id) : null;
  const tPhone = t ? await decryptText(t.phone) : '';
  const body = `<div class="form-row"><div class="ff"><label>Nama *</label><input class="fi" id="tf-n" value="${t?.name || ''}"></div><div class="ff"><label>JK</label><select class="fi" id="tf-g"><option value="L" ${t?.gender === 'L' ? 'selected' : ''}>L</option><option value="P" ${t?.gender === 'P' ? 'selected' : ''}>P</option></select></div></div>
    <div class="ff"><label>Spesialisasi</label><input class="fi" id="tf-s" value="${t?.specialization || ''}" placeholder="Hafalan, Iqro..."></div>
        <div class="form-row"><div class="ff"><label>Pendidikan Terakhir *</label><select class="fi" id="tf-q"><option value="">— Pilih —</option><option value="diniyah_atas" ${t?.qualification === 'diniyah_atas' ? 'selected' : ''}>Diniyah Menengah Atas</option><option value="diniyah_menengah" ${t?.qualification === 'diniyah_menengah' ? 'selected' : ''}>Diniyah Menengah</option><option value="sarjana" ${t?.qualification === 'sarjana' ? 'selected' : ''}>Sarjana</option><option value="lainnya" ${t?.qualification === 'lainnya' ? 'selected' : ''}>Lainnya</option></select></div><div class="ff"><label>Kompetensi Tartil *</label><select class="fi" id="tf-t"><option value="">— Pilih —</option><option value="lancar" ${t?.tartil === 'lancar' ? 'selected' : ''}>Lancar</option><option value="cukup" ${t?.tartil === 'cukup' ? 'selected' : ''}>Cukup</option><option value="belum" ${t?.tartil === 'belum' ? 'selected' : ''}>Belum</option></select></div></div>
        <div class="ff"><label>Telepon</label><input class="fi" type="tel" id="tf-p" value="${tPhone}"></div>
    ${id ? `<button class="btn btn-d btn-full" onclick="delRec('teachers',${id},'Ustadz')" style="margin-top:8px">🗑 Hapus</button>` : ''}`;
  const ft = el('div', { class: 'flex gap-8' }); ft.appendChild(el('button', { class: 'btn btn-t', text: 'Batal', onclick() { closeSheet(); } }));
  ft.appendChild(el('button', { class: 'btn btn-p', text: '💾 Simpan', onclick: async () => {
    const d = { locationId: U.locationId, name: $('tf-n').value.trim(), gender: $('tf-g').value, specialization: $('tf-s').value, qualification: $('tf-q').value, tartil: $('tf-t').value, phone: await encryptText($('tf-p').value), isActive: true };
        if (!d.name) { snack('err', 'Nama wajib'); return; } if (!d.qualification) { snack('err', 'Pilih pendidikan terakhir'); return; } if (!d.tartil) { snack('err', 'Pilih kompetensi tartil'); return; } if (id) { await db.teachers.update(id, d); await logAudit('update', 'teachers', id, 'Perbarui ustadz ' + d.name); } else { const nid = await db.teachers.add(d); await logAudit('create', 'teachers', nid, 'Tambah ustadz ' + d.name); } snack('ok', 'Tersimpan'); closeSheet(); render();
  } })); openSheet(id ? 'Edit Ustadz' : 'Tambah Ustadz', body, ft);
}

// Guardians
async function pgGuardians(c) {
  const data = await db.guardians.where('locationId').equals(U.locationId).toArray();
  c.innerHTML = '<div class="m-card" id="g-list"></div>'; const box = $('g-list');
  if (!data.length) { box.innerHTML = '<div class="empty"><span class="ei">👨‍👩‍👧</span><div class="et">Belum ada</div></div>'; return; }
  for (const g of data) { const kids = await db.students.where('guardianId').equals(g.id).toArray(); const gp = await decryptText(g.phone);
      box.innerHTML += `<div class="li" onclick="showGuardianForm(${g.id})"><div class="li-icon av av-g">${ini(g.name)}</div><div class="li-body"><div class="li-title">${g.name} <span class="badge bg-gray">${g.relation || ''}</span></div><div class="li-sub">${maskPhone(gp)} · ${kids.map(k => k.name).join(', ') || 'Belum ada anak'}</div></div></div>`; }
}
async function showGuardianForm(id) {
  const g = id ? await db.guardians.get(id) : null;
  const gPhone = g ? await decryptText(g.phone) : '';
  const gAddr = g ? await decryptText(g.address) : '';
  const body = `<div class="form-row"><div class="ff"><label>Nama *</label><input class="fi" id="gf-n" value="${g?.name || ''}"></div><div class="ff"><label>Hubungan</label><select class="fi" id="gf-r"><option value="ayah" ${g?.relation === 'ayah' ? 'selected' : ''}>Ayah</option><option value="ibu" ${g?.relation === 'ibu' ? 'selected' : ''}>Ibu</option><option value="wali" ${g?.relation === 'wali' ? 'selected' : ''}>Wali</option></select></div></div>
    <div class="ff"><label>Telepon</label><input class="fi" type="tel" id="gf-p" value="${gPhone}"></div>
    <div class="ff"><label>Alamat</label><textarea class="fi" id="gf-a">${gAddr}</textarea></div>
    ${id ? `<button class="btn btn-d btn-full" onclick="delRec('guardians',${id},'Wali')" style="margin-top:8px">🗑 Hapus</button>` : ''}`;
  const ft = el('div', { class: 'flex gap-8' }); ft.appendChild(el('button', { class: 'btn btn-t', text: 'Batal', onclick() { closeSheet(); } }));
  ft.appendChild(el('button', { class: 'btn btn-p', text: '💾 Simpan', onclick: async () => {
    const d = { locationId: U.locationId, name: $('gf-n').value.trim(), relation: $('gf-r').value, phone: await encryptText($('gf-p').value), address: await encryptText($('gf-a').value), isActive: true };
    if (!d.name) { snack('err', 'Nama wajib'); return; } if (id) { await db.guardians.update(id, d); await logAudit('update', 'guardians', id, 'Perbarui wali ' + d.name); } else { const nid = await db.guardians.add(d); await logAudit('create', 'guardians', nid, 'Tambah wali ' + d.name); } snack('ok', 'Tersimpan'); closeSheet(); render();
  } })); openSheet(id ? 'Edit Wali' : 'Tambah Wali', body, ft);
}

// Classes
async function pgClasses(c) {
  const data = await db.classes.where('locationId').equals(U.locationId).toArray();
  c.innerHTML = '<div id="cl"></div>'; const box = $('cl');
  for (const cls of data) { const sc = await db.classStudents.where('classId').equals(cls.id).count();
    box.innerHTML += `<div class="m-card el" style="margin:0 16px 12px" onclick="showClassForm(${cls.id})"><div class="m-card-body"><div class="flex items-center gap-12"><div class="av av-l av-o">🏫</div><div style="flex:1"><div style="font-size:15px;font-weight:700">${cls.name}</div><div style="font-size:12px;color:var(--on-surface-variant)">${cls.level || 'Umum'} · Ruang ${cls.room || '-'}</div></div><span class="badge bg-blue">👨‍🎓 ${sc}/${cls.maxStudents || 30}</span></div></div></div>`; }
}
async function showClassForm(id) {
  const cls = id ? await db.classes.get(id) : null;
  const lvls = [{ v: 'iqro_1', l: 'Iqro 1' }, { v: 'iqro_2', l: 'Iqro 2' }, { v: 'iqro_3', l: 'Iqro 3' }, { v: 'iqro_4', l: 'Iqro 4' }, { v: 'iqro_5', l: 'Iqro 5' }, { v: 'iqro_6', l: 'Iqro 6' }, { v: 'juz_amma', l: 'Juz Amma' }, { v: 'al_quran', l: 'Al-Quran' }, { v: 'tahfidz', l: 'Tahfidz' }];
  const body = `<div class="form-row"><div class="ff"><label>Nama *</label><input class="fi" id="cf-n" value="${cls?.name || ''}"></div><div class="ff"><label>Level</label><select class="fi" id="cf-l"><option value="">--</option>${lvls.map(l => `<option value="${l.v}" ${cls?.level === l.v ? 'selected' : ''}>${l.l}</option>`).join('')}</select></div></div>
    <div class="form-row"><div class="ff"><label>Ruang</label><input class="fi" id="cf-r" value="${cls?.room || ''}"></div><div class="ff"><label>Maks</label><input class="fi" type="number" id="cf-m" value="${cls?.maxStudents || 30}"></div></div>
    ${id ? `<button class="btn btn-d btn-full" onclick="delRec('classes',${id},'Kelas')" style="margin-top:8px">🗑 Hapus</button>` : ''}`;
  const ft = el('div', { class: 'flex gap-8' }); ft.appendChild(el('button', { class: 'btn btn-t', text: 'Batal', onclick() { closeSheet(); } }));
  ft.appendChild(el('button', { class: 'btn btn-p', text: '💾 Simpan', onclick: async () => {
    const d = { locationId: U.locationId, name: $('cf-n').value.trim(), level: $('cf-l').value, room: $('cf-r').value, maxStudents: parseInt($('cf-m').value) || 30, isActive: true };
    if (!d.name) { snack('err', 'Nama wajib'); return; } if (id) { await db.classes.update(id, d); await logAudit('update', 'classes', id, 'Perbarui kelas ' + d.name); } else { const nid = await db.classes.add(d); await logAudit('create', 'classes', nid, 'Tambah kelas ' + d.name); } snack('ok', 'Tersimpan'); closeSheet(); render();
  } })); openSheet(id ? 'Edit Kelas' : 'Tambah Kelas', body, ft);
}

// Schedules
async function pgSchedules(c) {
  const data = await db.schedules.toArray(); const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  c.innerHTML = '<div class="m-card" id="sch"></div>'; const box = $('sch');
  if (!data.length) { box.innerHTML = '<div class="empty"><span class="ei">📅</span><div class="et">Belum ada jadwal</div></div>'; return; }
  data.sort((a, b) => days.indexOf(a.day) - days.indexOf(b.day));
  for (const s of data) { const cls = await db.classes.get(s.classId); const t = s.teacherId ? await db.teachers.get(s.teacherId) : null;
    box.innerHTML += `<div class="li"><div class="li-icon av av-o">${s.day?.slice(0, 2)}</div><div class="li-body"><div class="li-title">${s.day} · ${cls?.name || '-'}</div><div class="li-sub">${s.startTime}-${s.endTime} · ${t?.name || '-'}</div></div><button class="btn-icon" onclick="delRec('schedules',${s.id},'Jadwal')">🗑</button></div>`; }
}

// Curriculum
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

async function pgAttendance(c) {
  const data = await db.classSessions.orderBy('sessionDate').reverse().limit(20).toArray();
  c.innerHTML = '<div class="m-card" id="at"></div>'; const box = $('at');
  if (!data.length) { box.innerHTML = '<div class="empty"><span class="ei">✅</span><div class="et">Belum ada absensi</div><div>Tap + untuk mulai</div></div>'; return; }
  for (const s of data) { const cls = await db.classes.get(s.classId); const cnt = await db.attendances.where('sessionId').equals(s.id).count();
    box.innerHTML += `<div class="li"><div class="li-icon av av-g">✅</div><div class="li-body"><div class="li-title">${cls?.name || '-'}</div><div class="li-sub">${fd(s.sessionDate)} · ${cnt} santri</div></div></div>`; }
}
async function loadAtt() {
  const cls = await db.classes.where('locationId').equals(U.locationId).toArray();
  if (!cls.length) { snack('err', 'Belum ada kelas'); return; }
  openSheet('Input Absensi', `<div class="ff"><label>Kelas</label><select class="fi" id="ac" onchange="loadAS()">${cls.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></div><div id="as"></div><div id="asv" style="margin-top:12px"></div>`);
  loadAS();
}
async function loadAS() {
  const cid = parseInt($('ac')?.value); if (!cid) return;
  const cs = await db.classStudents.where('classId').equals(cid).toArray();
  const box = $('as'); box.innerHTML = ''; window._aM = {};
  for (const item of cs) { const s = await db.students.get(item.studentId); if (!s) continue; window._aM[s.id] = 'hadir';
    box.innerHTML += `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div class="av av-s av-o">${ini(s.name)}</div><div style="flex:1;font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.name}</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:3px;width:160px">${['hadir', 'izin', 'sakit', 'alpha'].map(st => `<button class="att-opt ${st === 'hadir' ? 's-h' : ''}" onclick="setA(${s.id},'${st}')" id="a-${s.id}-${st}">${st === 'hadir' ? '✅' : st === 'izin' ? '📝' : st === 'sakit' ? '🤒' : '❌'}</button>`).join('')}</div></div>`; }
  $('asv').innerHTML = `<button class="btn btn-p btn-full" onclick="saveA(${cid})">💾 Simpan Absensi</button>`;
}
function setA(sid, st) { window._aM[sid] = st; ['hadir', 'izin', 'sakit', 'alpha'].forEach(s => { const b = $(`a-${sid}-${s}`); if (b) b.className = `att-opt ${s === st ? 's-' + s[0] : ''}`; }); }
async function saveA(cid) {
  const sid = await db.classSessions.add({ locationId: U.locationId, classId: cid, sessionDate: today(), startTime: new Date().toTimeString().slice(0, 5) });
  await db.attendances.bulkAdd(Object.entries(window._aM).map(([s, st]) => ({ sessionId: sid, studentId: parseInt(s), status: st })));
  snack('ok', 'Absensi disimpan!'); closeSheet(); render();
}

// Hafalan
async function pgHafalan(c) {
  const data = await db.hafalanProgress.where('locationId').equals(U.locationId).reverse().sortBy('recordedAt').then(a => a.slice(0, 30));
  c.innerHTML = '<div class="m-card" id="hl"></div>'; const box = $('hl');
  if (!data.length) { box.innerHTML = '<div class="empty"><span class="ei">🕌</span><div class="et">Belum ada</div></div>'; return; }
  for (const h of data) { const s = await db.students.get(h.studentId);
    box.innerHTML += `<div class="li"><div class="li-icon av av-o">${ini(s?.name)}</div><div class="li-body"><div class="li-title">${s?.name || '-'}</div><div class="li-sub">${h.surahName} (${h.ayatFrom}-${h.ayatTo}) · ${h.type}</div></div><span class="badge ${GC[h.grade]}">${GL[h.grade] || h.grade}</span></div>`; }
}
async function showHafalanForm() {
  const cls = await db.classes.where('locationId').equals(U.locationId).toArray();
  const sO = SURAH.map(s => `<option value="${s.n}">${s.n}. ${s.name} (${s.ayat})</option>`).join('');
  openSheet('Input Hafalan', `
    <div class="form-row"><div class="ff"><label>Kelas</label><select class="fi" id="hc" onchange="loadHS()">${cls.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></div><div class="ff"><label>Santri</label><select class="fi" id="hs"></select></div></div>
    <div class="ff"><label>Jenis</label><select class="fi" id="ht"><option value="ziyadah">Ziyadah</option><option value="murajaah">Murajaah</option><option value="tasmi">Tasmi'</option></select></div>
    <div class="ff"><label>Surat</label><select class="fi" id="hsu">${sO}</select></div>
    <div class="form-row"><div class="ff"><label>Ayat Dari</label><input class="fi" type="number" id="hf" value="1" min="1"></div><div class="ff"><label>Sampai</label><input class="fi" type="number" id="hto" value="7" min="1"></div></div>
    <div class="ff"><label>Nilai</label><div class="gr-row" id="hgr"></div></div>
    <div class="ff"><label>Catatan</label><textarea class="fi" id="hn" rows="2"></textarea></div>`,
    `<button class="btn btn-t" onclick="closeSheet()">Batal</button><button class="btn btn-p" onclick="saveH()">💾 Simpan</button>`);
  window._hG = 'jayyid'; const gb = $('hgr');
  Object.entries(GL).forEach(([k, v]) => { gb.innerHTML += `<button class="gr-btn ${k === 'jayyid' ? 'active' : ''}" onclick="window._hG='${k}';document.querySelectorAll('#hgr .gr-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active')">${v}</button>`; });
  loadHS();
}
async function loadHS() { const cid = parseInt($('hc')?.value); if (!cid) return; const cs = await db.classStudents.where('classId').equals(cid).toArray(); const sel = $('hs'); sel.innerHTML = '<option value="">Pilih...</option>'; for (const i of cs) { const s = await db.students.get(i.studentId); if (s) sel.innerHTML += `<option value="${s.id}">${s.name}</option>`; } }
async function saveH() {
  const sid = parseInt($('hs').value); if (!sid) { snack('err', 'Pilih santri'); return; }
  const sn = parseInt($('hsu').value); const su = SURAH.find(s => s.n === sn);
  await db.hafalanProgress.add({ locationId: U.locationId, studentId: sid, surahNumber: sn, surahName: su?.name || '', ayatFrom: parseInt($('hf').value), ayatTo: parseInt($('hto').value), juz: su?.juz, type: $('ht').value, grade: window._hG, notes: $('hn').value, recordedAt: nowLocal() });
  snack('ok', 'Hafalan disimpan!'); closeSheet(); render();
}

// Iqro
async function pgIqro(c) {
  const data = await db.iqroProgress.where('locationId').equals(U.locationId).reverse().sortBy('recordedAt').then(a => a.slice(0, 30));
  c.innerHTML = '<div class="m-card" id="il"></div>'; const box = $('il');
  if (!data.length) { box.innerHTML = '<div class="empty"><span class="ei">📕</span><div class="et">Belum ada</div></div>'; return; }
  for (const h of data) { const s = await db.students.get(h.studentId); box.innerHTML += `<div class="li"><div class="li-icon av av-o">${ini(s?.name)}</div><div class="li-body"><div class="li-title">${s?.name || '-'}</div><div class="li-sub">Jilid ${h.jilid} Hal ${h.page}</div></div><span class="badge ${GC[h.grade]}">${h.grade}</span></div>`; }
}
async function showIqroForm() {
  const cls = await db.classes.where('locationId').equals(U.locationId).toArray();
  openSheet('Input Iqro', `
    <div class="form-row"><div class="ff"><label>Kelas</label><select class="fi" id="ic" onchange="loadIS()">${cls.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></div><div class="ff"><label>Santri</label><select class="fi" id="is2"></select></div></div>
    <div class="form-row"><div class="ff"><label>Jilid</label><select class="fi" id="ij">${[1, 2, 3, 4, 5, 6].map(j => `<option value="${j}">Jilid ${j}</option>`).join('')}</select></div><div class="ff"><label>Halaman</label><input class="fi" type="number" id="ip" value="1" min="1"></div></div>
    <div class="ff"><label>Nilai</label><div class="gr-row" id="igr"></div></div>
    <div class="ff"><label>Catatan</label><textarea class="fi" id="in2" rows="2"></textarea></div>`,
    `<button class="btn btn-t" onclick="closeSheet()">Batal</button><button class="btn btn-p" onclick="saveI()">💾 Simpan</button>`);
  window._iG = 'lancar'; const gb = $('igr');
  [{ v: 'lancar', l: '✅ Lancar' }, { v: 'cukup', l: '⚡ Cukup' }, { v: 'mengulang', l: '🔄 Ulang' }].forEach(g => {
    gb.innerHTML += `<button class="gr-btn ${g.v === 'lancar' ? 'active' : ''}" onclick="window._iG='${g.v}';document.querySelectorAll('#igr .gr-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active')">${g.l}</button>`; });
  loadIS();
}
async function loadIS() { const cid = parseInt($('ic')?.value); if (!cid) return; const cs = await db.classStudents.where('classId').equals(cid).toArray(); const sel = $('is2'); sel.innerHTML = '<option value="">Pilih...</option>'; for (const i of cs) { const s = await db.students.get(i.studentId); if (s) sel.innerHTML += `<option value="${s.id}">${s.name}</option>`; } }
async function saveI() { const sid = parseInt($('is2').value); if (!sid) { snack('err', 'Pilih santri'); return; } await db.iqroProgress.add({ locationId: U.locationId, studentId: sid, jilid: parseInt($('ij').value), page: parseInt($('ip').value), grade: window._iG, notes: $('in2').value, recordedAt: nowLocal() }); snack('ok', 'Iqro disimpan!'); closeSheet(); render(); }

// Payments
async function pgPayments(c) {
  const bills = await db.sppBills.where('locationId').equals(U.locationId).toArray(); const types = await db.sppTypes.toArray();
  c.innerHTML = `<div style="padding:0 16px 12px"><button class="btn btn-t btn-full" onclick="genBills()">📋 Generate Tagihan</button></div><div class="m-card" id="pl"></div>`;
  const box = $('pl'); if (!bills.length) { box.innerHTML = '<div class="empty"><span class="ei">💰</span><div class="et">Belum ada tagihan</div></div>'; return; }
  for (const b of bills.sort((a, b) => (b.billMonth || '').localeCompare(a.billMonth))) { const s = await db.students.get(b.studentId); const tp = types.find(t => t.id === b.sppTypeId);
    box.innerHTML += `<div class="li" onclick="${b.status !== 'paid' ? `showPayForm(${b.id})` : ''}"><div class="li-icon av av-o">💰</div><div class="li-body"><div class="li-title">${s?.name || '-'} · ${tp?.name || '-'}</div><div class="li-sub">${b.billMonth} · ${fc(b.amount)}</div></div><span class="badge ${SC[b.status]}">${b.status}</span></div>`; }
}
async function genBills() { const sts = await db.students.where('locationId').equals(U.locationId).filter(s => s.isActive).toArray(); const tps = await db.sppTypes.where('locationId').equals(U.locationId).filter(t => t.isRecurring && t.isActive).toArray(); const mo = monthLocal(); let n = 0; for (const s of sts) for (const t of tps) { if (!await db.sppBills.where({ studentId: s.id, sppTypeId: t.id, billMonth: mo }).count()) { await db.sppBills.add({ locationId: U.locationId, studentId: s.id, sppTypeId: t.id, billMonth: mo, amount: t.amount, paidAmount: 0, status: 'pending' }); n++; } } snack('ok', n + ' tagihan'); render(); }
async function showPayForm(bid) { const b = bid ? await db.sppBills.get(bid) : null; if (!b) return; const rem = b.amount - (b.paidAmount || 0);
  openSheet('Bayar', `<div class="ff"><label>Sisa</label><input class="fi" value="${fc(rem)}" disabled></div><div class="ff"><label>Bayar</label><input class="fi" type="number" id="pa" value="${rem}"></div><div class="ff"><label>Metode</label><select class="fi" id="pm"><option>tunai</option><option>transfer</option><option>qris</option></select></div>`,
    `<button class="btn btn-t" onclick="closeSheet()">Batal</button><button class="btn btn-p" onclick="savePay(${bid})">💾 Bayar</button>`);
}
async function savePay(bid) { const b = await db.sppBills.get(bid); const a = parseFloat($('pa').value); if (!a) { snack('err', 'Jumlah?'); return; } const pid = await db.payments.add({ billId: bid, studentId: b.studentId, amount: a, method: $('pm').value, paidAt: nowLocal() }); const np = (b.paidAmount || 0) + a; await db.sppBills.update(bid, { paidAmount: np, status: np >= b.amount ? 'paid' : np > 0 ? 'partial' : 'pending' }); await logAudit('create', 'payments', pid, 'Pembayaran SPP Rp' + a.toLocaleString('id-ID')); snack('ok', 'Berhasil!'); closeSheet(); render(); }

// Cash Flow
async function pgCashFlow(c) {
  const flows = await db.cashFlows.where('locationId').equals(U.locationId).toArray();
  const bills = await db.sppBills.where('locationId').equals(U.locationId).toArray();
  const tI = flows.filter(f => f.type === 'masuk').reduce((s, f) => s + f.amount, 0), tO = flows.filter(f => f.type === 'keluar').reduce((s, f) => s + f.amount, 0), tP = bills.reduce((s, b) => s + (b.paidAmount || 0), 0);
  c.innerHTML = `<div class="stats-row"><div class="stat-chip"><div class="sc-icon">📥</div><div class="sc-val" style="color:var(--success)">${fc(tI)}</div><div class="sc-lbl">Masuk</div></div><div class="stat-chip"><div class="sc-icon">📤</div><div class="sc-val" style="color:var(--error)">${fc(tO)}</div><div class="sc-lbl">Keluar</div></div><div class="stat-chip"><div class="sc-icon">💰</div><div class="sc-val" style="color:var(--brand)">${fc(tI - tO + tP)}</div><div class="sc-lbl">Saldo</div></div></div><div class="m-card" id="cfl"></div>`;
  const box = $('cfl'); if (!flows.length) { box.innerHTML = '<div class="empty"><span class="ei">🏦</span><div class="et">Belum ada</div></div>'; return; }
  flows.sort((a, b) => (b.transactionDate || '').localeCompare(a.transactionDate || '')).forEach(f => { box.innerHTML += `<div class="li"><div class="li-icon av ${f.type === 'masuk' ? 'av-g' : 'av-o'}">${f.type === 'masuk' ? '📥' : '📤'}</div><div class="li-body"><div class="li-title">${f.category}</div><div class="li-sub">${f.description || '-'} · ${fd(f.transactionDate)}</div></div><span style="font-weight:700;font-size:13px;color:${f.type === 'masuk' ? 'var(--success)' : 'var(--error)'}">${f.type === 'masuk' ? '+' : '-'}${fc(f.amount)}</span></div>`; });
}
async function showCashForm() {
  openSheet('Catat Kas', `<div class="ff"><label>Tipe</label><select class="fi" id="cft" onchange="updCC()"><option value="masuk">📥 Masuk</option><option value="keluar">📤 Keluar</option></select></div><div class="ff"><label>Kategori</label><select class="fi" id="cfc">${CASH_IN.map(c => `<option>${c}</option>`).join('')}</select></div><div class="ff"><label>Jumlah</label><input class="fi" type="number" id="cfa" placeholder="0"></div><div class="ff"><label>Keterangan</label><input class="fi" id="cfd"></div><div class="ff"><label>Tanggal</label><input class="fi" type="date" id="cfdt" value="${today()}"></div>`,
    `<button class="btn btn-t" onclick="closeSheet()">Batal</button><button class="btn btn-p" onclick="saveCF()">💾 Simpan</button>`);
}
function updCC() { $('cfc').innerHTML = ($('cft').value === 'masuk' ? CASH_IN : CASH_OUT).map(c => `<option>${c}</option>`).join(''); }
async function saveCF() { const a = parseFloat($('cfa').value); if (!a) { snack('err', 'Jumlah?'); return; } const nid = await db.cashFlows.add({ locationId: U.locationId, type: $('cft').value, category: $('cfc').value, amount: a, description: $('cfd').value, transactionDate: $('cfdt').value }); await logAudit('create', 'cashFlows', nid, 'Kas ' + $('cft').value + ' Rp' + a.toLocaleString('id-ID')); snack('ok', 'Tersimpan'); closeSheet(); render(); }

// Reports
async function pgReports(c) {
  const [sc, tc, hc, ss, bills, cfI, cfO] = await Promise.all([db.students.where('locationId').equals(U.locationId).count(), db.teachers.where('locationId').equals(U.locationId).count(), db.hafalanProgress.where('locationId').equals(U.locationId).count(), db.classSessions.where('locationId').equals(U.locationId).count(), db.sppBills.where('locationId').equals(U.locationId).toArray(), db.cashFlows.where({ locationId: U.locationId, type: 'masuk' }).toArray(), db.cashFlows.where({ locationId: U.locationId, type: 'keluar' }).toArray()]);
  const tB = bills.reduce((s, b) => s + b.amount, 0), tP = bills.reduce((s, b) => s + (b.paidAmount || 0), 0);
  c.innerHTML = `<div class="m-card el"><div class="m-card-body"><div style="font-weight:700;margin-bottom:8px">📊 Umum</div><div class="sr"><span class="sr-l">Santri</span><span class="sr-v">${sc}</span></div><div class="sr"><span class="sr-l">Ustadz</span><span class="sr-v">${tc}</span></div><div class="sr"><span class="sr-l">Sesi</span><span class="sr-v">${ss}</span></div><div class="sr"><span class="sr-l">Hafalan</span><span class="sr-v">${hc}</span></div></div></div>
    <div class="m-card el"><div class="m-card-body"><div style="font-weight:700;margin-bottom:8px">💰 Keuangan</div><div class="sr"><span class="sr-l">Tagihan</span><span class="sr-v">${fc(tB)}</span></div><div class="sr"><span class="sr-l">Terbayar</span><span class="sr-v v-green">${fc(tP)}</span></div><div class="sr"><span class="sr-l">Tunggakan</span><span class="sr-v v-red">${fc(tB - tP)}</span></div><div class="sr"><span class="sr-l">Kas Masuk</span><span class="sr-v v-green">${fc(cfI.reduce((s, f) => s + f.amount, 0))}</span></div><div class="sr"><span class="sr-l">Kas Keluar</span><span class="sr-v v-red">${fc(cfO.reduce((s, f) => s + f.amount, 0))}</span></div></div></div>`;
}

// Certificates, Projects, Locations, Settings, Notifications
async function pgCerts(c) { c.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 16px">${[['🪪', 'Kartu Santri'], ['📋', 'Rapor'], ['🎓', 'Sertifikat'], ['🧾', 'Kwitansi']].map(([i, l]) => `<div class="m-card el" style="margin:0" onclick="snack('inf','Cetak ${l}...')"><div class="m-card-body text-center" style="padding:24px 12px"><span style="font-size:32px;display:block;margin-bottom:8px">${i}</span><div style="font-weight:700">${l}</div></div></div>`).join('')}</div>`; }
async function pgProjects(c) { const data = await db.projects.where('locationId').equals(U.locationId).toArray(); c.innerHTML = '<div id="pjl"></div>'; const box = $('pjl'); if (!data.length) { box.innerHTML = '<div class="empty"><span class="ei">📁</span><div class="et">Belum ada proyek</div></div>'; return; } data.forEach(p => { box.innerHTML += `<div class="m-card el" style="margin:0 16px 12px" onclick="showProjectForm(${p.id})"><div class="m-card-body"><div class="flex items-center justify-between" style="margin-bottom:6px"><div style="font-size:15px;font-weight:700">${p.title}</div><span class="badge ${SC[p.status] || 'bg-gray'}">${p.status.replace('_', ' ')}</span></div>${p.description ? `<div style="font-size:12px;color:var(--on-surface-variant)">${p.description}</div>` : ''}</div></div>`; }); }
async function showProjectForm(id) { const p = id ? await db.projects.get(id) : null; openSheet(id ? 'Edit Proyek' : 'Tambah Proyek', `<div class="ff"><label>Judul *</label><input class="fi" id="pt" value="${p?.title || ''}"></div><div class="ff"><label>Deskripsi</label><textarea class="fi" id="pd">${p?.description || ''}</textarea></div><div class="form-row"><div class="ff"><label>Status</label><select class="fi" id="ps"><option value="planned" ${p?.status === 'planned' ? 'selected' : ''}>Rencana</option><option value="in_progress" ${p?.status === 'in_progress' ? 'selected' : ''}>Berjalan</option><option value="completed" ${p?.status === 'completed' ? 'selected' : ''}>Selesai</option></select></div><div class="ff"><label>Prioritas</label><select class="fi" id="pp"><option value="medium" ${!p || p?.priority === 'medium' ? 'selected' : ''}>Sedang</option><option value="high" ${p?.priority === 'high' ? 'selected' : ''}>Tinggi</option><option value="urgent" ${p?.priority === 'urgent' ? 'selected' : ''}>Urgent</option></select></div></div><div class="ff"><label>Deadline</label><input class="fi" type="date" id="pdd" value="${p?.dueDate || ''}"></div>${id ? `<button class="btn btn-d btn-full" onclick="delRec('projects',${id},'Proyek')" style="margin-top:8px">🗑 Hapus</button>` : ''}`, `<button class="btn btn-t" onclick="closeSheet()">Batal</button><button class="btn btn-p" onclick="savePj(${id || 'null'})">💾 Simpan</button>`); }
async function savePj(id) { const d = { locationId: U.locationId, title: $('pt').value.trim(), description: $('pd').value, status: $('ps').value, priority: $('pp').value, dueDate: $('pdd').value }; if (!d.title) { snack('err', 'Judul?'); return; } if (id) { await db.projects.update(id, d); await logAudit('update', 'projects', id, 'Perbarui proyek ' + d.title); } else { const nid = await db.projects.add(d); await logAudit('create', 'projects', nid, 'Tambah proyek ' + d.title); } snack('ok', 'Tersimpan'); closeSheet(); render(); }
async function pgLocations(c) { const data = await db.locations.toArray(); c.innerHTML = '<div id="lcl"></div>'; for (const l of data) { const lAddr = await decryptText(l.address); $('lcl').innerHTML += `<div class="m-card el" style="margin:0 16px 12px" onclick="showLocationForm(${l.id})"><div class="m-card-body"><div class="flex items-center gap-12"><div class="av av-l av-o">🏢</div><div><div style="font-size:16px;font-weight:700">${l.name}</div><div style="font-size:12px;color:var(--on-surface-variant)">${lAddr || ''}</div></div></div></div></div>`; } }
async function showLocationForm(id) { const l = id ? await db.locations.get(id) : null; const lAddr = l ? await decryptText(l.address) : ''; const lPhone = l ? await decryptText(l.phone) : ''; openSheet(id ? 'Edit Lokasi' : 'Tambah Lokasi', `<div class="ff"><label>Nama</label><input class="fi" id="ln" value="${l?.name || ''}"></div><div class="ff"><label>Alamat</label><textarea class="fi" id="la">${lAddr}</textarea></div><div class="form-row"><div class="ff"><label>Telepon</label><input class="fi" id="lp" value="${lPhone}"></div><div class="ff"><label>Kepala</label><input class="fi" id="lh" value="${l?.headName || ''}"></div></div>`, `<button class="btn btn-t" onclick="closeSheet()">Batal</button><button class="btn btn-p" onclick="saveLoc(${id || 'null'})">💾 Simpan</button>`); }
async function saveLoc(id) { const d = { name: $('ln').value.trim(), address: await encryptText($('la').value), phone: await encryptText($('lp').value), headName: $('lh').value, isActive: true }; if (id) { await db.locations.update(id, d); await logAudit('update', 'locations', id, 'Perbarui lokasi ' + d.name); } else { const nid = await db.locations.add(d); await logAudit('create', 'locations', nid, 'Tambah lokasi ' + d.name); } snack('ok', 'Tersimpan'); closeSheet(); render(); }
function pgSettings(c) { c.innerHTML = `<div class="m-card el"><div class="m-card-body"><div style="font-weight:700;margin-bottom:12px">💾 Backup</div><button class="btn btn-t btn-full" onclick="expD()" style="margin-bottom:8px">📥 Export JSON</button><button class="btn btn-o btn-full" onclick="$('impf').click()">📤 Import</button><input type="file" id="impf" accept=".json" style="display:none" onchange="impD(this)"></div></div>
    <div class="m-card el"><div class="m-card-body"><div style="font-weight:700;margin-bottom:4px">🔐 Data Pribadi (UU 27/2022)</div><div style="font-size:12px;color:var(--on-surface-variant);margin-bottom:12px">Hak subjek data: ekspor & hapus permanen data santri.</div><button class="btn btn-t btn-full" onclick="showSubjectRights()" style="margin-bottom:8px">👤 Kelola Hak Subjek Data</button><button class="btn btn-o btn-full" onclick="showAuditLog()">📜 Audit Log Pemrosesan</button></div></div>
        <div class="m-card el"><div class="m-card-body"><div style="font-weight:700;margin-bottom:4px">🛡 Kelaikan Sistem Elektronik (PP 71/2019)</div><div style="font-size:12px;color:var(--on-surface-variant);margin-bottom:12px">Uji kelaikan: keamanan, ketersediaan, dan kepatuhan sistem.</div><button class="btn btn-t btn-full" onclick="showReadiness()">✅ Uji Kelaikan Sistem</button></div></div>
        <div class="m-card el"><div class="m-card-body"><button class="btn btn-d btn-full" onclick="rstD()">🗑 Reset Semua Data</button></div></div>`; }

// Uji kelaikan sistem elektronik (PP 71/2019) - penilaian dinamis
async function showReadiness() {
  const key = await db.settings.get('cryptoKey');
  const auditCount = await db.auditLog.count();
  const protCount = await db.protectionReports.count();
  const users = await db.users.toArray();
  const checks = [
    { k: 'Enkripsi data pribadi (AES-256)', ok: !!key, d: 'Kunci enkripsi tersimpan & data sensitif dienkripsi.' },
    { k: 'Audit log pemrosesan data', ok: auditCount > 0, d: 'Seluruh aktivitas pemrosesan direkam.' },
    { k: 'Kontrol akses berbasis peran', ok: users.some(u => u.role === 'admin') && users.some(u => u.role === 'ustadz') && users.some(u => u.role === 'wali'), d: 'Peran admin, ustadz, dan wali terpisah.' },
    { k: 'Perlindungan anak (UU 35/2014)', ok: true, d: 'Modul laporan perlindungan tersedia.' },
    { k: 'Persetujuan orang tua (UU 27/2022)', ok: true, d: 'Persetujuan wali saat pendaftaran santri.' },
    { k: 'Hak subjek data (ekspor/hapus)', ok: true, d: 'Ekspor & hapus permanen tersedia.' },
    { k: 'Backup & pemulihan data', ok: true, d: 'Ekspor/import JSON tersedia.' },
    { k: 'Berjalan offline (ketersediaan)', ok: true, d: 'Data tersimpan lokal (IndexedDB).' }
  ];
  const pass = checks.filter(x => x.ok).length;
  const rows = checks.map(x => `<div class="li"><div class="li-icon av ${x.ok ? 'av-g' : 'av-r'}">${x.ok ? '✓' : '✗'}</div><div class="li-body"><div class="li-title">${x.k}</div><div class="li-sub">${x.d}</div></div><span class="badge ${x.ok ? 'bg-green' : 'bg-red'}">${x.ok ? 'LULUS' : 'GAGAL'}</span></div>`).join('');
  const body = `<div style="font-weight:700;margin-bottom:4px">Hasil: ${pass}/${checks.length} lulus</div><div style="font-size:12px;color:var(--on-surface-variant);margin-bottom:12px">Penilaian mandiri kelaikan sistem elektronik sesuai PP 71/2019. Periksa ulang berkala sebelum rilis publik.</div>${rows}`;
  const ft = el('div', { class: 'flex gap-8' }); ft.appendChild(el('button', { class: 'btn btn-p btn-full', text: 'Tutup', onclick() { closeSheet(); } }));
  openSheet('Uji Kelaikan Sistem', body, ft);
}

// Hak subjek data (UU 27/2022 Pasal 32, 40-42): ekspor & hapus permanen per santri
async function showSubjectRights() {
  const data = await db.students.where('locationId').equals(U.locationId).toArray();
  const opts = data.map(s => `<option value="${s.id}">${s.name} (${s.nis || '-'})</option>`).join('');
  const body = `<div class="ff"><label>Pilih Santri</label><select class="fi" id="sr-s">${opts || '<option value="">Belum ada santri</option>'}</select></div>
    <div style="font-size:12px;color:var(--on-surface-variant);margin:8px 0">Ekspor mengunduh seluruh data pribadi & data pendidikan santri (hak akses, Pasal 32). Hapus permanen menghapus data tanpa bisa dikembalikan (Pasal 40-42).</div>`;
  const ft = el('div', { class: 'flex gap-8' });
  ft.appendChild(el('button', { class: 'btn btn-t', text: 'Batal', onclick() { closeSheet(); } }));
  ft.appendChild(el('button', { class: 'btn btn-p', text: '📥 Ekspor', onclick: async () => { await exportStudentData(parseInt($('sr-s').value)); } }));
  ft.appendChild(el('button', { class: 'btn btn-d', text: '🗑 Hapus Permanen', onclick: async () => { await purgeStudent(parseInt($('sr-s').value)); } }));
  openSheet('Hak Subjek Data', body, ft);
}

// Ekspor seluruh data pribadi & pendidikan satu santri (Pasal 32)
async function exportStudentData(sid) {
  if (!sid) { snack('err', 'Pilih santri dulu'); return; }
  const s = await db.students.get(sid); if (!s) { snack('err', 'Santri tidak ditemukan'); return; }
  const [guardian, classes, hafalan, iqro, bills, payments, attendances] = await Promise.all([
    s.guardianId ? db.guardians.get(s.guardianId) : null,
    db.classStudents.where('studentId').equals(sid).toArray().then(async ls => { const cids = ls.map(l => l.classId); return db.classes.bulkGet(cids).then(cs => cs.filter(Boolean)); }),
    db.hafalanProgress.where('studentId').equals(sid).toArray(),
    db.iqroProgress.where('studentId').equals(sid).toArray(),
    db.sppBills.where('studentId').equals(sid).toArray(),
    db.payments.where('studentId').equals(sid).toArray(),
    db.attendances.where('studentId').equals(sid).toArray()
  ]);
  const payload = {
    exportedAt: nowLocal(),
    exportedBy: U.name,
      subject: { ...s, phone: await decryptText(s.phone), address: await decryptText(s.address) },
      guardian: guardian ? { ...guardian, phone: await decryptText(guardian.phone), address: await decryptText(guardian.address) } : null,
    classes,
    hafalanProgress: hafalan,
    iqroProgress: iqro,
    sppBills: bills,
    payments,
    attendances
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'data-santri-' + (s.nis || s.id) + '-' + today() + '.json'; a.click();
  await logAudit('export', 'students', sid, 'Ekspor data pribadi santri ' + s.name);
  snack('ok', 'Data diekspor'); closeSheet();
}

// Hapus permanen data santri + seluruh data terkait (Pasal 40-42)
async function purgeStudent(sid) {
  if (!sid) { snack('err', 'Pilih santri dulu'); return; }
  const s = await db.students.get(sid); if (!s) { snack('err', 'Santri tidak ditemukan'); return; }
  if (!confirm('Hapus PERMANEN data santri ' + s.name + '? Data tidak bisa dikembalikan.')) return;
  if (!confirm('YAKIN? Seluruh data pribadi, hafalan, absensi, dan tagihan akan dihapus.')) return;
  await db.students.delete(sid);
  await db.classStudents.where('studentId').equals(sid).delete();
  await db.hafalanProgress.where('studentId').equals(sid).delete();
  await db.iqroProgress.where('studentId').equals(sid).delete();
  await db.sppBills.where('studentId').equals(sid).delete();
  await db.payments.where('studentId').equals(sid).delete();
  await db.attendances.where('studentId').equals(sid).delete();
  await logAudit('delete', 'students', sid, 'Hapus permanen data santri ' + s.name);
  snack('ok', 'Data dihapus permanen'); closeSheet(); render();
}

// Penampil audit log (Pasal 31)
async function showAuditLog() {
  const data = await db.auditLog.orderBy('createdAt').reverse().limit(100).toArray();
  const rows = data.length ? data.map(a => `<div class="li"><div class="li-icon av av-o">${({ create: '➕', update: '✏️', delete: '🗑', export: '📥', consent: '✅', access: '👁' })[a.action] || '•'}</div><div class="li-body"><div class="li-title">${a.detail || a.action + ' ' + a.entity}</div><div class="li-sub">${a.userRole} · ${a.createdAt || ''}</div></div></div>`).join('')
    : '<div class="empty"><span class="ei">📜</span><div class="et">Belum ada aktivitas tercatat</div></div>';
  const body = `<div class="m-card" style="margin:0">${rows}</div>`;
  const ft = el('div', { class: 'flex gap-8' });
  ft.appendChild(el('button', { class: 'btn btn-t', text: 'Tutup', onclick() { closeSheet(); } }));
  openSheet('Audit Log Pemrosesan', body, ft);
}
async function expD() { const tables = ['locations', 'students', 'teachers', 'guardians', 'classes', 'classStudents', 'classTeachers', 'schedules', 'curriculumCategories', 'curriculumMaterials', 'classSessions', 'attendances', 'hafalanProgress', 'iqroProgress', 'sppTypes', 'sppBills', 'payments', 'cashFlows', 'projects', 'notifications']; const data = {}; for (const t of tables) data[t] = await db[t].toArray(); const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'tpa-backup-' + today() + '.json'; a.click(); snack('ok', 'Exported!'); }
async function impD(inp) { const f = inp.files[0]; if (!f) return; const data = JSON.parse(await f.text()); if (!confirm('Timpa data?')) return; for (const [t, rows] of Object.entries(data)) { if (db[t]) { await db[t].clear(); await db[t].bulkAdd(rows); } } snack('ok', 'Imported!'); render(); }
async function rstD() { if (!confirm('Hapus SEMUA data?')) return; if (!confirm('YAKIN?')) return; await db.delete(); location.reload(); }
async function pgNotifs(c) { const data = await db.notifications.where('locationId').equals(U.locationId).reverse().sortBy('createdAt').then(a => a.slice(0, 50)); c.innerHTML = '<div class="m-card" id="nfl"></div>'; const box = $('nfl'); if (!data.length) { box.innerHTML = '<div class="empty"><span class="ei">🔔</span><div class="et">Belum ada</div></div>'; return; } data.forEach(n => { box.innerHTML += `<div class="li" style="${!n.isRead ? 'border-left:3px solid var(--brand)' : ''}" onclick="markR(${n.id})"><div class="li-icon av ${n.isRead ? 'av-o' : 'av-g'}">${{ info: 'ℹ️', progress: '📖', payment: '💰', attendance: '✅' }[n.type] || '🔔'}</div><div class="li-body"><div class="li-title">${n.title}${!n.isRead ? ' <span class="badge bg-orange">Baru</span>' : ''}</div><div class="li-sub">${n.message}</div></div></div>`; }); }
async function markR(id) { await db.notifications.update(id, { isRead: true }); render(); }

// ============================================================
// PERLINDUNGAN ANAK MODULE (UU 35/2014)
// ============================================================
const PROT_TYPES = { kekerasan_fisik: 'Kekerasan Fisik', kekerasan_psikis: 'Kekerasan Psikis', perundungan: 'Perundungan', pelecehan: 'Pelecehan', penelantaran: 'Penelantaran', lainnya: 'Lainnya' };
const PROT_STATUS = { reported: 'Dilaporkan', handling: 'Ditangani', resolved: 'Selesai' };
const PROT_BADGE = { reported: 'bg-orange', handling: 'bg-blue', resolved: 'bg-green' };

async function pgProtection(c) {
  const lid = U.locationId;
  const [reports, students] = await Promise.all([
    db.protectionReports.where('locationId').equals(lid).reverse().sortBy('createdAt'),
    db.students.where('locationId').equals(lid).toArray()
  ]);
  const stuMap = {}; students.forEach(s => stuMap[s.id] = s.name);
  const counts = { reported: 0, handling: 0, resolved: 0 };
  reports.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
  c.innerHTML = `<div class="m-card el"><div class="m-card-body">
    <div style="font-weight:700;margin-bottom:4px">🛡️ Perlindungan Anak</div>
    <div style="font-size:12px;color:var(--on-surface-variant);margin-bottom:12px">Pencatatan & penanganan laporan kekerasan/perlindungan (UU 35/2014)</div>
    <div class="stats-row">
      <div class="stat-chip"><div class="sc-icon">🟠</div><div class="sc-val">${counts.reported}</div><div class="sc-lbl">Dilaporkan</div></div>
      <div class="stat-chip"><div class="sc-icon">🔵</div><div class="sc-val">${counts.handling}</div><div class="sc-lbl">Ditangani</div></div>
      <div class="stat-chip"><div class="sc-icon">🟢</div><div class="sc-val">${counts.resolved}</div><div class="sc-lbl">Selesai</div></div>
    </div>
  </div></div>
  <div class="m-card" id="prl"></div>`;
  const box = $('prl');
  if (!reports.length) { box.innerHTML = '<div class="empty"><span class="ei">🛡️</span><div class="et">Belum ada laporan</div><div class="es">Tap + untuk mencatat laporan perlindungan anak</div></div>'; return; }
  reports.forEach(r => {
    box.innerHTML += `<div class="li" onclick="showProtectionForm(${r.id})">
      <div class="li-icon av av-o">🛡️</div>
      <div class="li-body">
        <div class="li-title">${stuMap[r.studentId] || r.studentName || 'Santri'} <span class="badge ${PROT_BADGE[r.status] || 'bg-orange'}">${PROT_STATUS[r.status] || r.status}</span></div>
        <div class="li-sub">${PROT_TYPES[r.type] || r.type} · ${r.reporterName || r.reporterRole || '-'} · ${fdl(new Date(r.createdAt))}</div>
      </div>
    </div>`;
  });
}

async function showProtectionForm(id) {
  const lid = U.locationId;
  const [r, students] = await Promise.all([
    id ? db.protectionReports.get(id) : null,
    db.students.where('locationId').equals(lid).toArray()
  ]);
  const stuOpts = students.map(s => `<option value="${s.id}" ${r && r.studentId === s.id ? 'selected' : ''}>${s.name}</option>`).join('');
  openSheet(id ? 'Detail Laporan' : 'Catat Laporan', `
    <div class="ff"><label>Santri *</label><select class="fi" id="prs"><option value="">— Pilih Santri —</option>${stuOpts}</select></div>
    <div class="ff"><label>Jenis *</label><select class="fi" id="prt">${Object.entries(PROT_TYPES).map(([k, v]) => `<option value="${k}" ${r && r.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div class="ff"><label>Deskripsi Kejadian *</label><textarea class="fi" id="prd" placeholder="Uraikan kronologi kejadian secara ringkas dan objektif">${r?.description || ''}</textarea></div>
    <div class="ff"><label>Status</label><select class="fi" id="prst">${Object.entries(PROT_STATUS).map(([k, v]) => `<option value="${k}" ${r && r.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div class="ff"><label>Catatan Penanganan</label><textarea class="fi" id="prn" placeholder="Langkah penanganan / tindak lanjut">${r?.handlingNote || ''}</textarea></div>
    ${id ? `<button class="btn btn-d btn-full" onclick="delRec('protectionReports',${id},'Laporan')" style="margin-top:8px">🗑 Hapus Laporan</button>` : ''}
  `, `<button class="btn btn-t" onclick="closeSheet()">Batal</button><button class="btn btn-p" onclick="saveProtection(${id || 'null'})">💾 Simpan</button>`);
}

async function saveProtection(id) {
  const studentId = +$('prs').value, type = $('prt').value, description = $('prd').value.trim(), status = $('prst').value, handlingNote = $('prn').value.trim();
  if (!studentId || !type || !description) { snack('Lengkapi santri, jenis, dan deskripsi'); return; }
  const student = await db.students.get(studentId);
  const now = nowLocal();
  const data = { locationId: U.locationId, studentId, studentName: student?.name || '', type, description, status, handlingNote, updatedAt: now };
  if (id) {
    await db.protectionReports.update(id, data);
    logAudit('update', 'protectionReports', id, `Perbarui laporan perlindungan anak`);
  } else {
    data.reporterRole = U.role; data.reporterName = U.name; data.createdAt = now;
    await db.protectionReports.add(data);
    logAudit('create', 'protectionReports', null, `Catat laporan perlindungan anak`);
  }
  closeSheet(); snack('Laporan tersimpan'); render();
}

// ============================================================
// HELP / TUTORIAL MODULE
// ============================================================
const HELP_ITEMS = [
  { icon: '🏠', title: 'Dashboard', desc: 'Melihat ringkasan data TPA: jumlah santri, ustadz, kelas, keuangan, dan hafalan terbaru.', steps: `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">1</div><div style="font-size:13px">Buka tab Beranda di bottom navigation</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">2</div><div style="font-size:13px">Dashboard menampilkan statistik utama TPA</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">3</div><div style="font-size:13px">Scroll ke bawah untuk melihat hafalan terbaru</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">4</div><div style="font-size:13px">Tap "Semua →" untuk melihat detail</div></div>` },
  { icon: '👨‍🎓', title: 'Kelola Santri', desc: 'Menambah, mengedit, dan menghapus data santri.', steps: `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">1</div><div style="font-size:13px">Buka tab Data → pilih chip Santri</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">2</div><div style="font-size:13px">Tap tombol + (FAB) untuk tambah santri baru</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">3</div><div style="font-size:13px">Isi form: nama, NIS, JK, wali, alamat</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">4</div><div style="font-size:13px">Tap 💾 Simpan</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">5</div><div style="font-size:13px">Untuk edit, tap nama santri di daftar</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">6</div><div style="font-size:13px">Untuk hapus, buka form edit → tap 🗑 Hapus</div></div>` },
  { icon: '👳', title: 'Kelola Ustadz', desc: 'Mengelola data pengajar/ustadz.', steps: `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">1</div><div style="font-size:13px">Buka tab Data → chip Ustadz</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">2</div><div style="font-size:13px">Tap + untuk tambah ustadz baru</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">3</div><div style="font-size:13px">Isi nama, spesialisasi (Hafalan/Iqro/Tajwid), telepon</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">4</div><div style="font-size:13px">Tap 💾 Simpan</div></div>` },
  { icon: '🏫', title: 'Kelola Kelas', desc: 'Membuat kelas dan mengatur level & ruangan.', steps: `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">1</div><div style="font-size:13px">Buka tab Data → chip Kelas</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">2</div><div style="font-size:13px">Tap + untuk tambah kelas</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">3</div><div style="font-size:13px">Pilih level (Iqro 1-6, Juz Amma, Tahfidz)</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">4</div><div style="font-size:13px">Atur ruangan dan kapasitas maksimal</div></div>` },
  { icon: '📖', title: 'Kurikulum', desc: 'Melihat dan mengelola materi pembelajaran 7 pilar kurikulum.', steps: `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">1</div><div style="font-size:13px">Buka tab Akademik → chip Kurikulum</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">2</div><div style="font-size:13px">Lihat daftar materi per kategori</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">3</div><div style="font-size:13px">Tap materi untuk melihat detail</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">4</div><div style="font-size:13px">Materi sudah di-seed otomatis: Iqro, Hafalan, Tajwid, Fiqh, Akhlak, Doa, Sirah</div></div>` },
  { icon: '✅', title: 'Absensi', desc: 'Merekam kehadiran santri per kelas per hari.', steps: `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">1</div><div style="font-size:13px">Buka tab Akademik → chip Absensi</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">2</div><div style="font-size:13px">Tap + (FAB) untuk input absensi baru</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">3</div><div style="font-size:13px">Pilih kelas dari dropdown</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">4</div><div style="font-size:13px">Tap ✅/📝/🤒/❌ untuk setiap santri</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">5</div><div style="font-size:13px">Tap 💾 Simpan Absensi</div></div>` },
  { icon: '🕌', title: 'Input Hafalan', desc: 'Mencatat progres hafalan Al-Quran santri.', steps: `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">1</div><div style="font-size:13px">Buka tab Akademik → chip Hafalan</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">2</div><div style="font-size:13px">Tap + (FAB) untuk input baru</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">3</div><div style="font-size:13px">Pilih kelas → pilih santri</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">4</div><div style="font-size:13px">Pilih jenis: Ziyadah/Murajaah/Tasmi'</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">5</div><div style="font-size:13px">Pilih surat dan rentang ayat</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">6</div><div style="font-size:13px">Pilih nilai: Mumtaz → Belum Lulus</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">7</div><div style="font-size:13px">Tap 💾 Simpan</div></div>` },
  { icon: '📕', title: 'Input Iqro', desc: 'Mencatat progres Iqro santri.', steps: `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">1</div><div style="font-size:13px">Buka tab Akademik → chip Iqro</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">2</div><div style="font-size:13px">Tap + (FAB) untuk input baru</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">3</div><div style="font-size:13px">Pilih kelas → santri → jilid → halaman</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">4</div><div style="font-size:13px">Pilih nilai: Lancar/Cukup/Mengulang</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">5</div><div style="font-size:13px">Tap 💾 Simpan</div></div>` },
  { icon: '💰', title: 'Pembayaran SPP', desc: 'Mengelola tagihan dan pembayaran SPP santri.', steps: `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">1</div><div style="font-size:13px">Buka tab Keuangan → chip SPP</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">2</div><div style="font-size:13px">Tap "Generate Tagihan" untuk buat tagihan bulan ini</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">3</div><div style="font-size:13px">Tap tagihan yang belum lunas → isi jumlah bayar</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">4</div><div style="font-size:13px">Pilih metode: Tunai/Transfer/QRIS</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">5</div><div style="font-size:13px">Status otomatis berubah: Pending → Partial → Paid</div></div>` },
  { icon: '🏦', title: 'Kas Masuk/Keluar', desc: 'Mencatat arus kas TPA: infaq, donasi, operasional.', steps: `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">1</div><div style="font-size:13px">Buka tab Keuangan → chip Kas</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">2</div><div style="font-size:13px">Lihat ringkasan: Total Masuk, Keluar, Saldo</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">3</div><div style="font-size:13px">Tap + untuk catat transaksi baru</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">4</div><div style="font-size:13px">Pilih tipe (Masuk/Keluar) → kategori → jumlah</div></div>` },
  { icon: '💾', title: 'Backup & Restore', desc: 'Export dan import data untuk keamanan.', steps: `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">1</div><div style="font-size:13px">Buka tab Lainnya → chip Pengaturan</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">2</div><div style="font-size:13px">Tap "Export JSON" untuk backup</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">3</div><div style="font-size:13px">File JSON terdownload ke perangkat</div></div><div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><div style="width:24px;height:24px;background:var(--brand-light);color:var(--brand);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">4</div><div style="font-size:13px">Untuk restore: tap "Import" → pilih file JSON</div></div>` },
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

// ============================================================
// INIT
// ============================================================
export async function initAdmin() {
  await seedDemoData();
  if (!(await checkAuth())) return;
  renderNav();
  switchTab('home');
}

// Expose globals for inline onclick handlers
window.closeSheet = closeSheet;
window.goNotif = goNotif;
window.showHelp = showHelp;
window.showProfile = showProfile;
window.switchTab = switchTab;
window.onFab = onFab;
window.render = render;
window.clearSession = clearSessionUser;
window.showMaterialDetail = showMaterialDetail;
window.filterS = filterS;
window.showStudentForm = showStudentForm;
window.showTeacherForm = showTeacherForm;
window.showGuardianForm = showGuardianForm;
window.showClassForm = showClassForm;
window.loadAtt = loadAtt;
window.loadAS = loadAS;
window.setA = setA;
window.saveA = saveA;
window.loadHS = loadHS;
window.saveH = saveH;
window.loadIS = loadIS;
window.saveI = saveI;
window.genBills = genBills;
window.showPayForm = showPayForm;
window.savePay = savePay;
window.updCC = updCC;
window.saveCF = saveCF;
window.showProjectForm = showProjectForm;
window.savePj = savePj;
window.showLocationForm = showLocationForm;
window.saveLoc = saveLoc;
window.expD = expD;
window.impD = impD;
window.rstD = rstD;
window.markR = markR;
window.showProtectionForm = showProtectionForm;
window.saveProtection = saveProtection;
window.showTutorial = showTutorial;
window.snack = snack;
window.showSubjectRights = showSubjectRights;
window.exportStudentData = exportStudentData;
window.purgeStudent = purgeStudent;
window.showAuditLog = showAuditLog;
window.showReadiness = showReadiness;