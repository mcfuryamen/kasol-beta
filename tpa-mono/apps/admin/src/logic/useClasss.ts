import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import { getSupabase } from '@shared/db/supabase';
import { useAuth } from '@shared/hooks/useAuth';
import type { Class } from '@shared/types';

const PAGE_SIZE = 20;

export function useClasss() {
  const { user } = useAuth();
  const [classs, setClasss] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const locationId = user?.location_id;

  const loadClasss = useCallback(async () => {
    if (!locationId) return;
    setIsLoading(true);
    const supabase = getSupabase();
    let query = supabase.from('classes').select('*', { count: 'exact' })
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, count, error } = await query;
    if (!error) {
      setClasss((data || []) as Class[]);
      setTotal(count || 0);
    }
    setIsLoading(false);
  }, [locationId, search, page]);

  useEffect(() => { loadClasss(); }, [loadClasss]);

  const addClass = useCallback(async (data: any) => {
    const supabase = getSupabase();
    const { error } = await supabase.from('classes').insert({ ...data, location_id: locationId });
    if (error) throw error;
    await loadClasss();
  }, [locationId, loadClasss]);

  const updateClass = useCallback(async (id: string, data: any) => {
    const supabase = getSupabase();
    const { error } = await supabase.from('classes').update(data).eq('id', id);
    if (error) throw error;
    await loadClasss();
  }, [loadClasss]);

  const deleteClass = useCallback(async (id: string) => {
    const supabase = getSupabase();
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (error) throw error;
    await loadClasss();
  }, [loadClasss]);

  const pagination = useMemo(() => ({
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
    onPageChange: setPage,
  }), [page, total]);

  return {
    classs, isLoading, search, setSearch,
    addClass, updateClass, deleteClass,
    pagination, reload: loadClasss,
  };
}
