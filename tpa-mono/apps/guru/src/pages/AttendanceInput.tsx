import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { Card, Button, Select, Badge, Avatar, showToast } from '@shared/index';
import { useAuth } from '@shared/hooks/useAuth';
import { getSupabase } from '@shared/db/supabase';
import { formatDate } from '@shared/utils/date';
import type { AttendanceStatus } from '@shared/types';

const STATUS_OPTIONS: Array<{ value: AttendanceStatus; label: string; icon: string; color: string }> = [
  { value: 'hadir', label: 'Hadir', icon: '✅', color: 'bg-green-100 text-green-700 border-green-300' },
  { value: 'izin', label: 'Izin', icon: '📝', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'sakit', label: 'Sakit', icon: '🤒', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { value: 'alpha', label: 'Alpha', icon: '❌', color: 'bg-red-100 text-red-700 border-red-300' },
];

export function AttendanceInput() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const today = new Date().toISOString().split('T')[0];

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
    loadStudents();
  }, [selectedClass]);

  const loadStudents = async () => {
    const supabase = getSupabase();
    const { data } = await supabase.from('class_students')
      .select('students(id, name, nis, photo_url)').eq('class_id', selectedClass).eq('is_active', true);
    const studentList = (data || []).map((d: any) => d.students);
    setStudents(studentList);
    // Default all to hadir
    const defaultAttendance: Record<string, AttendanceStatus> = {};
    studentList.forEach((s: any) => { defaultAttendance[s.id] = 'hadir'; });
    setAttendance(defaultAttendance);
  };

  const handleSubmit = useCallback(async () => {
    if (!selectedClass || students.length === 0) return;
    setIsSubmitting(true);
    try {
      const supabase = getSupabase();
      const { data: teacher } = await supabase.from('teachers').select('id').eq('user_id', user!.id).single();

      // Create session
      const { data: session, error: sessionErr } = await supabase.from('class_sessions').insert({
        class_id: selectedClass, teacher_id: teacher?.id,
        session_date: today, start_time: new Date().toTimeString().slice(0, 8),
      }).select().single();

      if (sessionErr) throw sessionErr;

      // Insert attendances
      const records = Object.entries(attendance).map(([student_id, status]) => ({
        session_id: session.id, student_id, status,
        check_in_time: status === 'hadir' ? new Date().toTimeString().slice(0, 8) : null,
      }));

      const { error } = await supabase.from('attendances').insert(records);
      if (error) throw error;

      showToast('success', `Absensi ${students.length} santri berhasil disimpan!`);
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedClass, attendance, students, user, today]);

  const summary = {
    hadir: Object.values(attendance).filter(v => v === 'hadir').length,
    izin: Object.values(attendance).filter(v => v === 'izin').length,
    sakit: Object.values(attendance).filter(v => v === 'sakit').length,
    alpha: Object.values(attendance).filter(v => v === 'alpha').length,
  };

  return (
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 class="text-lg font-bold">Input Absensi</h2>
          <p class="text-sm text-gray-500">{formatDate(new Date(), 'EEEE, dd MMMM yyyy')}</p>
        </div>
        <Select value={selectedClass} onChange={setSelectedClass} placeholder="Pilih kelas..."
          options={classes.map(c => ({ value: c.id, label: c.name }))} />
      </div>

      {selectedClass && students.length > 0 && (
        <>
          {/* Summary */}
          <div class="grid grid-cols-4 gap-3">
            {STATUS_OPTIONS.map(s => (
              <div key={s.value} class={`text-center p-3 rounded-lg border ${s.color}`}>
                <p class="text-2xl font-bold">{summary[s.value]}</p>
                <p class="text-xs">{s.icon} {s.label}</p>
              </div>
            ))}
          </div>

          {/* Student Grid */}
          <Card title={`Daftar Santri (${students.length})`}>
            <div class="space-y-2">
              {students.map(student => (
                <div key={student.id} class="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50">
                  <Avatar name={student.name} src={student.photo_url} size="sm" />
                  <div class="flex-1 min-w-0">
                    <p class="font-medium text-sm truncate">{student.name}</p>
                    <p class="text-xs text-gray-400">{student.nis}</p>
                  </div>
                  <div class="flex gap-1">
                    {STATUS_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setAttendance(prev => ({ ...prev, [student.id]: opt.value }))}
                        class={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          attendance[student.id] === opt.value ? opt.color + ' border-current' : 'bg-gray-50 text-gray-400 border-gray-200'
                        }`}
                      >
                        {opt.icon}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div class="flex justify-end">
            <Button onClick={handleSubmit} isLoading={isSubmitting} size="lg">
              💾 Simpan Absensi ({students.length} santri)
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
