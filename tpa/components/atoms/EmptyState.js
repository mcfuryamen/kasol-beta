/**
 * Atom: EmptyState
 * Empty data placeholder
 */
export function EmptyState({ icon = '&#128269;', title = 'Belum ada data', message = 'Tambahkan data baru untuk memulai', action = null }) {
  const container = el('div', { class: 'empty-state' });
  const iconEl = el('div', { class: 'empty-icon' });
  iconEl.innerHTML = icon;
  container.appendChild(iconEl);

  const titleEl = el('h3', { class: 'empty-title' });
  titleEl.textContent = title;
  container.appendChild(titleEl);

  if (message) {
    const msgEl = el('p', { class: 'empty-message' });
    msgEl.textContent = message;
    container.appendChild(msgEl);
  }

  if (action) {
    if (typeof action === 'string') {
      container.innerHTML += action;
    } else if (Array.isArray(action)) {
      action.forEach(a => { if (a) container.appendChild(a); });
    } else {
      container.appendChild(action);
    }
  }

  return container;
}

// Common presets
export const PRESETS = {
  noStudents: () => EmptyState({
    icon: '&#128100;',
    title: 'Belum ada Santri',
    message: 'Tambahkan santri baru untuk memulai'
  }),
  noClasses: () => EmptyState({
    icon: '&#127891;',
    title: 'Belum ada Kelas',
    message: 'Buat kelas baru terlebih dahulu'
  }),
  noAttendance: () => EmptyState({
    icon: '&#9745;',
    title: 'Belum ada Kehadiran',
    message: 'Catat kehadiran di halaman absensi'
  }),
  noResults: () => EmptyState({
    icon: '&#128269;',
    title: 'Tidak ditemukan',
    message: 'Coba ubah kata kunci pencarian'
  })
};
