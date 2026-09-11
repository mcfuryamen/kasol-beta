import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import { getSupabase } from '@shared/db/supabase';
import { useAuth } from '@shared/hooks/useAuth';
import type { CurriculumCategory, CurriculumMaterial } from '@shared/types';

export function useCurriculum() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<CurriculumCategory[]>([]);
  const [materials, setMaterials] = useState<CurriculumMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const locationId = user?.location_id;

  const loadData = useCallback(async () => {
    if (!locationId) return;
    setIsLoading(true);
    const supabase = getSupabase();

    const [catRes, matRes] = await Promise.all([
      supabase.from('curriculum_categories').select('*').eq('location_id', locationId).order('sort_order'),
      supabase.from('curriculum_materials').select('*, curriculum_categories(name)').order('sort_order'),
    ]);

    setCategories((catRes.data || []) as CurriculumCategory[]);

    let mats = (matRes.data || []).map((m: any) => ({
      ...m,
      category_name: m.curriculum_categories?.name,
    })) as CurriculumMaterial[];

    if (selectedCategory) {
      mats = mats.filter(m => m.category_id === selectedCategory);
    }
    if (search) {
      mats = mats.filter(m => m.title.toLowerCase().includes(search.toLowerCase()));
    }

    setMaterials(mats);
    setIsLoading(false);
  }, [locationId, selectedCategory, search]);

  useEffect(() => { loadData(); }, [loadData]);

  const addCategory = useCallback(async (data: { name: string; description?: string }) => {
    const supabase = getSupabase();
    await supabase.from('curriculum_categories').insert({ ...data, location_id: locationId });
    await loadData();
  }, [locationId, loadData]);

  const addMaterial = useCallback(async (data: any) => {
    const supabase = getSupabase();
    await supabase.from('curriculum_materials').insert(data);
    await loadData();
  }, [loadData]);

  const updateMaterial = useCallback(async (id: string, data: any) => {
    const supabase = getSupabase();
    await supabase.from('curriculum_materials').update(data).eq('id', id);
    await loadData();
  }, [loadData]);

  return {
    categories, materials, isLoading, search, setSearch,
    selectedCategory, setSelectedCategory,
    addCategory, addMaterial, updateMaterial,
    reload: loadData,
  };
}
