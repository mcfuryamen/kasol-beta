import { useState } from "preact/hooks";
import { customerService, customersSignal } from "@/logic/services/customer-service";
import { formatRupiah, formatDate } from "@/logic/utils/format";
import { showToast } from "@/ui/molecules/toast";
import { showConfirm } from "@/ui/molecules/confirm-dialog";
import { Icons } from "@/ui/atoms/icon";
import { Button } from "@/ui/atoms/button";
import { Input } from "@/ui/atoms/input";
import { Badge } from "@/ui/atoms/badge";
import type { Customer } from "@/data/types/customer";

export function CustomersPage() {
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name:"", phone:"", email:"", address:"", points:0, totalSpent:0, debt:0, tier:"bronze" as any, active:true });

  const customers = customerService.search(search);

  const openAdd = () => { setForm({name:"",phone:"",email:"",address:"",points:0,totalSpent:0,debt:0,tier:"bronze",active:true}); setEditing(null); setShowModal(true); };
  const openEdit = (c: Customer) => { setForm({name:c.name,phone:c.phone,email:c.email||"",address:c.address||"",points:c.points,totalSpent:c.totalSpent,debt:c.debt,tier:c.tier,active:c.active}); setEditing(c); setShowModal(true); };

  const handleSave = () => {
    if (!form.name || !form.phone) { showToast("Nama dan telepon wajib diisi", "error"); return; }
    if (editing) { customerService.update(editing.id, form); showToast("Pelanggan diperbarui", "success"); }
    else { customerService.add(form); showToast("Pelanggan ditambahkan", "success"); }
    setShowModal(false);
  };

  const handleDelete = (c: Customer) => {
    showConfirm({ title:"Hapus Pelanggan", message:`Hapus "${c.name}"?`, danger:true, confirmLabel:"Hapus",
      onConfirm: () => { customerService.delete(c.id); showToast("Pelanggan dihapus", "success"); }
    });
  };

  const tierColors: Record<string, string> = { gold:"yellow", silver:"gray", bronze:"orange" };

  return (
    <div class="space-y-5">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-black text-gray-900 dark:text-gray-100">Pelanggan & Member</h2>
        <Button onClick={openAdd} icon={<Icons.Plus size={16} />}>Tambah Pelanggan</Button>
      </div>

      {/* Summary */}
      <div class="grid grid-cols-3 gap-4">
        <div class="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800 p-4">
          <p class="text-sm text-yellow-700 dark:text-yellow-400">Gold Member</p>
          <p class="text-2xl font-black text-yellow-700 dark:text-yellow-400">{customers.filter(c=>c.tier==="gold").length}</p>
        </div>
        <div class="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p class="text-sm text-gray-500 dark:text-gray-400">Silver Member</p>
          <p class="text-2xl font-black text-gray-700 dark:text-gray-300">{customers.filter(c=>c.tier==="silver").length}</p>
        </div>
        <div class="bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800 p-4">
          <p class="text-sm text-orange-700 dark:text-orange-400">Bronze Member</p>
          <p class="text-2xl font-black text-orange-700 dark:text-orange-400">{customers.filter(c=>c.tier==="bronze").length}</p>
        </div>
      </div>

      <Input value={search} onInput={(e: any) => setSearch(e.target.value)} placeholder="Cari nama, telepon, kartu member..." icon={<Icons.Search size={14} />} />

      <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div class="divide-y divide-gray-50 dark:divide-gray-700">
          {customers.map(c => (
            <div key={c.id} class="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
              <div class="flex items-center gap-3">
                <div class={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${c.tier==="gold"?"bg-yellow-500":c.tier==="silver"?"bg-gray-400":"bg-orange-500"}`}>
                  {c.name.split(" ").map((n: string)=>n[0]).join("").slice(0,2)}
                </div>
                <div>
                  <p class="font-semibold text-gray-900 dark:text-gray-100">{c.name}</p>
                  <p class="text-xs text-gray-400">{c.phone} · {c.memberCard}</p>
                  {c.debt > 0 && <p class="text-xs text-red-500 font-medium">Piutang: {formatRupiah(c.debt)}</p>}
                </div>
              </div>
              <div class="flex items-center gap-3">
                <div class="text-right">
                  <Badge color={tierColors[c.tier] as any}>{c.tier}</Badge>
                  <p class="text-xs text-gray-400 mt-0.5">{c.points} poin</p>
                  <p class="text-xs text-gray-400">{formatRupiah(c.totalSpent)}</p>
                </div>
                <div class="flex gap-1">
                  <button onClick={() => openEdit(c)} class="p-1.5 rounded-lg text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"><Icons.Edit size={15} /></button>
                  <button onClick={() => handleDelete(c)} class="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><Icons.Trash size={15} /></button>
                </div>
              </div>
            </div>
          ))}
          {customers.length === 0 && <div class="p-10 text-center text-gray-400">Tidak ada pelanggan ditemukan</div>}
        </div>
      </div>

      {showModal && (
        <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-bold text-gray-900 dark:text-gray-100">{editing ? "Edit Pelanggan" : "Tambah Pelanggan"}</h3>
              <button onClick={() => setShowModal(false)} class="text-gray-400 hover:text-gray-600"><Icons.X size={20} /></button>
            </div>
            <div class="space-y-3">
              <Input label="Nama *" value={form.name} onInput={(e: any) => setForm(f => ({...f, name:e.target.value}))} />
              <Input label="Telepon *" value={form.phone} onInput={(e: any) => setForm(f => ({...f, phone:e.target.value}))} />
              <Input label="Email" type="email" value={form.email} onInput={(e: any) => setForm(f => ({...f, email:e.target.value}))} />
              <Input label="Alamat" value={form.address} onInput={(e: any) => setForm(f => ({...f, address:e.target.value}))} />
              {editing && <Input label="Poin" type="number" value={form.points.toString()} onInput={(e: any) => setForm(f => ({...f, points:parseInt(e.target.value)||0}))} />}
            </div>
            <div class="flex gap-3 mt-6">
              <Button variant="secondary" fullWidth onClick={() => setShowModal(false)}>Batal</Button>
              <Button fullWidth onClick={handleSave}>Simpan</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
