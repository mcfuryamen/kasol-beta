import { h } from 'preact';
import { useState } from 'preact/hooks';
import { Input, Select, Textarea, Button } from '@shared/index';
import type { Class, ClassFormData } from '@shared/types';

interface Props { initialData?: Class; onSubmit: (data: ClassFormData) => Promise<void>; onCancel: () => void; }

export function ClassForm({ initialData, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<Partial<ClassFormData>>({
    name: initialData?.name || '', level: initialData?.level || '',
    description: initialData?.description || '', max_students: initialData?.max_students || 30,
    room: initialData?.room || '', is_active: initialData?.is_active ?? true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const u = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <form onSubmit={async (e) => { e.preventDefault(); setIsSubmitting(true); try { await onSubmit(form as ClassFormData); } finally { setIsSubmitting(false); }}} class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Nama Kelas" value={form.name} onInput={(e: any) => u('name', e.target.value)} required />
        <Select label="Level" value={form.level} onChange={(v) => u('level', v)}
          options={[{value:'iqro_1',label:'Iqro 1'},{value:'iqro_2',label:'Iqro 2'},{value:'iqro_3',label:'Iqro 3'},
          {value:'iqro_4',label:'Iqro 4'},{value:'iqro_5',label:'Iqro 5'},{value:'iqro_6',label:'Iqro 6'},
          {value:'juz_amma',label:'Juz Amma'},{value:'al_quran',label:'Al-Quran'},{value:'tahfidz',label:'Tahfidz'}]} placeholder="Pilih level" />
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Ruangan" value={form.room} onInput={(e: any) => u('room', e.target.value)} />
        <Input label="Maks Santri" type="number" value={form.max_students?.toString()} onInput={(e: any) => u('max_students', parseInt(e.target.value))} />
      </div>
      <Textarea label="Deskripsi" value={form.description} onInput={(e: any) => u('description', e.target.value)} />
      <div class="flex justify-end gap-3 pt-4 border-t">
        <Button variant="ghost" onClick={onCancel} type="button">Batal</Button>
        <Button type="submit" isLoading={isSubmitting}>Simpan</Button>
      </div>
    </form>
  );
}
