import { useState } from "preact/hooks";
import { supplierService, suppliersSignal, purchaseOrdersSignal } from "@/logic/services/supplier-service";
import { productsSignal } from "@/logic/services/product-service";
import { formatRupiah, formatDate } from "@/logic/utils/format";
import { showToast } from "@/ui/molecules/toast";
import { showConfirm } from "@/ui/molecules/confirm-dialog";
import { Icons } from "@/ui/atoms/icon";
import { Button } from "@/ui/atoms/button";
import { Input } from "@/ui/atoms/input";
import { Badge } from "@/ui/atoms/badge";
import type { Supplier } from "@/data/types/supplier";

export function SuppliersPage() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"suppliers"|"po">("suppliers");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ name:"", contact:"", phone:"", email:"", address:"", active:true });

  const suppliers = supplierService.search(search);
  const pos = purchaseOrdersSignal.value;

  const openAdd = () => { setForm({name:"",contact:"",phone:"",email:"",address:"",active:true}); setEditing(null); setShowModal(true); };
  const openEdit = (s: Supplier) => { setForm({name:s.name,contact:s.contact,phone:s.phone,email:s.email||"",address:s.address||"",active:s.active}); setEditing(s); setShowModal(true); };

  const handleSave = () => {
    if (!form.name || !form.phone) { showToast("Nama dan telepon wajib diisi", "error"); return; }
    if (editing) { supplierService.update(editing.id, form); showToast("Supplier diperbarui", "success"); }
    else { supplierService.add(form); showToast("Supplier ditambahkan", "success"); }
    setShowModal(false);
  };

  const handleDelete = (s: Supplier) => {
    showConfirm({ title:"Hapus Supplier", message:`Hapus "${s.name}"?`, danger:true, confirmLabel:"Hapus",
      onConfirm: () => { supplierService.delete(s.id); showToast("Supplier dihapus", "success"); }
    });
  };

  const poStatusColors: Record<string, string> = {
    draft:"gray", approved:"blue", ordered:"orange", received:"green"
  };
  const poStatusLabels: Record<string, string> = {
    draft:"Draft", approved:"Disetujui", ordered:"Dipesan", received:"Diterima"
  };

  return (
    <div class="space-y-5">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-black text-gray-900 dark:text-gray-100">Supplier</h2>
        <Button onClick={openAdd} icon={<Icons.Plus size={16} />}>Tambah Supplier</Button>
      </div>

      <div class="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        <button onClick={() => setTab("suppliers")} class={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab==="suppliers"?"bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100":"text-gray-500"}`}>Supplier ({suppliers.length})</button>
        <button onClick={() => setTab("po")} class={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab==="po"?"bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100":"text-gray-500"}`}>Purchase Order ({pos.length})</button>
      </div>

      {tab === "suppliers" && (
        <>
          <Input value={search} onInput={(e: any) => setSearch(e.target.value)} placeholder="Cari supplier..." icon={<Icons.Search size={14} />} />
          <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div class="divide-y divide-gray-50 dark:divide-gray-700">
              {suppliers.map(s => (
                <div key={s.id} class="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm flex-shrink-0">
                      {s.name.slice(0,2).toUpperCase()}
                    </div>
                    <div>
                      <p class="font-semibold text-gray-900 dark:text-gray-100">{s.name}</p>
                      <p class="text-xs text-gray-400">{s.contact} · {s.phone}</p>
                      {s.email && <p class="text-xs text-gray-400">{s.email}</p>}
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <Badge color={s.active ? "green" : "gray"}>{s.active ? "Aktif" : "Nonaktif"}</Badge>
                    <button onClick={() => openEdit(s)} class="p-1.5 rounded-lg text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"><Icons.Edit size={15} /></button>
                    <button onClick={() => handleDelete(s)} class="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><Icons.Trash size={15} /></button>
                  </div>
                </div>
              ))}
              {suppliers.length === 0 && <div class="p-10 text-center text-gray-400">Tidak ada supplier</div>}
            </div>
          </div>
        </>
      )}

      {tab === "po" && (
        <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div class="divide-y divide-gray-50 dark:divide-gray-700">
            {pos.length === 0 ? (
              <div class="p-10 text-center text-gray-400">Belum ada purchase order</div>
            ) : pos.map(po => (
              <div key={po.id} class="p-4 flex items-center justify-between">
                <div>
                  <p class="font-semibold text-gray-900 dark:text-gray-100">{po.poNumber}</p>
                  <p class="text-xs text-gray-400">{po.supplierName} · {formatDate(po.createdAt)}</p>
                  <p class="text-xs text-gray-400">{po.items.length} item</p>
                </div>
                <div class="text-right">
                  <Badge color={poStatusColors[po.status] as any}>{poStatusLabels[po.status]}</Badge>
                  <p class="font-bold text-gray-900 dark:text-gray-100 mt-1">{formatRupiah(po.total)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-bold text-gray-900 dark:text-gray-100">{editing ? "Edit Supplier" : "Tambah Supplier"}</h3>
              <button onClick={() => setShowModal(false)} class="text-gray-400 hover:text-gray-600"><Icons.X size={20} /></button>
            </div>
            <div class="space-y-3">
              <Input label="Nama Supplier *" value={form.name} onInput={(e: any) => setForm(f => ({...f, name:e.target.value}))} />
              <Input label="Nama Kontak" value={form.contact} onInput={(e: any) => setForm(f => ({...f, contact:e.target.value}))} />
              <Input label="Telepon *" value={form.phone} onInput={(e: any) => setForm(f => ({...f, phone:e.target.value}))} />
              <Input label="Email" type="email" value={form.email} onInput={(e: any) => setForm(f => ({...f, email:e.target.value}))} />
              <Input label="Alamat" value={form.address} onInput={(e: any) => setForm(f => ({...f, address:e.target.value}))} />
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
