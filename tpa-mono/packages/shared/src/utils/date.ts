import { format, parseISO, differenceInDays, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameMonth } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

export function formatDate(date: string | Date, fmt = 'dd MMM yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, fmt, { locale: localeId });
}

export function formatDateTime(date: string | Date): string {
  return formatDate(date, 'dd MMM yyyy HH:mm');
}

export function formatTime(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':');
  return `${h}:${m}`;
}

export function formatMonth(date: string | Date): string {
  return formatDate(date, 'MMMM yyyy');
}

export function formatDay(date: string | Date): string {
  return formatDate(date, 'EEEE');
}

export function getMonthRange(date: Date = new Date()) {
  return {
    start: startOfMonth(date),
    end: endOfMonth(date),
  };
}

export function getCalendarDays(date: Date = new Date()): Date[] {
  const { start, end } = getMonthRange(date);
  return eachDayOfInterval({ start, end });
}

export function daysSince(date: string | Date): number {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return differenceInDays(new Date(), d);
}

export { isToday, isSameMonth };

export function getAcademicYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
}

export function getSemester(): 'ganjil' | 'genap' {
  const month = new Date().getMonth() + 1;
  return month >= 7 || month <= 12 ? 'ganjil' : 'genap';
}
