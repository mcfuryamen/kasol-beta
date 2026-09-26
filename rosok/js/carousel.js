/* =========================================================================
   KASIR SOLO - ROSOK
   carousel.js — Platform messages carousel. Imports: db, state, utils.
   ========================================================================= */
import { db } from './db.js';
import { platCurrentSlide, platAutoTimer, PLAT_SCROLL_MS, setPlatCurrentSlide, setPlatAutoTimer } from './app-state.js';
import { escapeHtml } from './utils.js';

export async function renderPlatformCarousel() {
  const el = document.getElementById('platCarouselEl');
  if (!el) return;
  const now = new Date().toISOString();
  let msgs = await db.platformMessages
    .where('visibleFrom').belowOrEqual(now)
    .and(m => m.visibleUntil === null || m.visibleUntil >= now)
    .toArray();
  msgs = msgs.sort((a, b) => (a.order || 0) - (b.order || 0)).slice(0, 5);
  if (msgs.length === 0) { el.innerHTML = ''; return; }

  const gradients = [
    'linear-gradient(135deg, #E85D04 0%, #FF8C42 100%)',
    'linear-gradient(135deg, #1982C4 0%, #2EABCA 100%)',
    'linear-gradient(135deg, #70117E 0%, #B5368D 100%)',
    'linear-gradient(135deg, #0A5636 0%, #248A4F 100%)',
    'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)'
  ];

  let slidesHtml = msgs.map((m, i) => `
    <div class="plat-carousel-slide" style="background:${m.gradient || gradients[i % gradients.length]}; border-radius:var(--radius-lg);">
      <div class="plat-emoji">${m.emoji || '📢'}</div>
      <div class="plat-title">${escapeHtml(m.title)}</div>
      <div class="plat-body">${escapeHtml(m.body)}</div>
    </div>
  `).join('');

  const dotsHtml = msgs.map((_, i) =>
    `<button class="plat-dot${i === 0 ? ' active' : ''}" onclick="window._ksr_platGoTo(${i})"></button>`
  ).join('');

  el.innerHTML = `
    <div class="plat-carousel" id="platCarouselRoot">
      <div class="plat-carousel-track" id="platTrack">${slidesHtml}</div>
      <div class="plat-carousel-dots">${dotsHtml}</div>
    </div>
  `;

  let touchStartX = 0;
  const root = document.getElementById('platCarouselRoot');
  if (root) {
    root.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
    root.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].screenX - touchStartX;
      if (dx < -40) { platNext(); platResetAuto(); }
      else if (dx > 40) { platPrev(); platResetAuto(); }
    }, { passive: true });
  }

  setPlatCurrentSlide(0);
  platSetSlide(0);
  platStartAuto();
}

export function platSetSlide(i) {
  const track = document.getElementById('platTrack');
  if (!track) return;
  setPlatCurrentSlide(i);
  track.style.transform = `translateX(-${i * 100}%)`;
  document.querySelectorAll('.plat-dot').forEach((d, idx) => d.classList.toggle('active', idx === i));
}
export function platNext() {
  const count = document.querySelectorAll('.plat-carousel-slide').length;
  platSetSlide((platCurrentSlide + 1) % Math.max(1, count));
}
export function platPrev() {
  const count = document.querySelectorAll('.plat-carousel-slide').length;
  platSetSlide((platCurrentSlide - 1 + count) % Math.max(1, count));
}
export function platGoTo(i) { platSetSlide(i); platResetAuto(); }
export function platStartAuto() {
  platStopAuto();
  setPlatAutoTimer(setInterval(platNext, PLAT_SCROLL_MS));
}
export function platStopAuto() { if (platAutoTimer) { clearInterval(platAutoTimer); setPlatAutoTimer(null); } }
export function platResetAuto() { platStopAuto(); platStartAuto(); }

window._ksr_platGoTo = platGoTo;
