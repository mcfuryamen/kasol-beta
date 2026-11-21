/**
 * Control Center Kasir Solo — Grow Up Module (shell tab)
 * Grow Up = tab Sosmed + Kalender Konten (merge 2026-10-28).
 * Shell-nya saja di sini: isi masing-masing tab tetap dikelola sosmed.js &
 * kalender.js dengan ID element yang tidak berubah (pola merge CRM).
 */

const GROWUP_TABS = ['social', 'kalender'];
let activeTab = 'social';

/** Ganti tab Grow Up + persist ke URL hash (#growup?tab=...).
 *  Global supaya bisa dipanggil dari navigation.js (deep-link #growup?tab=…
 *  / redirect legacy #social & #kalender). */
window.setGrowupTab = function (tab) {
  if (!GROWUP_TABS.includes(tab)) tab = activeTab;
  activeTab = tab;
  document.querySelectorAll('#growupTabs .content-tab').forEach((b) => {
    const on = b.dataset.gtab === tab;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  });
  const viewSocial = document.getElementById('growupViewSocial');
  const viewKalender = document.getElementById('growupViewKalender');
  if (viewSocial) viewSocial.hidden = tab !== 'social';
  if (viewKalender) viewKalender.hidden = tab !== 'kalender';
  // replaceState = tidak memicu hashchange (navigation yang pegang event itu)
  history.replaceState(null, '', '#growup?tab=' + tab);
  // Muat data tab yang baru dibuka ditangani listener screen:change 'growup'
  // di sosmed.js (initSocial, idempoten) & kalender.js (load+render).
};

export function initGrowup() {
  document.querySelectorAll('#growupTabs .content-tab').forEach((btn) => {
    btn.addEventListener('click', () => window.setGrowupTab(btn.dataset.gtab));
  });
}
