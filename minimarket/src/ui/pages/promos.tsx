import { useState } from "preact/hooks";
import { promoService, promosSignal, vouchersSignal } from "@/logic/services/promo-service";
import { formatRupiah, formatDate } from "@/logic/utils/format";
import { showToast } from "@/ui/molecules/toast";
import { Icons } from "@/ui/atoms/icon";
import { Button } from "@/ui/atoms/button";
import { Input, Select } from "@/ui/atoms/input";
import { Badge } from "@/ui/atoms/badge";

export function PromosPage() {
  const [tab, setTab] = useState<"promos"|"vouchers">("promos");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name:"", type:"percent" as any, discountValue:0, discountType:"percent" as any, minPurchase:0, maxDiscount:0, startDate:"", endDate:"", active:true });
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [vForm, setVForm] = useState({ code:"", promoId:"", discountValue:0, discountType:"percent" as any, minPurchase:0, maxDiscount:0, expiresAt:"" });

  const promos = promosSignal.value;
  const vouchers = vouchersSignal.value;
  const f = (k: string, v: any) => setForm(p => ({...p, [k]:v}));

  const handleSavePromo = () => {
    if (!form.name || !form.startDate || !form.endDate) { showToast("Isi semua field wajib", "error"); return; }
    promoService.add(form);
    showToast("Promo ditambahkan", "success");
    setShowModal(false);
  };

  const handleSaveVoucher = () => {
    if (!vForm.code || !vForm.expiresAt) { showToast("Isi kode dan tanggal kadaluarsa", "error"); return; }
    promoService.addVoucher(vForm);
    showToast("Voucher ditambahkan", "success");
    setShowVoucherModal(false);
  };

  return (
    <div class="space-y-5">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-black text-gray-900 dark:text-gray-100">Diskon & Promo</h2>
        <Button onClick={() => tab==="promos" ? setShowModal(true) : setShowVoucherModal(true)} icon={<Icons.Plus size={16} />}>
          {tab==="promos" ? "Tambah Promo" : "Tambah Voucher"}
        </Button>
      </div>

      <div class="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        <button onClick={() => setTab("promos")} class={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab==="promos"?"bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100":"text-gray-500"}`}>Promo ({promos.length})</button>
        <button onClick={() => setTab("vouchers")} class={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab==="vouchers"?"bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100":"text-gray-500"}`}>Voucher ({vouchers.length})</button>
      </div>

      {tab === "promos" && (
        <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div class="divide-y divide-gray-50 dark:divide-gray-700">
            {promos.map(p => (
              <div key={p.id} class="p-4 flex items-center justify-between">
                <div>
                  <p class="font-semibold text-gray-900 dark:text-gray-100">{p.name}</p>
                  <p class="text-xs text-gray-400">
                    {p.discountType==="percent" ? `${p.discountValue}%` : formatRupiah(p.discountValue)} off ·
                    Min: {formatRupiah(p.minPurchase)}
                  </p>
                  <p class="text-xs text-gray-400">{formatDate(p.startDate)} - {formatDate(p.endDate)}</p>
                </div>
                <div class="text-right">
                  <Badge color={p.active ? "green" : "gray"}>{p.active ? "Aktif" : "Nonaktif"}</Badge>
                  <p class="text-xs text-gray-400 mt-1">Digunakan: {p.usageCount}x</p>
                  <div class="flex gap-1 mt-1 justify-end">
                    <button onClick={() => promoService.update(p.id, {active:!p.active})} class="px-2 py-0.5 text-[10px] rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600">
                      {p.active ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                    <button onClick={() => promoService.delete(p.id)} class="p-1 text-gray-400 hover:text-red-500"><Icons.Trash size={13} /></button>
                  </div>
                </div>
              </div>
            ))}
            {promos.length === 0 && <div class="p-10 text-center text-gray-400">Belum ada promo</div>}
          </div>
        </div>
      )}

      {tab === "vouchers" && (
        <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div class="divide-y divide-gray-50 dark:divide-gray-700">
            {vouchers.map(v => (
              <div key={v.id} class="p-4 flex items-center justify-between">
                <div>
                  <p class="font-bold text-gray-900 dark:text-gray-100 font-mono text-lg">{v.code}</p>
                  <p class="text-xs text-gray-400">
                    {v.discountType==="percent" ? `${v.discountValue}%` : formatRupiah(v.discountValue)} off ·
                    Min: {formatRupiah(v.minPurchase)}
                  </p>
                  <p class="text-xs text-gray-400">Berlaku sampai: {formatDate(v.expiresAt)}</p>
                </div>
                <Badge color={v.used ? "red" : "green"}>{v.used ? "Terpakai" : "Tersedia"}</Badge>
              </div>
            ))}
            {vouchers.length === 0 && <div class="p-10 text-center text-gray-400">Belum ada voucher</div>}
          </div>
        </div>
      )}

      {/* Promo modal */}
      {showModal && (
        <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-bold text-gray-900 dark:text-gray-100">Tambah Promo</h3>
              <button onClick={() => setShowModal(false)} class="text-gray-400 hover:text-gray-600"><Icons.X size={20} /></button>
            </div>
            <div class="space-y-3">
              <Input label="Nama Promo *" value={form.name} onInput={(e: any) => f("name", e.target.value)} />
              <Select label="Tipe Diskon" value={form.discountType} onChange={(e: any) => f("discountType", e.target.value)} options={[{value:"percent",label:"Persen (%)"},{value:"amount",label:"Nominal (Rp)"}]} />
              <Input label="Nilai Diskon" type="number" value={form.discountValue.toString()} onInput={(e: any) => f("discountValue", parseFloat(e.target.value)||0)} />
              <Input label="Min Pembelian (Rp)" type="number" value={form.minPurchase.toString()} onInput={(e: any) => f("minPurchase", parseInt(e.target.value)||0)} />
              <div class="grid grid-cols-2 gap-3">
                <Input label="Tgl Mulai" type="date" value={form.startDate} onInput={(e: any) => f("startDate", e.target.value)} />
                <Input label="Tgl Akhir" type="date" value={form.endDate} onInput={(e: any) => f("endDate", e.target.value)} />
              </div>
            </div>
            <div class="flex gap-3 mt-6">
              <Button variant="secondary" fullWidth onClick={() => setShowModal(false)}>Batal</Button>
              <Button fullWidth onClick={handleSavePromo}>Tambah</Button>
            </div>
          </div>
        </div>
      )}

      {/* Voucher modal */}
      {showVoucherModal && (
        <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-bold text-gray-900 dark:text-gray-100">Tambah Voucher</h3>
              <button onClick={() => setShowVoucherModal(false)} class="text-gray-400 hover:text-gray-600"><Icons.X size={20} /></button>
            </div>
            <div class="space-y-3">
              <Input label="Kode Voucher *" value={vForm.code} onInput={(e: any) => setVForm(v => ({...v, code:e.target.value.toUpperCase()}))} placeholder="HEMAT20" />
              <Select label="Tipe Diskon" value={vForm.discountType} onChange={(e: any) => setVForm(v => ({...v, discountType:e.target.value}))} options={[{value:"percent",label:"Persen"},{value:"amount",label:"Nominal"}]} />
              <Input label="Nilai Diskon" type="number" value={vForm.discountValue.toString()} onInput={(e: any) => setVForm(v => ({...v, discountValue:parseFloat(e.target.value)||0}))} />
              <Input label="Min Pembelian" type="number" value={vForm.minPurchase.toString()} onInput={(e: any) => setVForm(v => ({...v, minPurchase:parseInt(e.target.value)||0}))} />
              <Input label="Berlaku Sampai *" type="date" value={vForm.expiresAt} onInput={(e: any) => setVForm(v => ({...v, expiresAt:e.target.value}))} />
            </div>
            <div class="flex gap-3 mt-6">
              <Button variant="secondary" fullWidth onClick={() => setShowVoucherModal(false)}>Batal</Button>
              <Button fullWidth onClick={handleSaveVoucher}>Tambah</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
