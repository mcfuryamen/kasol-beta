import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import { getSupabase } from '@shared/db/supabase';
import { useAuth } from '@shared/hooks/useAuth';
import type { Teacher } from '@shared/types';

const PAGE_SIZE = 20;

export function useTeachers() {
  const { user } = useAuth();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const locationId = user?.location_id;

  const loadTeachers = useCallback(async () => {
    if (!locationId) return;
    setIsLoading(true);
    const supabase = getSupabase();
    let query = supabase.from('teachers').select('*', { count: 'exact' })
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, count, error } = await query;
    if (!error) {
      setTeachers((data || []) as Teacher[]);
      setTotal(count || 0);
    }
    setIsLoading(false);
  }, [locationId, search, page]);

  useEffect(() => { loadTeachers(); }, [loadTeachers]);

  const addTeacher = useCallback(async (data: any) => {
    const supabase = getSupabase();
    const { error } = await supabase.from('teachers').insert({ ...data, location_id: locationId });
    if (error) throw error;
    await loadTeachers();
  }, [locationId, loadTeachers]);

  const updateTeacher = useCallback(async (id: string, data: any) => {
    const supabase = getSupabase();
    const { error } = await supabase.from('teachers').update(data).eq('id', id);
    if (error) throw error;
    await loadTeachers();
  }, [loadTeachers]);

  const deleteTeacher = useCallback(async (id: string) => {
    const supabase = getSupabase();
    const { error } = await supabase.from('teachers').delete().eq('id', id);
    if (error) throw error;
    await loadTeachers();
  }, [loadTeachers]);

  const pagination = useMemo(() => ({
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
    onPageChange: setPage,
  }), [page, total]);

  return {
    teachers, isLoading, search, setSearch,
    addTeacher, updateTeacher, deleteTeacher,
    pagination, reload: loadTeachers,
  };
}
