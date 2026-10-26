/** Canonical Indonesian WhatsApp number used by authentication. */
export function normalizeWhatsApp(input: string): string | null {
  const raw = input.trim().replace(/[\s().-]/g, "");
  if (!raw) return null;

  let digits = raw;
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("00862")) digits = digits.slice(2);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;

  if (!/^628\d{8,11}$/.test(digits)) return null;
  return `+${digits}`;
}

export function looksLikeWhatsApp(input: string): boolean {
  return /^(?:\+|00)?\d[\d\s().-]{7,}$/.test(input.trim());
}

export function formatWhatsApp(phone: string): string {
  const normalized = normalizeWhatsApp(phone);
  if (!normalized) return phone;
  return normalized;
}
