import { h } from 'preact';
import { useState, useCallback } from 'preact/hooks';
import { Input, Select, Textarea, Button } from '@shared/index';
import type { Teacher, TeacherFormData } from '@shared/types';

interface Props {
  initialData?: Teacher;
  onSubmit: (data: TeacherFormData) => Promise<void>;
  onCancel: () => void;
}

export function TeacherForm({ initialData, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<Partial<TeacherFormData>>({
    name: initialData?.name || '',
    nip: initialData?.nip || '',
    gender: initialData?.gender || 'L',
    phone: initialData?.phone || '',
    email: initialData?.email || '',
    address: initialData?.address || '',
    specialization: initialData?.specialization || '',
    join_date: initialData?.join_date || new Date().toISOString().split('T')[0],
    is_active: initialData?.is_active ?? true,
    notes: initialData?.notes || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const update = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <form onSubmit={async (e) => { e.preventDefault(); setIsSubmitting(true); try { await onSubmit(form as TeacherFormData); } finally { setIsSubmitting(false); }}} class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Nama Ustadz" value={form.name} onInput={(e: any) => update('name', e.target.value)} required />
        <Input label="NIP" value={form.nip} onInput={(e: any) => update('nip', e.target.value)} />
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Select label="Jenis Kelamin" value={form.gender} onChange={(v) => update('gender', v)} required
          options={[{ value: 'L', label: 'Laki-laki' }, { value: 'P', label: 'Perempuan' }]} />
        <Input label="Telepon" value={form.phone} onInput={(e: any) => update('phone', e.target.value)} />
        <Input label="Email" type="email" value={form.email} onInput={(e: any) => update('email', e.target.value)} />
      </div>
      <Input label="Spesialisasi" value={form.specialization} onInput={(e: any) => update('specialization', e.target.value)} hint="Hafalan, Iqro, Tajwid, dll" />
      <Textarea label="Alamat" value={form.address} onInput={(e: any) => update('address', e.target.value)} />
      <Input label="Tanggal Bergabung" type="date" value={form.join_date} onInput={(e: any) => update('join_date', e.target.value)} />
      <div class="flex justify-end gap-3 pt-4 border-t">
        <Button variant="ghost" onClick={onCancel} type="button">Batal</Button>
        <Button type="submit" isLoading={isSubmitting}>Simpan</Button>
      </div>
    </form>
  );
}
