import { h } from 'preact';
import { useState, useCallback } from 'preact/hooks';
import { DataTable, Modal, Avatar, Badge, showToast } from '@shared/index';
import type { Column } from '@shared/atoms/Table';
import type { Teacher } from '@shared/types';
import { useTeachers } from '../logic/useTeachers';
import { TeacherForm } from '../components/TeacherForm';

export function Teachers() {
  const { teachers, isLoading, search, setSearch, addTeacher, updateTeacher, pagination } = useTeachers();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);

  const columns: Column<Teacher>[] = [
    { key: 'photo', label: '', width: '50px', render: (row) => <Avatar name={row.name} src={row.photo_url} size="sm" /> },
    { key: 'nip', label: 'NIP' },
    { key: 'name', label: 'Nama', render: (row) => <span class="font-medium">{row.name}</span> },
    { key: 'gender', label: 'JK', width: '60px', align: 'center', render: (row) => row.gender === 'L' ? '👨' : '👩' },
    { key: 'specialization', label: 'Spesialisasi' },
    { key: 'phone', label: 'Telepon' },
    { key: 'is_active', label: 'Status', align: 'center', render: (row) => (
      <Badge label={row.is_active ? 'Aktif' : 'Nonaktif'} color={row.is_active ? 'text-green-600 bg-green-100' : 'text-gray-600 bg-gray-100'} />
    )},
  ];

  const handleSave = useCallback(async (data: any) => {
    try {
      if (editing) {
        await updateTeacher(editing.id, data);
        showToast('success', 'Data ustadz berhasil diperbarui');
      } else {
        await addTeacher(data);
        showToast('success', 'Ustadz baru berhasil ditambahkan');
      }
      setShowForm(false); setEditing(null);
    } catch (err: any) { showToast('error', err.message); }
  }, [editing]);

  return (
    <div class="space-y-4">
      <DataTable title="Data Ustadz/Pengajar" columns={columns} data={teachers} isLoading={isLoading}
        searchValue={search} onSearch={setSearch}
        onAdd={() => { setEditing(null); setShowForm(true); }} addLabel="Tambah Ustadz"
        onRowClick={(row) => { setEditing(row); setShowForm(true); }} rowKey={(r) => r.id} pagination={pagination}
      />
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setEditing(null); }} title={editing ? 'Edit Ustadz' : 'Tambah Ustadz'} size="lg">
        <TeacherForm initialData={editing || undefined} onSubmit={handleSave} onCancel={() => { setShowForm(false); setEditing(null); }} />
      </Modal>
    </div>
  );
}
