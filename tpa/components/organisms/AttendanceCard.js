/**
 * Organism: AttendanceCard
 * Card absensi untuk guru - tampilkan daftar siswa dengan toggle hadir/sakit/izin/alfa
 */
import { el } from '../../db/init.js';
import { getStudentsByClass } from '../../services/student.js';
import { getSessionAttendances } from '../../services/attendance.js';
import { recordAttendance } from '../../services/attendance.js';
import { Badge } from '../atoms/Badge.js';

export function AttendanceCard({ classId, sessionDate = null }) {
  const card = el('div', { class: 'card' });
  const title = el('div', { class: 'card-header flex justify-between items-center' });
  title.innerHTML = '<h3 class="font-bold">Absensi Siswa</h3>';
  const dateDisplay = el('span', { class: 'text-sm text-gray-500' });
  dateDisplay.textContent = sessionDate || new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  title.appendChild(dateDisplay);
  card.appendChild(title);

  const body = el('div', { class: 'card-body' });
  const list = el('div', { class: 'attendance-list' });
  body.appendChild(list);
  card.appendChild(body);

  async function load() {
    list.innerHTML = '<div class="p-4 text-center text-gray-400">Memuat...</div>';
    const students = await getStudentsByClass(classId);
    const sessionId = sessionDate || new Date().toISOString().split('T')[0];
    const attendances = await getSessionAttendances(sessionId);
    const attMap = {};
    attendances.forEach(a => { attMap[a.student_id] = a; });

    list.innerHTML = '';
    if (students.length === 0) {
      list.innerHTML = '<div class="p-4 text-center text-gray-400">Tidak ada siswa di kelas ini</div>';
      return;
    }

    students.forEach(student => {
      const att = attMap[student.id] || {};
      const status = att.status || 'pending';
      const row = el('div', { class: 'attendance-row flex items-center justify-between p-3 border-b border-gray-100' });
      const info = el('div', { class: 'flex items-center gap-3' });
      info.innerHTML = '<div class="avatar-sm bg-blue-100 text-blue-600 rounded-full w-10 h-10 flex items-center justify-center font-bold text-sm">' + student.name.charAt(0).toUpperCase() + '</div>';
      const texts = el('div');
      const nm = el('div', { class: 'font-semibold text-sm' });
      nm.textContent = student.name;
      const nis = el('div', { class: 'text-xs text-gray-400' });
      nis.textContent = student.nis;
      texts.appendChild(nm);
      texts.appendChild(nis);
      info.appendChild(texts);
      row.appendChild(info);

      const buttons = el('div', { class: 'flex gap-1' });
      const statuses = [
        { key: 'hadir', label: 'H', color: 'bg-green-500', title: 'Hadir' },
        { key: 'sakit', label: 'S', color: 'bg-yellow-500', title: 'Sakit' },
        { key: 'izin', label: 'I', color: 'bg-blue-500', title: 'Izin' },
        { key: 'alfa', label: 'A', color: 'bg-red-500', title: 'Alfa' }
      ];
      statuses.forEach(s => {
        const btn = el('button', {
          class: 'w-8 h-8 rounded-full text-white font-bold text-xs ' + s.color + (status === s.key ? ' ring-2 ring-offset-1 ring-gray-400' : ' opacity-50'),
          title: s.title,
          onclick: async () => {
            btn.style.opacity = '1';
            btn.classList.add('ring-2', 'ring-offset-1', 'ring-gray-400');
            buttons.querySelectorAll('button').forEach(b => {
              if (b !== btn) { b.style.opacity = '0.5'; b.classList.remove('ring-2', 'ring-offset-1', 'ring-gray-400'); }
            });
            await recordAttendance({ studentId: student.id, classId, sessionId, status: s.key });
          }
        });
        btn.textContent = s.label;
        buttons.appendChild(btn);
      });
      row.appendChild(buttons);
      list.appendChild(row);
    });
  }

  load();
  return card;
}
