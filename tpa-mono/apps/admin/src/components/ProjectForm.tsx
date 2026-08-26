import { h } from 'preact';
import { useState } from 'preact/hooks';
import { Input, Select, Textarea, Button } from '@shared/index';
import type { Project, ProjectFormData } from '@shared/types';

interface Props { initialData?: Project; onSubmit: (data: ProjectFormData) => Promise<void>; onCancel: () => void; }

export function ProjectForm({ initialData, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<Partial<ProjectFormData>>({
    title: initialData?.title || '', description: initialData?.description || '',
    status: initialData?.status || 'planned', priority: initialData?.priority || 'medium',
    start_date: initialData?.start_date || '', due_date: initialData?.due_date || '',
    budget: initialData?.budget,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const u = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <form onSubmit={async (e) => { e.preventDefault(); setIsSubmitting(true); try { await onSubmit(form as ProjectFormData); } finally { setIsSubmitting(false); }}} class="space-y-4">
      <Input label="Judul Proyek" value={form.title} onInput={(e: any) => u('title', e.target.value)} required />
      <Textarea label="Deskripsi" value={form.description} onInput={(e: any) => u('description', e.target.value)} />
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select label="Status" value={form.status} onChange={(v) => u('status', v)}
          options={[{value:'planned',label:'Direncanakan'},{value:'in_progress',label:'Berjalan'},{value:'completed',label:'Selesai'},{value:'cancelled',label:'Dibatalkan'}]} />
        <Select label="Prioritas" value={form.priority} onChange={(v) => u('priority', v)}
          options={[{value:'low',label:'Rendah'},{value:'medium',label:'Sedang'},{value:'high',label:'Tinggi'},{value:'urgent',label:'Urgent'}]} />
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input label="Tanggal Mulai" type="date" value={form.start_date} onInput={(e: any) => u('start_date', e.target.value)} />
        <Input label="Deadline" type="date" value={form.due_date} onInput={(e: any) => u('due_date', e.target.value)} />
        <Input label="Anggaran" type="number" value={form.budget?.toString()} onInput={(e: any) => u('budget', parseFloat(e.target.value))} hint="Dalam Rupiah" />
      </div>
      <div class="flex justify-end gap-3 pt-4 border-t">
        <Button variant="ghost" onClick={onCancel} type="button">Batal</Button>
        <Button type="submit" isLoading={isSubmitting}>Simpan</Button>
      </div>
    </form>
  );
}
