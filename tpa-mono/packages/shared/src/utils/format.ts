// ============================================================
// Formatting Utilities
// ============================================================

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('id-ID').format(num);
}

export function formatPhone(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('62')) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)}-${cleaned.slice(5, 9)}-${cleaned.slice(9)}`;
  }
  if (cleaned.startsWith('0')) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
  }
  return phone;
}

export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function truncate(str: string, length = 50): string {
  if (!str || str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function generateReceiptNumber(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  const d = now.getDate().toString().padStart(2, '0');
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `KWT-${y}${m}${d}-${r}`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function getGradeColor(grade: string): string {
  const colors: Record<string, string> = {
    mumtaz: 'text-green-600 bg-green-100',
    jayyid_jiddan: 'text-blue-600 bg-blue-100',
    jayyid: 'text-yellow-600 bg-yellow-100',
    maqbul: 'text-orange-600 bg-orange-100',
    belum_lulus: 'text-red-600 bg-red-100',
    lancar: 'text-green-600 bg-green-100',
    cukup: 'text-yellow-600 bg-yellow-100',
    mengulang: 'text-red-600 bg-red-100',
  };
  return colors[grade] || 'text-gray-600 bg-gray-100';
}

export function getGradeLabel(grade: string): string {
  const labels: Record<string, string> = {
    mumtaz: 'Mumtaz (Sempurna)',
    jayyid_jiddan: 'Jayyid Jiddan (Sangat Baik)',
    jayyid: 'Jayyid (Baik)',
    maqbul: 'Maqbul (Cukup)',
    belum_lulus: 'Belum Lulus',
    lancar: 'Lancar',
    cukup: 'Cukup',
    mengulang: 'Mengulang',
  };
  return labels[grade] || grade;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'text-yellow-600 bg-yellow-100',
    paid: 'text-green-600 bg-green-100',
    partial: 'text-blue-600 bg-blue-100',
    overdue: 'text-red-600 bg-red-100',
    hadir: 'text-green-600 bg-green-100',
    izin: 'text-blue-600 bg-blue-100',
    sakit: 'text-yellow-600 bg-yellow-100',
    alpha: 'text-red-600 bg-red-100',
    planned: 'text-gray-600 bg-gray-100',
    in_progress: 'text-blue-600 bg-blue-100',
    completed: 'text-green-600 bg-green-100',
    cancelled: 'text-red-600 bg-red-100',
  };
  return colors[status] || 'text-gray-600 bg-gray-100';
}
