/**
 * Atom: Badge
 * Status indicators
 */
export function Badge({ text, variant = 'default', class: cls }) {
  const colorMap = {
    default: 'bg-gray-100 text-gray-700',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    danger: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700'
  };
  const color = colorMap[variant] || colorMap.default;
  return el('span', { class: 'badge ' + color + (cls ? ' ' + cls : '') }, text);
}

// Preset badges
export const STATUS_BADGE = {
  hadir: { text: 'Hadir', variant: 'success' },
  izin: { text: 'Izin', variant: 'warning' },
  sakit: { text: 'Sakit', variant: 'info' },
  alpha: { text: 'Alpha', variant: 'danger' },
  paid: { text: 'Lunas', variant: 'success' },
  pending: { text: 'Belum', variant: 'danger' },
  partial: { text: 'Sebagian', variant: 'warning' },
  active: { text: 'Aktif', variant: 'success' },
  inactive: { text: 'Nonaktif', variant: 'default' }
};

export function StatusBadge({ status }) {
  const preset = STATUS_BADGE[status];
  if (!preset) return Badge({ text: status });
  return Badge({ text: preset.text, variant: preset.variant });
}
