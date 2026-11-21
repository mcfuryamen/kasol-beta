import { useState } from "preact/hooks";
import { authService, staffList } from "@/logic/services/auth-service";
import { isDemoMode } from "@/data/supabase";
import { showToast } from "@/ui/molecules/toast";
import { normalizeWhatsApp } from "@/logic/utils/phone";
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
  const [form, setForm] = useState({ name:"", phone:"", role:"cashier" as UserRole, active:true });
  const [password, setPassword] = useState("");
  const staff = staffList.value;

  const openAdd = () => { setForm({name:"",phone:"",role:"cashier",active:true}); setEditing(null); setPassword(""); setShowModal(true); };
  const openEdit = (u: User) => { setForm({name:u.name,phone:u.phone || "",role:u.role,active:u.active}); setEditing(u); setPassword(""); setShowModal(true); };

  const handleSave = async () => {
    const phone = normalizeWhatsApp(form.phone);
    if (!form.name || !phone) { showToast("Isi nama dan nomor WhatsApp yang valid", "error"); return; }
    const payload = { ...form, phone };
    if (editing) {
      const r = await authService.updateStaff(editing.id, payload);
      if (r.message) showToast(`Tersimpan di perangkat — gagal sinkron server: ${r.message}`, "warning");
      else showToast("Staf diperbarui", "success");
    } else {
      // Online: staf tanpa akun login tidak akan pernah bisa masuk — jangan
      // biarkan tombol Tambah memberi ilusi manajemen.
      if (!isDemoMode && !password) { showToast("Password wajib diisi agar staf bisa login", "error"); return; }
      if (!isDemoMode && password.length < 6) { showToast("Password minimal 6 karakter", "error"); return; }
      const r = await authService.addStaff({ ...payload, email: "", password: password || undefined });
      if (r.cloudOk && !r.message) showToast(isDemoMode ? "Staf ditambahkan" : "Staf ditambahkan — akun login dibuat", "success");
      else if (r.cloudOk && r.message) showToast(`Staf ditambahkan, tapi ${r.message}`, "warning");
      else if (isDemoMode) showToast("Staf ditambahkan (mode demo — lokal saja)", "success");
      else showToast(`Staf disimpan lokal dan TIDAK bisa login (${r.message ?? "tanpa akun"})`, "warning");
    }
    setShowModal(false);
  };

  const handleDelete = (u: User) => {
    const isCloudStaff = !isDemoMode && u.source === "cloud";
    showConfirm({
      title: isCloudStaff ? "Nonaktifkan Staf" : "Hapus Staf",
      message: isCloudStaff
        ? `Nonaktifkan akun "${u.name}"? Staf tidak akan bisa login lagi.`
        : `Hapus "${u.name}"?`,
      danger: true,
      confirmLabel: isCloudStaff ? "Nonaktifkan" : "Hapus",
      onConfirm: async () => {
        const r = await authService.deleteStaff(u.id);
        if (r.message) showToast(`Gagal: ${r.message}`, "error");
        else showToast(isCloudStaff ? "Staf dinonaktifkan" : "Staf dihapus", "success");
      }
    });
  };

  return (
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-black text-gray-900 dark:text-gray-100">Manajemen Staf</h2>
        <Button onClick={openAdd} icon={<Icons.Plus size={16} />}>Tambah Staf</Button>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["owner","manager","cashier","stock"] as UserRole[]).map(role => (
          <div key={role} class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3 text-center">
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{role === "owner" ? "Pemilik" : role === "manager" ? "Manager" : role === "cashier" ? "Kasir" : "Gudang"}</p>
            <p class="text-xl font-black text-gray-900 dark:text-gray-100">{staff.filter(s=>s.role===role).length}</p>
          </div>
        ))}
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div class="divide-y divide-gray-50 dark:divide-gray-700">
          {staff.map(u => (
            <div key={u.id} role="button" tabIndex={0} onClick={() => openEdit(u)} onKeyDown={(e: any) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEdit(u); } }} class="px-3 py-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer">
              <div class="flex items-center gap-2.5">
                <Avatar name={u.name} size="md" />
                <div>
                  <p class="font-semibold text-xs text-gray-900 dark:text-gray-100">{u.name}</p>
                  <p class="text-xs text-gray-400">{u.phone || u.email || "—"}</p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <RoleBadge role={u.role} />
                {!isDemoMode && u.source !== "cloud" && <Badge color="gray">Lokal</Badge>}
                <Badge color={u.active ? "green" : "gray"}>{u.active ? "Aktif" : "Nonaktif"}</Badge>
                <button onClick={(e: any) => { e.stopPropagation(); openEdit(u); }} class="p-1.5 rounded-lg text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"><Icons.Edit size={15} /></button>
                <button onClick={(e: any) => { e.stopPropagation(); handleDelete(u); }} class="p-1.5 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><Icons.Trash size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-5">
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-bold text-gray-900 dark:text-gray-100">{editing ? "Edit Staf" : "Tambah Staf"}</h3>
              <button onClick={() => setShowModal(false)} class="text-gray-400 hover:text-gray-600"><Icons.X size={20} /></button>
            </div>
            <div class="space-y-3">
              <Input label="Nama *" value={form.name} onInput={(e: any) => setForm(f => ({...f, name:e.target.value}))} />
              <Input
                label={editing && !isDemoMode && editing.source === "cloud" ? "WhatsApp (akun login, tidak bisa diubah)" : "Nomor WhatsApp *"}
                type="tel"
                value={form.phone}
                inputMode="tel"
                autoComplete="tel"
                placeholder="08xxxxxxxxxx"
                disabled={!!editing && !isDemoMode && editing.source === "cloud"}
                onInput={(e: any) => setForm(f => ({...f, phone:e.target.value}))}
              />
              {!editing && !isDemoMode && (
                <Input
                  label="Password Login *"
                  type="password"
                  value={password}
                  onInput={(e: any) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter — dipakai staf untuk masuk"
                />
              )}
              {!editing && isDemoMode && (
                <p class="text-xs text-gray-400 -mt-1">Mode demo: staf tersimpan lokal saja.</p>
              )}
              <Select label="Role" value={form.role} onChange={(e: any) => setForm(f => ({...f, role:e.target.value as UserRole}))} options={[{value:"owner",label:"Pemilik"},{value:"manager",label:"Manager"},{value:"cashier",label:"Kasir"},{value:"stock",label:"Gudang"}]} />
              <Select label="Status" value={form.active.toString()} onChange={(e: any) => setForm(f => ({...f, active:e.target.value==="true"}))} options={[{value:"true",label:"Aktif"},{value:"false",label:"Nonaktif"}]} />
            </div>
            <div class="flex gap-3 mt-5">
              <Button variant="secondary" fullWidth onClick={() => setShowModal(false)}>Batal</Button>
              <Button fullWidth onClick={handleSave}>{editing ? "Simpan" : "Tambah"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
