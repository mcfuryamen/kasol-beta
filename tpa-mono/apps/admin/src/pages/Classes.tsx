import { h } from 'preact';
import { useState, useCallback } from 'preact/hooks';
import { DataTable, Modal, Badge, showToast } from '@shared/index';
import type { Column } from '@shared/atoms/Table';
import type { Class } from '@shared/types';
import { useClasses } from '../logic/useClasses';
import { ClassForm } from '../components/ClassForm';

export function Classes() {
  const { classes, isLoading, search, setSearch, addClass, updateClass, pagination } = useClasses();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Class | null>(null);

  const columns: Column<Class>[] = [
    { key: 'name', label: 'Nama Kelas', render: (row) => <span class="font-medium">{row.name}</span> },
    { key: 'level', label: 'Level' },
    { key: 'room', label: 'Ruangan' },
    { key: 'teacher_names', label: 'Pengajar', render: (row) => (row.teacher_names || []).join(', ') },
    { key: 'student_count', label: 'Santri', align: 'center', render: (row) => `${row.student_count || 0}/${row.max_students}` },
    { key: 'is_active', label: 'Status', align: 'center', render: (row) => (
      <Badge label={row.is_active ? 'Aktif' : 'Nonaktif'} color={row.is_active ? 'text-green-600 bg-green-100' : 'text-gray-600 bg-gray-100'} />
    )},
  ];

  const handleSave = useCallback(async (data: any) => {
    try {
      if (editing) { await updateClass(editing.id, data); showToast('success', 'Kelas diperbarui'); }
      else { await addClass(data); showToast('success', 'Kelas ditambahkan'); }
      setShowForm(false); setEditing(null);
    } catch (err: any) { showToast('error', err.message); }
  }, [editing]);

  return (
    <div class="space-y-4">
      <DataTable title="Data Kelas" columns={columns} data={classes} isLoading={isLoading}
        searchValue={search} onSearch={setSearch}
        onAdd={() => { setEditing(null); setShowForm(true); }} addLabel="Tambah Kelas"
        onRowClick={(row) => { setEditing(row); setShowForm(true); }} rowKey={(r) => r.id} pagination={pagination}
      />
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setEditing(null); }} title={editing ? 'Edit Kelas' : 'Tambah Kelas'} size="lg">
        <ClassForm initialData={editing || undefined} onSubmit={handleSave} onCancel={() => { setShowForm(false); setEditing(null); }} />
      </Modal>
    </div>
  );
}
