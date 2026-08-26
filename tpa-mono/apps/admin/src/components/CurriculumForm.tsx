import { h } from 'preact';
import { useState } from 'preact/hooks';
import { Input, Select, Textarea, Button } from '@shared/index';
import type { CurriculumCategory, CurriculumMaterial, CurriculumMaterialFormData } from '@shared/types';

interface Props {
  categories: CurriculumCategory[];
  initialData?: CurriculumMaterial;
  onSubmit: (data: CurriculumMaterialFormData) => Promise<void>;
  onCancel: () => void;
}

export function CurriculumForm({ categories, initialData, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<Partial<CurriculumMaterialFormData>>({
    category_id: initialData?.category_id || '',
    title: initialData?.title || '', description: initialData?.description || '',
    content: initialData?.content || '', level: initialData?.level || '',
    duration_minutes: initialData?.duration_minutes, is_active: initialData?.is_active ?? true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const u = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <form onSubmit={async (e) => { e.preventDefault(); setIsSubmitting(true); try { await onSubmit(form as CurriculumMaterialFormData); } finally { setIsSubmitting(false); }}} class="space-y-4">
      <Select label="Kategori" value={form.category_id} onChange={(v) => u('category_id', v)} required
        options={categories.map(c => ({ value: c.id, label: c.name }))} placeholder="Pilih kategori" />
      <Input label="Judul Materi" value={form.title} onInput={(e: any) => u('title', e.target.value)} required />
      <Textarea label="Deskripsi" value={form.description} onInput={(e: any) => u('description', e.target.value)} />
      <Textarea label="Konten Materi" value={form.content} onInput={(e: any) => u('content', e.target.value)} />
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select label="Level" value={form.level} onChange={(v) => u('level', v)}
          options={[{value:'beginner',label:'Pemula'},{value:'intermediate',label:'Menengah'},{value:'advanced',label:'Lanjutan'}]} placeholder="Pilih level" />
        <Input label="Durasi (menit)" type="number" value={form.duration_minutes?.toString()} onInput={(e: any) => u('duration_minutes', parseInt(e.target.value))} />
      </div>
      <div class="flex justify-end gap-3 pt-4 border-t">
        <Button variant="ghost" onClick={onCancel} type="button">Batal</Button>
        <Button type="submit" isLoading={isSubmitting}>Simpan</Button>
      </div>
    </form>
  );
}
