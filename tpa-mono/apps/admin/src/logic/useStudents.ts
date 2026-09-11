import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import { getSupabase } from '@shared/db/supabase';
import { useAuth } from '@shared/hooks/useAuth';
import type { Student } from '@shared/types';

const PAGE_SIZE = 20;

export function useStudents() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const locationId = user?.location_id;

  const loadStudents = useCallback(async () => {
    if (!locationId) return;
    setIsLoading(true);
    const supabase = getSupabase();
    let query = supabase.from('students').select('*', { count: 'exact' })
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, count, error } = await query;
    if (!error) {
      setStudents((data || []) as Student[]);
      setTotal(count || 0);
    }
    setIsLoading(false);
  }, [locationId, search, page]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const addStudent = useCallback(async (data: any) => {
    const supabase = getSupabase();
    const { error } = await supabase.from('students').insert({ ...data, location_id: locationId });
    if (error) throw error;
    await loadStudents();
  }, [locationId, loadStudents]);

  const updateStudent = useCallback(async (id: string, data: any) => {
    const supabase = getSupabase();
    const { error } = await supabase.from('students').update(data).eq('id', id);
    if (error) throw error;
    await loadStudents();
  }, [loadStudents]);

  const deleteStudent = useCallback(async (id: string) => {
    const supabase = getSupabase();
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) throw error;
    await loadStudents();
  }, [loadStudents]);

  const pagination = useMemo(() => ({
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
    onPageChange: setPage,
  }), [page, total]);

  return {
    students, isLoading, search, setSearch,
    addStudent, updateStudent, deleteStudent,
    pagination, reload: loadStudents,
  };
}
