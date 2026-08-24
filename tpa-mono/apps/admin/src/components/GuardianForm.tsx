import { h } from 'preact';
import { useState } from 'preact/hooks';
import { Input, Select, Textarea, Button } from '@shared/index';
import type { Guardian, GuardianFormData } from '@shared/types';

interface Props { initialData?: Guardian; onSubmit: (data: GuardianFormData) => Promise<void>; onCancel: () => void; }

export function GuardianForm({ initialData, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<Partial<GuardianFormData>>({
    name: initialData?.name || '', relation: initialData?.relation || 'ayah',
    phone: initialData?.phone || '', email: initialData?.email || '',
    address: initialData?.address || '', occupation: initialData?.occupation || '',
    is_active: initialData?.is_active ?? true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const u = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <form onSubmit={async (e) => { e.preventDefault(); setIsSubmitting(true); try { await onSubmit(form as GuardianFormData); } finally { setIsSubmitting(false); }}} class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Nama Wali" value={form.name} onInput={(e: any) => u('name', e.target.value)} required />
        <Select label="Hubungan" value={form.relation} onChange={(v) => u('relation', v)}
          options={[{value:'ayah',label:'Ayah'},{value:'ibu',label:'Ibu'},{value:'kakek',label:'Kakek'},{value:'nenek',label:'Nenek'},{value:'paman',label:'Paman'},{value:'bibi',label:'Bibi'},{value:'wali',label:'Wali Lainnya'}]} />
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Telepon" value={form.phone} onInput={(e: any) => u('phone', e.target.value)} />
        <Input label="Email" type="email" value={form.email} onInput={(e: any) => u('email', e.target.value)} />
      </div>
      <Input label="Pekerjaan" value={form.occupation} onInput={(e: any) => u('occupation', e.target.value)} />
      <Textarea label="Alamat" value={form.address} onInput={(e: any) => u('address', e.target.value)} />
      <div class="flex justify-end gap-3 pt-4 border-t">
        <Button variant="ghost" onClick={onCancel} type="button">Batal</Button>
        <Button type="submit" isLoading={isSubmitting}>Simpan</Button>
      </div>
    </form>
  );
}
