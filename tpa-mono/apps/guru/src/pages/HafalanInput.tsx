import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { Card, Button, Select, Input, Textarea, Badge, Avatar, showToast } from '@shared/index';
import { useAuth } from '@shared/hooks/useAuth';
import { getSupabase } from '@shared/db/supabase';
import { SURAH_LIST } from '@shared/types/hafalan';
import type { HafalanType, HafalanGrade } from '@shared/types';
import { getGradeLabel, getGradeColor } from '@shared/utils/format';

export function HafalanInput() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [form, setForm] = useState({
    type: 'ziyadah' as HafalanType,
    surah_number: 114,
    ayat_from: 1,
    ayat_to: 6,
    grade: 'jayyid' as HafalanGrade,
    notes: '',
  });
  const [recentHistory, setRecentHistory] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { loadClasses(); }, [user]);

  const loadClasses = async () => {
    if (!user) return;
    const supabase = getSupabase();
    const { data: teacher } = await supabase.from('teachers').select('id').eq('user_id', user.id).single();
    if (!teacher) return;
    const { data } = await supabase.from('class_teachers').select('classes(id, name)').eq('teacher_id', teacher.id);
    setClasses((data || []).map((d: any) => d.classes));
  };

  useEffect(() => {
    if (!selectedClass) return;
    const loadStudents = async () => {
      const supabase = getSupabase();
      const { data } = await supabase.from('class_students')
        .select('students(id, name, nis, photo_url)').eq('class_id', selectedClass).eq('is_active', true);
      setStudents((data || []).map((d: any) => d.students));
    };
    loadStudents();
  }, [selectedClass]);

  useEffect(() => {
    if (!selectedStudent) return;
    const loadHistory = async () => {
      const { data } = await getSupabase().from('hafalan_progress')
        .select('*').eq('student_id', selectedStudent)
        .order('recorded_at', { ascending: false }).limit(10);
      setRecentHistory(data || []);
    };
    loadHistory();
  }, [selectedStudent]);

  const selectedSurah = SURAH_LIST.find(s => s.number === form.surah_number);

  const handleSubmit = useCallback(async () => {
    if (!selectedStudent) return;
    setIsSubmitting(true);
    try {
      const supabase = getSupabase();
      const { data: teacher } = await supabase.from('teachers').select('id').eq('user_id', user!.id).single();

      const { error } = await supabase.from('hafalan_progress').insert({
        student_id: selectedStudent,
        teacher_id: teacher?.id,
        type: form.type,
        surah_number: form.surah_number,
        surah_name: selectedSurah?.name || '',
        ayat_from: form.ayat_from,
        ayat_to: form.ayat_to,
        juz: selectedSurah?.juz,
        grade: form.grade,
        notes: form.notes,
        recorded_at: new Date().toISOString(),
      });

      if (error) throw error;
      showToast('success', 'Hafalan berhasil disimpan!');
      setForm(prev => ({ ...prev, notes: '' }));
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedStudent, form, user, selectedSurah]);

  const u = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row gap-4">
        <Select value={selectedClass} onChange={setSelectedClass} placeholder="Pilih kelas..."
          options={classes.map(c => ({ value: c.id, label: c.name }))} />
        <Select value={selectedStudent} onChange={setSelectedStudent} placeholder="Pilih santri..."
          options={students.map(s => ({ value: s.id, label: `${s.name} (${s.nis || '-'})` }))} />
      </div>

      {selectedStudent && (
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Input Hafalan">
            <div class="space-y-4">
              <Select label="Jenis Setoran" value={form.type} onChange={(v) => u('type', v)}
                options={[{value:'ziyadah',label:'Ziyadah (Baru)'},{value:'murajaah',label:'Murajaah (Ulang)'},{value:'tasmi',label:"Tasmi' (Setoran)"}]} />
              <Select label="Surat" value={form.surah_number.toString()} onChange={(v) => u('surah_number', parseInt(v))}
                options={SURAH_LIST.map(s => ({ value: s.number.toString(), label: `${s.number}. ${s.name} (${s.ayat_count} ayat)` }))} />
              <div class="grid grid-cols-2 gap-4">
                <Input label="Ayat Dari" type="number" value={form.ayat_from.toString()} min="1"
                  onInput={(e: any) => u('ayat_from', parseInt(e.target.value))} />
                <Input label="Ayat Sampai" type="number" value={form.ayat_to.toString()} min="1"
                  max={selectedSurah?.ayat_count.toString()}
                  onInput={(e: any) => u('ayat_to', parseInt(e.target.value))} />
              </div>
              <Select label="Nilai" value={form.grade} onChange={(v) => u('grade', v)}
                options={[
                  {value:'mumtaz',label:'Mumtaz (Sempurna)'},
                  {value:'jayyid_jiddan',label:'Jayyid Jiddan (Sangat Baik)'},
                  {value:'jayyid',label:'Jayyid (Baik)'},
                  {value:'maqbul',label:'Maqbul (Cukup)'},
                  {value:'belum_lulus',label:'Belum Lulus'},
                ]} />
              <Textarea label="Catatan" value={form.notes} onInput={(e: any) => u('notes', e.target.value)}
                placeholder="Catatan tambahan..." />
              <Button onClick={handleSubmit} fullWidth isLoading={isSubmitting}>💾 Simpan Hafalan</Button>
            </div>
          </Card>

          <Card title="Riwayat Hafalan">
            {recentHistory.length === 0 ? (
              <p class="text-gray-400 text-center py-8">Belum ada riwayat</p>
            ) : (
              <div class="space-y-3">
                {recentHistory.map((h, i) => (
                  <div key={i} class="p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <div class="flex justify-between items-start">
                      <div>
                        <p class="font-medium text-sm">{h.surah_name}</p>
                        <p class="text-xs text-gray-500">Ayat {h.ayat_from}-{h.ayat_to} | {h.type}</p>
                      </div>
                      <Badge label={getGradeLabel(h.grade)} color={getGradeColor(h.grade)} />
                    </div>
                    {h.notes && <p class="text-xs text-gray-500 mt-1">{h.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
