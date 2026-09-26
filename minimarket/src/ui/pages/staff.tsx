import { useState } from "preact/hooks";
import { authService, staffList } from "@/logic/services/auth-service";
import { showToast } from "@/ui/molecules/toast";
import { showConfirm } from "@/ui/molecules/confirm-dialog";
import { Icons } from "@/ui/atoms/icon";
import { Button } from "@/ui/atoms/button";
import { Input, Select } from "@/ui/atoms/input";
import { Avatar } from "@/ui/molecules/avatar";
import { RoleBadge } from "@/ui/molecules/role-badge";
import { Badge } from "@/ui/atoms/badge";
import type { User, UserRole } from "@/logic/services/auth-service";

export function StaffPage() {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({ name:"", email:"", role:"cashier" as UserRole, active:true });
  const staff = staffList.value;

  const openAdd = () => { setForm({name:"",email:"",role:"cashier",active:true}); setEditing(null); setShowModal(true); };
  const openEdit = (u: User) => { setForm({name:u.name,email:u.email,role:u.role,active:u.active}); setEditing(u); setShowModal(true); };

  const handleSave = () => {
    if (!form.name || !form.email) { showToast("Isi nama dan email", "error"); return; }
    if (editing) { authService.updateStaff(editing.id, form); showToast("Staf diperbarui", "success"); }
    else { authService.addStaff(form); showToast("Staf ditambahkan", "success"); }
    setShowModal(false);
  };

  const handleDelete = (u: User) => {
    showConfirm({ title:"Hapus Staf", message:`Hapus "${u.name}"?`, danger:true, confirmLabel:"Hapus",
      onConfirm: () => { authService.deleteStaff(u.id); showToast("Staf dihapus", "success"); }
    });
  };

  return (
    <div class="space-y-5">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-black text-gray-900 dark:text-gray-100">Manajemen Staf</h2>
        <Button onClick={openAdd} icon={<Icons.Plus size={16} />}>Tambah Staf</Button>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(["owner","manager","cashier","stock"] as UserRole[]).map(role => (
          <div key={role} class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 text-center">
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">{role === "owner" ? "Pemilik" : role === "manager" ? "Manager" : role === "cashier" ? "Kasir" : "Gudang"}</p>
            <p class="text-2xl font-black text-gray-900 dark:text-gray-100">{staff.filter(s=>s.role===role).length}</p>
          </div>
        ))}
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div class="divide-y divide-gray-50 dark:divide-gray-700">
          {staff.map(u => (
            <div key={u.id} class="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
              <div class="flex items-center gap-3">
                <Avatar name={u.name} size="md" />
                <div>
                  <p class="font-semibold text-gray-900 dark:text-gray-100">{u.name}</p>
                  <p class="text-xs text-gray-400">{u.email}</p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <RoleBadge role={u.role} />
                <Badge color={u.active ? "green" : "gray"}>{u.active ? "Aktif" : "Nonaktif"}</Badge>
                <button onClick={() => openEdit(u)} class="p-1.5 rounded-lg text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"><Icons.Edit size={15} /></button>
                <button onClick={() => handleDelete(u)} class="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><Icons.Trash size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-bold text-gray-900 dark:text-gray-100">{editing ? "Edit Staf" : "Tambah Staf"}</h3>
              <button onClick={() => setShowModal(false)} class="text-gray-400 hover:text-gray-600"><Icons.X size={20} /></button>
            </div>
            <div class="space-y-3">
              <Input label="Nama *" value={form.name} onInput={(e: any) => setForm(f => ({...f, name:e.target.value}))} />
              <Input label="Email *" type="email" value={form.email} onInput={(e: any) => setForm(f => ({...f, email:e.target.value}))} />
              <Select label="Role" value={form.role} onChange={(e: any) => setForm(f => ({...f, role:e.target.value as UserRole}))} options={[{value:"owner",label:"Pemilik"},{value:"manager",label:"Manager"},{value:"cashier",label:"Kasir"},{value:"stock",label:"Gudang"}]} />
              <Select label="Status" value={form.active.toString()} onChange={(e: any) => setForm(f => ({...f, active:e.target.value==="true"}))} options={[{value:"true",label:"Aktif"},{value:"false",label:"Nonaktif"}]} />
            </div>
            <div class="flex gap-3 mt-6">
              <Button variant="secondary" fullWidth onClick={() => setShowModal(false)}>Batal</Button>
              <Button fullWidth onClick={handleSave}>{editing ? "Simpan" : "Tambah"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
