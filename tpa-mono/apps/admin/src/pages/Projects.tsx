import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { Card, DataTable, Button, Modal, Badge, showToast, Select } from '@shared/index';
import { getStatusColor } from '@shared/utils/format';
import { formatDate } from '@shared/utils/date';
import type { Column } from '@shared/atoms/Table';
import type { Project, ProjectTask } from '@shared/types';
import { useProjects } from '../logic/useProjects';
import { ProjectForm } from '../components/ProjectForm';

export function Projects() {
  const { projects, isLoading, search, setSearch, addProject, updateProject, pagination } = useProjects();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  const columns: Column<Project>[] = [
    { key: 'title', label: 'Judul Proyek', render: (row) => (
      <div>
        <p class="font-medium">{row.title}</p>
        {row.description && <p class="text-xs text-gray-400 truncate max-w-[200px]">{row.description}</p>}
      </div>
    )},
    { key: 'status', label: 'Status', render: (row) => <Badge label={row.status.replace('_', ' ')} color={getStatusColor(row.status)} /> },
    { key: 'priority', label: 'Prioritas', render: (row) => <Badge label={row.priority} color={getStatusColor(row.priority === 'urgent' ? 'overdue' : row.priority === 'high' ? 'partial' : 'pending')} /> },
    { key: 'due_date', label: 'Deadline', render: (row) => row.due_date ? formatDate(row.due_date) : '-' },
    { key: 'tasks', label: 'Tugas', align: 'center', render: (row) => `${row.completed_tasks || 0}/${row.task_count || 0}` },
    { key: 'assigned_name', label: 'PJ' },
  ];

  const handleSave = useCallback(async (data: any) => {
    try {
      if (editing) { await updateProject(editing.id, data); showToast('success', 'Proyek diperbarui'); }
      else { await addProject(data); showToast('success', 'Proyek ditambahkan'); }
      setShowForm(false); setEditing(null);
    } catch (err: any) { showToast('error', err.message); }
  }, [editing]);

  return (
    <div class="space-y-4">
      <DataTable title="Proyek Pengembangan TPA" columns={columns} data={projects} isLoading={isLoading}
        searchValue={search} onSearch={setSearch}
        onAdd={() => { setEditing(null); setShowForm(true); }} addLabel="Tambah Proyek"
        onRowClick={(row) => { setEditing(row); setShowForm(true); }} rowKey={(r) => r.id} pagination={pagination}
      />
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setEditing(null); }} title={editing ? 'Edit Proyek' : 'Tambah Proyek'} size="lg">
        <ProjectForm initialData={editing || undefined} onSubmit={handleSave} onCancel={() => { setShowForm(false); setEditing(null); }} />
      </Modal>
    </div>
  );
}
