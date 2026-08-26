import { h } from 'preact';
import { useState, useCallback } from 'preact/hooks';
import { DataTable, Button, Modal, Badge, Avatar, showToast } from '@shared/index';
import { getStatusColor } from '@shared/utils/format';
import type { Column } from '@shared/atoms/Table';
import type { Student } from '@shared/types';
import { useStudents } from '../logic/useStudents';
import { StudentForm } from '../components/StudentForm';

export function Students() {
  const { students, isLoading, search, setSearch, addStudent, updateStudent, deleteStudent, pagination } = useStudents();
  const [showForm, setShowForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const columns: Column<Student>[] = [
    { key: 'photo', label: '', width: '50px', render: (row) => <Avatar name={row.name} src={row.photo_url} size="sm" /> },
    { key: 'nis', label: 'NIS', width: '100px' },
    { key: 'name', label: 'Nama', render: (row) => <span class="font-medium">{row.name}</span> },
    { key: 'gender', label: 'JK', width: '60px', align: 'center', render: (row) => row.gender === 'L' ? '👦' : '👧' },
    { key: 'guardian_name', label: 'Wali' },
    { key: 'class_names', label: 'Kelas', render: (row) => (
      <div class="flex gap-1 flex-wrap">
        {(row.class_names || []).map(c => <Badge key={c} label={c} color="text-orange-600 bg-orange-50" />)}
      </div>
    )},
    { key: 'is_active', label: 'Status', align: 'center', render: (row) => (
      <Badge label={row.is_active ? 'Aktif' : 'Nonaktif'} color={row.is_active ? 'text-green-600 bg-green-100' : 'text-gray-600 bg-gray-100'} />
    )},
    { key: 'actions', label: '', width: '80px', render: (row) => (
      <div class="flex gap-1">
        <Button variant="ghost" size="sm" onClick={(e: Event) => { e.stopPropagation(); setEditingStudent(row); setShowForm(true); }}>✏️</Button>
      </div>
    )},
  ];

  const handleSave = useCallback(async (data: any) => {
    try {
      if (editingStudent) {
        await updateStudent(editingStudent.id, data);
        showToast('success', 'Data santri berhasil diperbarui');
      } else {
        await addStudent(data);
        showToast('success', 'Santri baru berhasil ditambahkan');
      }
      setShowForm(false);
      setEditingStudent(null);
    } catch (err: any) {
      showToast('error', err.message);
    }
  }, [editingStudent, addStudent, updateStudent]);

  return (
    <div class="space-y-4">
      <DataTable
        title="Data Santri"
        columns={columns}
        data={students}
        isLoading={isLoading}
        searchValue={search}
        onSearch={setSearch}
        onAdd={() => { setEditingStudent(null); setShowForm(true); }}
        addLabel="Tambah Santri"
        onRowClick={(row) => { setEditingStudent(row); setShowForm(true); }}
        rowKey={(row) => row.id}
        pagination={pagination}
      />

      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditingStudent(null); }}
        title={editingStudent ? 'Edit Santri' : 'Tambah Santri Baru'}
        size="lg"
      >
        <StudentForm
          initialData={editingStudent || undefined}
          onSubmit={handleSave}
          onCancel={() => { setShowForm(false); setEditingStudent(null); }}
        />
      </Modal>
    </div>
  );
}
