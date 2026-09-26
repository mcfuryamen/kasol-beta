import { h } from 'preact';
import { useState, useCallback } from 'preact/hooks';
import { Input, Select, Textarea, Button } from '@shared/index';
import type { Student, StudentFormData } from '@shared/types';

interface StudentFormProps {
  initialData?: Student;
  onSubmit: (data: StudentFormData) => Promise<void>;
  onCancel: () => void;
}

export function StudentForm({ initialData, onSubmit, onCancel }: StudentFormProps) {
  const [form, setForm] = useState<Partial<StudentFormData>>({
    name: initialData?.name || '',
    nis: initialData?.nis || '',
    gender: initialData?.gender || 'L',
    birth_date: initialData?.birth_date || '',
    birth_place: initialData?.birth_place || '',
    address: initialData?.address || '',
    phone: initialData?.phone || '',
    join_date: initialData?.join_date || new Date().toISOString().split('T')[0],
    previous_education: initialData?.previous_education || '',
    health_notes: initialData?.health_notes || '',
    is_active: initialData?.is_active ?? true,
    notes: initialData?.notes || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = useCallback(async (e: Event) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(form as StudentFormData);
    } finally {
      setIsSubmitting(false);
    }
  }, [form, onSubmit]);

  return (
    <form onSubmit={handleSubmit} class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Nama Santri" value={form.name} onInput={(e: any) => update('name', e.target.value)} required />
        <Input label="NIS" value={form.nis} onInput={(e: any) => update('nis', e.target.value)} hint="Nomor Induk Santri" />
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Select label="Jenis Kelamin" value={form.gender} onChange={(v) => update('gender', v)} required
          options={[{ value: 'L', label: 'Laki-laki' }, { value: 'P', label: 'Perempuan' }]} />
        <Input label="Tempat Lahir" value={form.birth_place} onInput={(e: any) => update('birth_place', e.target.value)} />
        <Input label="Tanggal Lahir" type="date" value={form.birth_date} onInput={(e: any) => update('birth_date', e.target.value)} />
      </div>
      <Textarea label="Alamat" value={form.address} onInput={(e: any) => update('address', e.target.value)} />
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Telepon" value={form.phone} onInput={(e: any) => update('phone', e.target.value)} />
        <Input label="Tanggal Masuk" type="date" value={form.join_date} onInput={(e: any) => update('join_date', e.target.value)} />
      </div>
      <Input label="Pendidikan Sebelumnya" value={form.previous_education} onInput={(e: any) => update('previous_education', e.target.value)} />
      <Textarea label="Catatan Kesehatan" value={form.health_notes} onInput={(e: any) => update('health_notes', e.target.value)} />
      <Textarea label="Catatan" value={form.notes} onInput={(e: any) => update('notes', e.target.value)} />
      <div class="flex items-center gap-2">
        <input type="checkbox" id="is_active" checked={form.is_active} onChange={(e: any) => update('is_active', e.target.checked)} />
        <label htmlFor="is_active" class="text-sm">Aktif</label>
      </div>
      <div class="flex justify-end gap-3 pt-4 border-t">
        <Button variant="ghost" onClick={onCancel} type="button">Batal</Button>
        <Button type="submit" isLoading={isSubmitting}>Simpan</Button>
      </div>
    </form>
  );
}
