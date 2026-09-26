import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Card, Badge, Avatar, Button } from '@shared/index';
import { useAuth } from '@shared/hooks/useAuth';
import { getSupabase } from '@shared/db/supabase';

export function MyClasses() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);

  useEffect(() => { loadClasses(); }, [user]);

  const loadClasses = async () => {
    if (!user) return;
    const supabase = getSupabase();
    const { data: teacher } = await supabase.from('teachers').select('id').eq('user_id', user.id).single();
    if (!teacher) return;

    const { data: ct } = await supabase.from('class_teachers').select('class_id, is_primary, classes(*)').eq('teacher_id', teacher.id);
    setClasses((ct || []).map((c: any) => ({ ...c.classes, is_primary: c.is_primary })));
  };

  const loadStudents = async (classId: string) => {
    const supabase = getSupabase();
    const { data } = await supabase.from('class_students')
      .select('students(*)').eq('class_id', classId).eq('is_active', true);
    setStudents((data || []).map((d: any) => d.students));
  };

  return (
    <div class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes.map(cls => (
          <Card key={cls.id} className={`cursor-pointer transition-all ${selectedClass?.id === cls.id ? 'ring-2 ring-orange-500' : ''}`}>
            <div onClick={() => { setSelectedClass(cls); loadStudents(cls.id); }}>
              <div class="flex items-center gap-3 mb-3">
                <div class="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center text-2xl">🏫</div>
                <div>
                  <h3 class="font-semibold text-gray-800">{cls.name}</h3>
                  <p class="text-sm text-gray-500">{cls.level || 'Umum'}</p>
                </div>
              </div>
              <div class="flex gap-2">
                {cls.is_primary && <Badge label="Wali Kelas" color="text-orange-600 bg-orange-100" />}
                <Badge label={`Ruang: ${cls.room || '-'}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {selectedClass && (
        <Card title={`Santri - ${selectedClass.name}`} subtitle={`${students.length} santri terdaftar`}>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {students.map(s => (
              <div key={s.id} class="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                <Avatar name={s.name} src={s.photo_url} size="sm" />
                <div>
                  <p class="font-medium text-sm">{s.name}</p>
                  <p class="text-xs text-gray-400">NIS: {s.nis || '-'}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
