// ==================== NAVIGATION (ESM) ====================
import { setCurrentPage } from './app-state.js';
import { loadBeranda } from './beranda.js';
import { loadPOS } from './pos.js';
import { renderMenuList } from './menu.js';
import { loadReport } from './laporan.js';
import { loadSettings } from './settings.js';
import { initBantuan } from './bantuan.js';

export function showPage(page) {
  setCurrentPage(page);
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const el = document.getElementById('page-' + page);
  if (el) el.classList.add('active');
  const nav = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (nav) nav.classList.add('active');

  if (page === 'beranda') loadBeranda();
  else if (page === 'jualan') loadPOS();
  else if (page === 'menu') renderMenuList();
  else if (page === 'laporan') { loadReport(); }
  else if (page === 'pengaturan') loadSettings();
  else if (page === 'bantuan') initBantuan();
}
