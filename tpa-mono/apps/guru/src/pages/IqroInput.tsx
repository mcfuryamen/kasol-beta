import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { Card, Button, Select, Input, Textarea, Badge, showToast } from '@shared/index';
import { useAuth } from '@shared/hooks/useAuth';
import { getSupabase } from '@shared/db/supabase';
import { IQRO_JILID_PAGES } from '@shared/types/iqro';
import { getGradeLabel, getGradeColor } from '@shared/utils/format';

export function IqroInput() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [form, setForm] = useState({ jilid: 1, page: 1, grade: 'lancar' as const, notes: '' });
  const [history, setHistory] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const supabase = getSupabase();
      const { data: teacher } = await supabase.from('teachers').select('id').eq('user_id', user.id).single();
      if (!teacher) return;
      const { data } = await supabase.from('class_teachers').select('classes(id, name)').eq('teacher_id', teacher.id);
      setClasses((data || []).map((d: any) => d.classes));
    };
    load();
  }, [user]);

  useEffect(() => {
    if (!selectedClass) return;
    getSupabase().from('class_students').select('students(id, name, nis)')
      .eq('class_id', selectedClass).eq('is_active', true)
      .then(({ data }) => setStudents((data || []).map((d: any) => d.students)));
  }, [selectedClass]);

  useEffect(() => {
    if (!selectedStudent) return;
    getSupabase().from('iqro_progress').select('*').eq('student_id', selectedStudent)
      .order('recorded_at', { ascending: false }).limit(10)
      .then(({ data }) => setHistory(data || []));
  }, [selectedStudent]);

  const handleSubmit = useCallback(async () => {
    if (!selectedStudent) return;
    setIsSubmitting(true);
    try {
      const supabase = getSupabase();
      const { data: teacher } = await supabase.from('teachers').select('id').eq('user_id', user!.id).single();
      await supabase.from('iqro_progress').insert({
        student_id: selectedStudent, teacher_id: teacher?.id,
        jilid: form.jilid, page: form.page, grade: form.grade,
        notes: form.notes, recorded_at: new Date().toISOString(),
      });
      showToast('success', 'Progres Iqro disimpan!');
      setForm(prev => ({ ...prev, notes: '' }));
    } catch (err: any) { showToast('error', err.message); }
    finally { setIsSubmitting(false); }
  }, [selectedStudent, form, user]);

  const u = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div class="space-y-6">
      <div class="flex gap-4">
        <Select value={selectedClass} onChange={setSelectedClass} placeholder="Pilih kelas..."
          options={classes.map(c => ({ value: c.id, label: c.name }))} />
        <Select value={selectedStudent} onChange={setSelectedStudent} placeholder="Pilih santri..."
          options={students.map(s => ({ value: s.id, label: s.name }))} />
      </div>

      {selectedStudent && (
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Input Progres Iqro">
            <div class="space-y-4">
              <Select label="Jilid" value={form.jilid.toString()} onChange={(v) => u('jilid', parseInt(v))}
                options={[1,2,3,4,5,6].map(j => ({ value: j.toString(), label: `Jilid ${j} (${IQRO_JILID_PAGES[j]} hal)` }))} />
              <Input label="Halaman" type="number" value={form.page.toString()} min="1"
                max={IQRO_JILID_PAGES[form.jilid]?.toString()}
                onInput={(e: any) => u('page', parseInt(e.target.value))} />
              <div class="space-y-2">
                <label class="block text-sm font-medium text-gray-700">Nilai</label>
                <div class="flex gap-2">
                  {(['lancar', 'cukup', 'mengulang'] as const).map(g => (
                    <button key={g} onClick={() => u('grade', g)}
                      class={`flex-1 py-3 rounded-lg text-sm font-medium border transition-all ${
                        form.grade === g ? getGradeColor(g) + ' border-current' : 'bg-gray-50 text-gray-400'
                      }`}>
                      {getGradeLabel(g)}
                    </button>
                  ))}
                </div>
              </div>
              <Textarea label="Catatan" value={form.notes} onInput={(e: any) => u('notes', e.target.value)} />
              <Button onClick={handleSubmit} fullWidth isLoading={isSubmitting}>💾 Simpan</Button>
            </div>
          </Card>

          <Card title="Riwayat Iqro">
            <div class="space-y-3">
              {history.map((h, i) => (
                <div key={i} class="p-3 rounded-lg bg-gray-50 flex justify-between items-center">
                  <div>
                    <p class="font-medium text-sm">Jilid {h.jilid} - Hal {h.page}</p>
                    {h.notes && <p class="text-xs text-gray-500">{h.notes}</p>}
                  </div>
                  <Badge label={getGradeLabel(h.grade)} color={getGradeColor(h.grade)} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
