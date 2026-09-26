/**
 * Atom: Button
 * Variants: primary, secondary, danger, ghost
 * Sizes: sm, md, lg
 */
export function Button({ id, class: cls, variant = 'primary', size = 'md', type = 'button', disabled = false, onclick, text }) {
  const base = 'btn btn-' + variant + ' btn-' + size + (cls ? ' ' + cls : '');
  const attrs = { id, class: base, type, disabled };
  if (onclick) attrs.onclick = onclick;
  return el('button', attrs, text || '');
}

// Variant label helpers
export const VARIANTS = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'bg-transparent text-blue-600 hover:bg-blue-50',
  success: 'bg-green-600 text-white hover:bg-green-700',
  warning: 'bg-yellow-500 text-white hover:bg-yellow-600'
};

// Size classes
export const SIZES = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-4 py-2 text-base'
};
