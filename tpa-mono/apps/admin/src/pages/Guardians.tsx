import { h } from 'preact';
import { useState, useCallback } from 'preact/hooks';
import { DataTable, Modal, Avatar, Badge, showToast } from '@shared/index';
import type { Column } from '@shared/atoms/Table';
import type { Guardian } from '@shared/types';
import { useGuardians } from '../logic/useGuardians';
import { GuardianForm } from '../components/GuardianForm';

export function Guardians() {
  const { guardians, isLoading, search, setSearch, addGuardian, updateGuardian, pagination } = useGuardians();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Guardian | null>(null);

  const columns: Column<Guardian>[] = [
    { key: 'photo', label: '', width: '50px', render: (row) => <Avatar name={row.name} src={row.photo_url} size="sm" /> },
    { key: 'name', label: 'Nama', render: (row) => <span class="font-medium">{row.name}</span> },
    { key: 'relation', label: 'Hubungan' },
    { key: 'phone', label: 'Telepon' },
    { key: 'children', label: 'Anak', render: (row) => (
      <div class="flex gap-1 flex-wrap">
        {(row.children || []).map(c => <Badge key={c.id} label={c.name} color="text-blue-600 bg-blue-50" />)}
      </div>
    )},
    { key: 'occupation', label: 'Pekerjaan' },
  ];

  const handleSave = useCallback(async (data: any) => {
    try {
      if (editing) { await updateGuardian(editing.id, data); showToast('success', 'Data wali diperbarui'); }
      else { await addGuardian(data); showToast('success', 'Wali ditambahkan'); }
      setShowForm(false); setEditing(null);
    } catch (err: any) { showToast('error', err.message); }
  }, [editing]);

  return (
    <div class="space-y-4">
      <DataTable title="Data Wali Santri" columns={columns} data={guardians} isLoading={isLoading}
        searchValue={search} onSearch={setSearch}
        onAdd={() => { setEditing(null); setShowForm(true); }} addLabel="Tambah Wali"
        onRowClick={(row) => { setEditing(row); setShowForm(true); }} rowKey={(r) => r.id} pagination={pagination}
      />
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setEditing(null); }} title={editing ? 'Edit Wali' : 'Tambah Wali'} size="lg">
        <GuardianForm initialData={editing || undefined} onSubmit={handleSave} onCancel={() => { setShowForm(false); setEditing(null); }} />
      </Modal>
    </div>
  );
}
