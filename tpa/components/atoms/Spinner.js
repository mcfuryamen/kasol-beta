/**
 * Atom: Spinner / Loading
 */
export function Spinner({ size = 'md', class: cls }) {
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };
  const s = sizeMap[size] || sizeMap.md;
  return el('div', {
    class: 'flex items-center justify-center' + (cls ? ' ' + cls : ''),
    html: `<svg class="animate-spin ${s} text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
    </svg>`
  });
}

export function LoadingOverlay({ text = 'Memuat...' }) {
  return el('div', {
    class: 'fixed inset-0 bg-black/30 flex flex-col items-center justify-center z-50',
    html: `<div class="bg-white rounded-xl p-6 flex flex-col items-center gap-3 shadow-lg">
      <svg class="animate-spin w-10 h-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
      </svg>
      <span class="text-gray-600 text-sm">${text}</span>
    </div>`
  });
}

export function Skeleton({ lines = 3, class: cls }) {
  const wrapper = el('div', { class: 'flex flex-col gap-2' + (cls ? ' ' + cls : '') });
  for (let i = 0; i < lines; i++) {
    const bar = el('div', { class: 'skeleton-line' });
    bar.style.width = (60 + Math.random() * 30) + '%';
    wrapper.appendChild(bar);
  }
  return wrapper;
}
