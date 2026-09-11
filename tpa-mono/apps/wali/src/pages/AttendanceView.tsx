import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Card, Badge, Button } from '@shared/index';
import { useAuth } from '@shared/hooks/useAuth';
import { getSupabase } from '@shared/db/supabase';

export function AttendanceView() {
  const { user } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const supabase = getSupabase();
      const { data: guardian } = await supabase.from('guardians').select('id').eq('user_id', user.id).single();
      if (!guardian) return;
      const { data: children } = await supabase.from('students').select('id').eq('guardian_id', guardian.id);
      // Load specific data based on children IDs
      setData(children || []);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div class="space-y-6">
      <Card title="Kehadiran">
        <div class="text-center py-12 text-gray-400">
          <span class="text-4xl block mb-3">✅</span>
          <p class="text-lg font-medium">Kehadiran</p>
          <p class="text-sm mt-1">Data akan ditampilkan setelah terhubung dengan Supabase</p>
        </div>
      </Card>
    </div>
  );
}
