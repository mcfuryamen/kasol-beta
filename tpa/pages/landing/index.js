/**
 * Landing Page Module (ESM)
 * Halaman publik TPA — menampilkan statistik live dari DB.
 * Menggunakan query db.* langsung yang identik dengan HTML aktif.
 */
import { db } from '../../db/dexie.js';

// Seed data awal (lokasi, user default, settings)
async function ensureSeed() {
  let locs = await db.locations.toArray();
  if (!locs.length) {
    await db.locations.add({ name: 'TPA Al-Hikmah', address: '', isActive: 1 });
    locs = await db.locations.toArray();
  }
  const lid = locs[0].id;
  const users = await db.users.toArray();
  if (!users.length) {
    await db.users.bulkAdd([
      { role: 'admin', name: 'Admin TPA', locationId: lid, isActive: 1 },
      { role: 'ustadz', name: 'Ustadz Hasan', locationId: lid, isActive: 1 },
      { role: 'wali', name: 'Bapak Ahmad', locationId: lid, isActive: 1 }
    ]);
  }
  if (!(await db.settings.get('setupDone'))) await db.settings.put({ key: 'setupDone', value: '1' });
  if (!(await db.settings.get('bizName'))) await db.settings.put({ key: 'bizName', value: 'TPA Al-Hikmah' });
  if (!(await db.settings.get('trialStart'))) await db.settings.put({ key: 'trialStart', value: new Date().toISOString() });
  if (!(await db.settings.get('licenseActivatedAt'))) await db.settings.put({ key: 'licenseActivatedAt', value: '' });
  if (!(await db.settings.get('deviceCode'))) await db.settings.put({ key: 'deviceCode', value: '' });
  return lid;
}

// Load live stats from DB
async function loadStats() {
  try {
    const loc = await db.locations.toArray();
    if (!loc.length) return;
    const lid = loc[0].id;
    const sc = await db.students.where('locationId').equals(lid).filter(s => s.isActive).count();
    const tc = await db.teachers.where('locationId').equals(lid).count();
    const cc = await db.classes.where('locationId').equals(lid).count();
    document.getElementById('st-santri').textContent = sc;
    document.getElementById('st-guru').textContent = tc;
    document.getElementById('st-kelas').textContent = cc;

    // Load teachers for team section
    const teachers = await db.teachers.where('locationId').equals(lid).toArray();
    const tg = document.getElementById('team-grid');
    tg.innerHTML = '';
    if (!teachers.length) { tg.innerHTML = '<p style="color:#94a3b8;text-align:center;grid-column:1/-1">Data pengajar akan muncul setelah diinput di sistem admin.</p>'; return; }
    teachers.forEach(t => {
      tg.innerHTML += `<div class="team-card"><div class="t-av">${t.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}</div><h4>${t.name}</h4><div class="t-role">${t.gender === 'L' ? 'Ustadz' : 'Ustadzah'}</div><div class="t-spec">${t.specialization || 'Pengajar'}</div></div>`;
    });

    // Load address
    if (loc[0].address) document.getElementById('ct-addr').textContent = loc[0].address;
  } catch (e) { console.warn(e); }
}

export function initLanding() {
  window.closeMM = () => document.getElementById('mob-menu').classList.remove('show');
  window.addEventListener('scroll', () => {
    document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 10);
  });
  window.addEventListener('DOMContentLoaded', async () => {
    try { await ensureSeed(); } catch (e) { console.warn(e); }
    loadStats();
  });
}