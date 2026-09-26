import { h } from 'preact';
import { useState, useCallback, useEffect } from 'preact/hooks';
import { Card, DataTable, Button, Modal, StatCard, showToast, Badge, Select } from '@shared/index';
import { getStatusColor, formatCurrency } from '@shared/utils/format';
import { formatDate } from '@shared/utils/date';
import { getSupabase } from '@shared/db/supabase';
import { useAuth } from '@shared/hooks/useAuth';

export function Iqro() {
  const { user } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Data will be loaded from Supabase
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold text-gray-800">Progres Iqro</h2>
          <p class="text-sm text-gray-500">Lihat progres Iqro semua santri</p>
        </div>
        <Button onClick={() => setShowForm(true)} leftIcon="+">Tambah</Button>
      </div>

      <Card>
        <div class="text-center py-12 text-gray-400">
          <span class="text-4xl block mb-3">📕</span>
          <p class="text-lg font-medium">Modul Progres Iqro</p>
          <p class="text-sm mt-1">Siap digunakan. Hubungkan dengan Supabase untuk memulai.</p>
        </div>
      </Card>
    </div>
  );
}
