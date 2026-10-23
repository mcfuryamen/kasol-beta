/**
 * Organism: HafalanCard
 * Card hafalan untuk menampilkan progres hafalan siswa
 */
import { el } from '../../db/init.js';
import { getStudentHafalan } from '../../services/hafalan.js';
import { Badge } from '../atoms/Badge.js';

export function HafalanCard({ studentId, studentName = '' }) {
  const card = el('div', { class: 'card' });
  const title = el('div', { class: 'card-header' });
  title.innerHTML = '<h3 class="font-bold">Progres Hafalan' + (studentName ? ' - ' + studentName : '') + '</h3>';
  card.appendChild(title);

  const body = el('div', { class: 'card-body' });
  card.appendChild(body);

  async function load() {
    body.innerHTML = '<div class="p-4 text-center text-gray-400">Memuat...</div>';
    const hafalan = await getStudentHafalan(studentId);
    body.innerHTML = '';

    if (!hafalan || hafalan.length === 0) {
      body.innerHTML = '<div class="p-4 text-center text-gray-400">Belum ada data hafalan</div>';
      return;
    }

    hafalan.forEach(h => {
      const item = el('div', { class: 'hafalan-item p-3 border-b border-gray-100 last:border-0' });
      const top = el('div', { class: 'flex justify-between items-start mb-2' });
      const surah = el('div');
      const nm = el('div', { class: 'font-semibold' });
      nm.textContent = h.surah_name || h.surah;
      const detail = el('div', { class: 'text-xs text-gray-400' });
      detail.textContent = (h.start_verse || 1) + ' - ' + (h.end_verse || '') + ' | ' + (h.juz || '');
      surah.appendChild(nm);
      surah.appendChild(detail);
      top.appendChild(surah);

      const badge = Badge({ text: h.status === 'memorized' ? 'Hafal' : h.status === 'reviewing' ? 'Murajaah' : 'Sedang Menghafal', color: h.status === 'memorized' ? 'green' : h.status === 'reviewing' ? 'yellow' : 'blue' });
      top.appendChild(badge);
      item.appendChild(top);

      const progressWrap = el('div', { class: 'mt-2' });
      const pct = h.progress || 0;
      const pctText = el('div', { class: 'text-xs text-gray-500 mb-1 flex justify-between' });
      pctText.innerHTML = '<span>' + (h.status === 'memorized' ? 'Selesai' : 'Progress') + '</span><span>' + pct + '%</span>';
      progressWrap.appendChild(pctText);
      const bar = el('div', { class: 'w-full bg-gray-200 rounded-full h-2' });
      const fill = el('div', {
        class: 'h-2 rounded-full ' + (h.status === 'memorized' ? 'bg-green-500' : 'bg-blue-500'),
        style: 'width: ' + pct + '%'
      });
      bar.appendChild(fill);
      progressWrap.appendChild(bar);
      item.appendChild(progressWrap);
      body.appendChild(item);
    });
  }

  load();
  return card;
}
