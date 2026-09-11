import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { Card, DataTable, Button, Modal, Badge, showToast } from '@shared/index';
import type { Column } from '@shared/atoms/Table';
import type { CurriculumCategory, CurriculumMaterial } from '@shared/types';
import { useCurriculum } from '../logic/useCurriculum';
import { CurriculumForm } from '../components/CurriculumForm';

export function Curriculum() {
  const { categories, materials, isLoading, search, setSearch, selectedCategory, setSelectedCategory,
    addCategory, addMaterial, updateMaterial } = useCurriculum();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CurriculumMaterial | null>(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  const columns: Column<CurriculumMaterial>[] = [
    { key: 'title', label: 'Judul Materi', render: (row) => <span class="font-medium">{row.title}</span> },
    { key: 'category_name', label: 'Kategori' },
    { key: 'level', label: 'Level', render: (row) => row.level ? <Badge label={row.level} /> : '-' },
    { key: 'duration_minutes', label: 'Durasi', render: (row) => row.duration_minutes ? `${row.duration_minutes} menit` : '-' },
    { key: 'is_active', label: 'Status', align: 'center', render: (row) => (
      <Badge label={row.is_active ? 'Aktif' : 'Draft'} color={row.is_active ? 'text-green-600 bg-green-100' : 'text-gray-600 bg-gray-100'} />
    )},
  ];

  return (
    <div class="space-y-6">
      {/* Categories */}
      <div class="flex gap-2 flex-wrap">
        <Button variant={!selectedCategory ? 'primary' : 'outline'} size="sm" onClick={() => setSelectedCategory(null)}>Semua</Button>
        {categories.map(cat => (
          <Button key={cat.id} variant={selectedCategory === cat.id ? 'primary' : 'outline'} size="sm"
            onClick={() => setSelectedCategory(cat.id)}>
            {cat.name}
          </Button>
        ))}
        <Button variant="ghost" size="sm" onClick={() => setShowCategoryForm(true)}>+ Kategori</Button>
      </div>

      <DataTable title="Materi Kurikulum" columns={columns} data={materials} isLoading={isLoading}
        searchValue={search} onSearch={setSearch}
        onAdd={() => { setEditing(null); setShowForm(true); }} addLabel="Tambah Materi"
        onRowClick={(row) => { setEditing(row); setShowForm(true); }} rowKey={(r) => r.id}
      />

      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setEditing(null); }}
        title={editing ? 'Edit Materi' : 'Tambah Materi'} size="lg">
        <CurriculumForm categories={categories} initialData={editing || undefined}
          onSubmit={async (data) => {
            if (editing) await updateMaterial(editing.id, data);
            else await addMaterial(data);
            setShowForm(false); setEditing(null);
            showToast('success', 'Materi berhasil disimpan');
          }}
          onCancel={() => { setShowForm(false); setEditing(null); }} />
      </Modal>
    </div>
  );
}
