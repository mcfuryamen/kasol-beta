import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import { getSupabase } from '@shared/db/supabase';
import { useAuth } from '@shared/hooks/useAuth';
import type { Guardian } from '@shared/types';

const PAGE_SIZE = 20;

export function useGuardians() {
  const { user } = useAuth();
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const locationId = user?.location_id;

  const loadGuardians = useCallback(async () => {
    if (!locationId) return;
    setIsLoading(true);
    const supabase = getSupabase();
    let query = supabase.from('guardians').select('*', { count: 'exact' })
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, count, error } = await query;
    if (!error) {
      setGuardians((data || []) as Guardian[]);
      setTotal(count || 0);
    }
    setIsLoading(false);
  }, [locationId, search, page]);

  useEffect(() => { loadGuardians(); }, [loadGuardians]);

  const addGuardian = useCallback(async (data: any) => {
    const supabase = getSupabase();
    const { error } = await supabase.from('guardians').insert({ ...data, location_id: locationId });
    if (error) throw error;
    await loadGuardians();
  }, [locationId, loadGuardians]);

  const updateGuardian = useCallback(async (id: string, data: any) => {
    const supabase = getSupabase();
    const { error } = await supabase.from('guardians').update(data).eq('id', id);
    if (error) throw error;
    await loadGuardians();
  }, [loadGuardians]);

  const deleteGuardian = useCallback(async (id: string) => {
    const supabase = getSupabase();
    const { error } = await supabase.from('guardians').delete().eq('id', id);
    if (error) throw error;
    await loadGuardians();
  }, [loadGuardians]);

  const pagination = useMemo(() => ({
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
    onPageChange: setPage,
  }), [page, total]);

  return {
    guardians, isLoading, search, setSearch,
    addGuardian, updateGuardian, deleteGuardian,
    pagination, reload: loadGuardians,
  };
}
