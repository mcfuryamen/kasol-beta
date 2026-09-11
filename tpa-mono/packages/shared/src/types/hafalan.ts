import type { UUID, BaseEntity } from './index';

export type HafalanType = 'ziyadah' | 'murajaah' | 'tasmi';
export type HafalanGrade = 'mumtaz' | 'jayyid_jiddan' | 'jayyid' | 'maqbul' | 'belum_lulus';

export interface HafalanProgress extends BaseEntity {
  student_id: UUID;
  teacher_id?: UUID;
  session_id?: UUID;
  type: HafalanType;
  surah_number: number;
  surah_name: string;
  ayat_from: number;
  ayat_to: number;
  juz?: number;
  page?: number;
  grade: HafalanGrade;
  notes?: string;
  recorded_at: string;
  // Joined
  student_name?: string;
  teacher_name?: string;
}

export interface HafalanFormData {
  student_id: string;
  type: HafalanType;
  surah_number: number;
  surah_name: string;
  ayat_from: number;
  ayat_to: number;
  juz?: number;
  page?: number;
  grade: HafalanGrade;
  notes?: string;
}

export interface HafalanSummary {
  student_id: UUID;
  student_name: string;
  total_entries: number;
  last_surah: string;
  last_ayat: number;
  total_ayat_memorized: number;
  total_juz: number;
  average_grade: string;
}

// Daftar 114 surat Al-Quran
export const SURAH_LIST: Array<{ number: number; name: string; ayat_count: number; juz: number }> = [
  { number: 1, name: 'Al-Fatihah', ayat_count: 7, juz: 1 },
  { number: 2, name: 'Al-Baqarah', ayat_count: 286, juz: 1 },
  { number: 3, name: 'Ali Imran', ayat_count: 200, juz: 3 },
  { number: 78, name: 'An-Naba', ayat_count: 40, juz: 30 },
  { number: 87, name: 'Al-Ala', ayat_count: 19, juz: 30 },
  { number: 93, name: 'Ad-Dhuha', ayat_count: 11, juz: 30 },
  { number: 94, name: 'Al-Insyirah', ayat_count: 8, juz: 30 },
  { number: 95, name: 'At-Tin', ayat_count: 8, juz: 30 },
  { number: 96, name: 'Al-Alaq', ayat_count: 19, juz: 30 },
  { number: 97, name: 'Al-Qadr', ayat_count: 5, juz: 30 },
  { number: 98, name: 'Al-Bayyinah', ayat_count: 8, juz: 30 },
  { number: 99, name: 'Az-Zalzalah', ayat_count: 8, juz: 30 },
  { number: 100, name: 'Al-Adiyat', ayat_count: 11, juz: 30 },
  { number: 101, name: 'Al-Qariah', ayat_count: 11, juz: 30 },
  { number: 102, name: 'At-Takasur', ayat_count: 8, juz: 30 },
  { number: 103, name: 'Al-Asr', ayat_count: 3, juz: 30 },
  { number: 104, name: 'Al-Humazah', ayat_count: 9, juz: 30 },
  { number: 105, name: 'Al-Fil', ayat_count: 5, juz: 30 },
  { number: 106, name: 'Quraisy', ayat_count: 4, juz: 30 },
  { number: 107, name: 'Al-Maun', ayat_count: 7, juz: 30 },
  { number: 108, name: 'Al-Kausar', ayat_count: 3, juz: 30 },
  { number: 109, name: 'Al-Kafirun', ayat_count: 6, juz: 30 },
  { number: 110, name: 'An-Nasr', ayat_count: 3, juz: 30 },
  { number: 111, name: 'Al-Lahab', ayat_count: 5, juz: 30 },
  { number: 112, name: 'Al-Ikhlas', ayat_count: 4, juz: 30 },
  { number: 113, name: 'Al-Falaq', ayat_count: 5, juz: 30 },
  { number: 114, name: 'An-Nas', ayat_count: 6, juz: 30 },
];
