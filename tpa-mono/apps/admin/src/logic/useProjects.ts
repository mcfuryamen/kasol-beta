import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import { getSupabase } from '@shared/db/supabase';
import { useAuth } from '@shared/hooks/useAuth';
import type { Project } from '@shared/types';

const PAGE_SIZE = 20;

export function useProjects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const locationId = user?.location_id;

  const loadProjects = useCallback(async () => {
    if (!locationId) return;
    setIsLoading(true);
    const supabase = getSupabase();
    let query = supabase.from('projects').select('*', { count: 'exact' })
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, count, error } = await query;
    if (!error) {
      setProjects((data || []) as Project[]);
      setTotal(count || 0);
    }
    setIsLoading(false);
  }, [locationId, search, page]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const addProject = useCallback(async (data: any) => {
    const supabase = getSupabase();
    const { error } = await supabase.from('projects').insert({ ...data, location_id: locationId });
    if (error) throw error;
    await loadProjects();
  }, [locationId, loadProjects]);

  const updateProject = useCallback(async (id: string, data: any) => {
    const supabase = getSupabase();
    const { error } = await supabase.from('projects').update(data).eq('id', id);
    if (error) throw error;
    await loadProjects();
  }, [loadProjects]);

  const deleteProject = useCallback(async (id: string) => {
    const supabase = getSupabase();
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw error;
    await loadProjects();
  }, [loadProjects]);

  const pagination = useMemo(() => ({
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
    onPageChange: setPage,
  }), [page, total]);

  return {
    projects, isLoading, search, setSearch,
    addProject, updateProject, deleteProject,
    pagination, reload: loadProjects,
  };
}
