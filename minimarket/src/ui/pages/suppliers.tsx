import { useState } from "preact/hooks";
import { supplierService, suppliersSignal, purchaseOrdersSignal } from "@/logic/services/supplier-service";
import { productsSignal } from "@/logic/services/product-service";
import { hasConcreteOutlet } from "@/logic/services/outlet-service";
import { formatRupiah, formatDate } from "@/logic/utils/format";
import { showToast } from "@/ui/molecules/toast";
import { showConfirm } from "@/ui/molecules/confirm-dialog";
import { Icons } from "@/ui/atoms/icon";
import { Button } from "@/ui/atoms/button";
import { Input, Select } from "@/ui/atoms/input";
import { Badge } from "@/ui/atoms/badge";
import type { Supplier, PurchaseOrder, PurchaseOrderItem } from "@/data/types/supplier";

interface PoItemDraft { productId: string; qty: number; unitPrice: number; }

export function SuppliersPage() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"suppliers"|"po">("suppliers");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ name:"", contact:"", phone:"", email:"", address:"", active:true });

  // State form Purchase Order
  const [showPoModal, setShowPoModal] = useState(false);
  const [poDetail, setPoDetail] = useState<PurchaseOrder | null>(null);
  const [poSupplierId, setPoSupplierId] = useState("");
  const [poNotes, setPoNotes] = useState("");
  const [poItems, setPoItems] = useState<PoItemDraft[]>([]);
  const [poProduct, setPoProduct] = useState("");
  const [poQty, setPoQty] = useState(1);
  const [poPrice, setPoPrice] = useState(0);

  const suppliers = supplierService.search(search);
  const allSuppliers = suppliersSignal.value;
  const activeProducts = productsSignal.value.filter(p => p.active);
  const pos = purchaseOrdersSignal.value;
  const poTotal = poItems.reduce((s, i) => s + i.qty * i.unitPrice, 0);

  const openAdd = () => { setForm({name:"",contact:"",phone:"",email:"",address:"",active:true}); setEditing(null); setShowModal(true); };
  const openEdit = (s: Supplier) => { setForm({name:s.name,contact:s.contact,phone:s.phone,email:s.email||"",address:s.address||"",active:s.active}); setEditing(s); setShowModal(true); };

  const handleSave = () => {
    if (!hasConcreteOutlet()) { showToast("Mode gabungan lihat-saja — pilih outlet spesifik", "error"); return; }
    if (!form.name || !form.phone) { showToast("Nama dan telepon wajib diisi", "error"); return; }
    if (editing) { supplierService.update(editing.id, form); showToast("Supplier diperbarui", "success"); }
    else { supplierService.add(form); showToast("Supplier ditambahkan", "success"); }
    setShowModal(false);
  };

  const handleDelete = (s: Supplier) => {
    if (!hasConcreteOutlet()) { showToast("Mode gabungan lihat-saja — pilih outlet spesifik", "error"); return; }
    showConfirm({ title:"Hapus Supplier", message:`Hapus "${s.name}"?`, danger:true, confirmLabel:"Hapus",
      onConfirm: () => { supplierService.delete(s.id); showToast("Supplier dihapus", "success"); }
    });
  };

  // ── Purchase Order ────────────────────────────────────────────────────────
  const openPoModal = () => {
    setPoSupplierId(""); setPoNotes(""); setPoItems([]); setPoProduct(""); setPoQty(1); setPoPrice(0);
    setShowPoModal(true);
  };

  const addPoItem = () => {
    const product = activeProducts.find(p => p.id === poProduct);
    if (!product) { showToast("Pilih produk dulu", "error"); return; }
    if (poQty <= 0) { showToast("Jumlah minimal 1", "error"); return; }
    if (poPrice < 0) { showToast("Harga tidak boleh minus", "error"); return; }
    setPoItems(items => {
      const existing = items.find(i => i.productId === product.id);
      if (existing) return items.map(i => (i.productId === product.id ? { ...i, qty: i.qty + poQty, unitPrice: poPrice } : i));
      return [...items, { productId: product.id, qty: poQty, unitPrice: poPrice }];
    });
    setPoProduct(""); setPoQty(1); setPoPrice(0);
  };

  const removePoItem = (productId: string) => {
    setPoItems(items => items.filter(i => i.productId !== productId));
  };

  const savePo = () => {
    if (!hasConcreteOutlet()) { showToast("Mode gabungan lihat-saja — pilih outlet spesifik", "error"); return; }
    const supplier = allSuppliers.find(s => s.id === poSupplierId);
    if (!supplier) { showToast("Pilih supplier", "error"); return; }
    if (poItems.length === 0) { showToast("Tambahkan minimal 1 item", "error"); return; }
    const items: PurchaseOrderItem[] = poItems.map(i => {
      const product = activeProducts.find(p => p.id === i.productId)!;
      return { productId: product.id, productName: product.name, qty: i.qty, unit: product.sellUnit, unitPrice: i.unitPrice, subtotal: i.qty * i.unitPrice };
    });
    void supplierService.createPO({
      supplierId: supplier.id, supplierName: supplier.name,
      items, total: items.reduce((s, i) => s + i.subtotal, 0),
      status: "ordered", notes: poNotes.trim() || undefined
    });
    showToast("PO dibuat — status: Dipesan", "success");
    setShowPoModal(false);
  };

  const receivePo = (po: PurchaseOrder) => {
    if (!hasConcreteOutlet()) { showToast("Mode gabungan lihat-saja — pilih outlet spesifik", "error"); return; }
    showConfirm({
      title: "Terima Barang PO",
      message: `Terima ${po.poNumber} dari ${po.supplierName}? Stok produk akan bertambah otomatis sesuai item PO.`,
      confirmLabel: "Terima",
      onConfirm: () => {
        const r = supplierService.receivePO(po.id);
        showToast(r.message, r.ok ? "success" : "warning");
      }
    });
  };

  const poStatusColors: Record<string, string> = {
    draft:"gray", approved:"blue", ordered:"orange", received:"green"
  };
  const poStatusLabels: Record<string, string> = {
    draft:"Draft", approved:"Disetujui", ordered:"Dipesan", received:"Diterima"
  };

  return (
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-black text-gray-900 dark:text-gray-100">Supplier</h2>
        <Button onClick={openAdd} icon={<Icons.Plus size={16} />}>Tambah Supplier</Button>
      </div>

      <div class="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        <button onClick={() => setTab("suppliers")} class={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab==="suppliers"?"bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100":"text-gray-500"}`}>Supplier ({suppliers.length})</button>
        <button onClick={() => setTab("po")} class={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab==="po"?"bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100":"text-gray-500"}`}>Purchase Order ({pos.length})</button>
      </div>

      {tab === "suppliers" && (
        <>
          <Input value={search} onInput={(e: any) => setSearch(e.target.value)} placeholder="Cari supplier..." icon={<Icons.Search size={14} />} />
          <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div class="divide-y divide-gray-50 dark:divide-gray-700">
              {suppliers.map(s => (
                <div key={s.id} role="button" tabIndex={0} onClick={() => openEdit(s)} onKeyDown={(e: any) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEdit(s); } }} class="px-3 py-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer">
                  <div class="flex items-center gap-2.5">
                    <div class="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs flex-shrink-0">
                      {s.name.slice(0,2).toUpperCase()}
                    </div>
                    <div>
                      <p class="font-semibold text-xs text-gray-900 dark:text-gray-100">{s.name}</p>
                      <p class="text-xs text-gray-400">{s.contact} · {s.phone}</p>
                      {s.email && <p class="text-xs text-gray-400">{s.email}</p>}
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <Badge color={s.active ? "green" : "gray"}>{s.active ? "Aktif" : "Nonaktif"}</Badge>
                    <button onClick={(e) => { e.stopPropagation(); openEdit(s); }} onKeyDown={(e: any) => e.stopPropagation()} class="p-1.5 rounded-lg text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"><Icons.Edit size={15} /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(s); }} onKeyDown={(e: any) => e.stopPropagation()} class="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><Icons.Trash size={15} /></button>
                  </div>
                </div>
              ))}
              {suppliers.length === 0 && <div class="p-8 text-center text-gray-400">Tidak ada supplier</div>}
            </div>
          </div>
        </>
      )}

      {tab === "po" && (
        <>
          <div class="flex items-center justify-between gap-2">
            <p class="text-xs text-gray-500 dark:text-gray-400">PO yang diterima otomatis menambah stok produk.</p>
            <Button onClick={openPoModal} disabled={allSuppliers.length === 0 || activeProducts.length === 0} icon={<Icons.Plus size={16} />}>Buat PO</Button>
          </div>
          <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div class="divide-y divide-gray-50 dark:divide-gray-700">
              {pos.length === 0 ? (
                <div class="p-8 text-center text-gray-400">Belum ada purchase order</div>
              ) : pos.map(po => (
                <div key={po.id} role="button" tabIndex={0} onClick={() => setPoDetail(po)} onKeyDown={(e: any) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPoDetail(po); } }} class="px-3 py-2.5 flex items-center justify-between gap-2 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer">
                  <div class="min-w-0">
                    <p class="font-semibold text-xs text-gray-900 dark:text-gray-100">{po.poNumber}</p>
                    <p class="text-xs text-gray-400">{po.supplierName} · {formatDate(po.createdAt)}</p>
                    <p class="text-xs text-gray-400 truncate">{po.items.map(i => `${i.productName}×${i.qty}`).join(", ")}</p>
                    {po.notes && <p class="text-xs text-gray-400 italic truncate">{po.notes}</p>}
                  </div>
                  <div class="text-right flex-shrink-0">
                    <Badge color={poStatusColors[po.status] as any}>{poStatusLabels[po.status]}</Badge>
                    <p class="font-bold text-xs text-gray-900 dark:text-gray-100 mt-0.5">{formatRupiah(po.total)}</p>
                    {po.status !== "received" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); receivePo(po); }}
                        class="mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors text-xs font-semibold"
                      >
                        <Icons.Check size={13} /> Terima
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {allSuppliers.length === 0 && <p class="text-xs text-gray-400 text-center">Tambahkan supplier dulu untuk membuat PO.</p>}
        </>
      )}

      {showModal && (
        <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-5">
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
            <div class="flex gap-3 mt-5">
              <Button variant="secondary" fullWidth onClick={() => setShowModal(false)}>Batal</Button>
              <Button fullWidth onClick={handleSave}>Simpan</Button>
            </div>
          </div>
        </div>
      )}

      {poDetail && (
        <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPoDetail(null)}>
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="po-detail-title" onClick={(e) => e.stopPropagation()}>
            <div class="flex items-center justify-between mb-4">
              <h3 id="po-detail-title" class="font-bold text-gray-900 dark:text-gray-100">Detail Purchase Order</h3>
              <button onClick={() => setPoDetail(null)} class="text-gray-400 hover:text-gray-600"><Icons.X size={20} /></button>
            </div>
            <div class="space-y-2 text-xs">
              <p class="font-semibold text-gray-900 dark:text-gray-100">{poDetail.poNumber}</p>
              <p class="text-gray-500">{poDetail.supplierName} · {formatDate(poDetail.createdAt)}</p>
              <Badge color={poStatusColors[poDetail.status] as any}>{poStatusLabels[poDetail.status]}</Badge>
              <div class="border-t border-gray-100 dark:border-gray-700 pt-2 space-y-2">
                {poDetail.items.map(i => <div key={i.productId} class="flex justify-between gap-3"><span>{i.productName} × {i.qty} {i.unit}</span><span class="font-semibold">{formatRupiah(i.subtotal)}</span></div>)}
              </div>
              {poDetail.notes && <p class="text-gray-500 italic">Catatan: {poDetail.notes}</p>}
              <div class="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2 font-bold"><span>TOTAL</span><span>{formatRupiah(poDetail.total)}</span></div>
            </div>
            <div class="mt-5"><Button variant="secondary" fullWidth onClick={() => setPoDetail(null)}>Tutup</Button></div>
          </div>
        </div>
      )}

      {showPoModal && (
        <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-bold text-gray-900 dark:text-gray-100">Buat Purchase Order</h3>
              <button onClick={() => setShowPoModal(false)} class="text-gray-400 hover:text-gray-600"><Icons.X size={20} /></button>
            </div>
            <div class="space-y-3">
              <Select
                label="Supplier *"
                value={poSupplierId}
                onChange={(e: any) => setPoSupplierId(e.target.value)}
                options={[{ value: "", label: "Pilih supplier..." }, ...allSuppliers.map(s => ({ value: s.id, label: s.name }))]}
              />

              <div class="border border-gray-200 dark:border-gray-700 rounded-xl p-3 space-y-2">
                <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Item Pesanan</p>
                <div class="grid grid-cols-[1fr_64px_96px_auto] gap-1.5 items-end">
                  <Select
                    label="Produk"
                    value={poProduct}
                    onChange={(e: any) => {
                      const id = e.target.value;
                      setPoProduct(id);
                      const p = activeProducts.find(x => x.id === id);
                      if (p) setPoPrice(p.buyPrice);
                    }}
                    options={[{ value: "", label: "Pilih..." }, ...activeProducts.map(p => ({ value: p.id, label: p.name }))]}
                  />
                  <Input label="Qty" type="number" value={poQty.toString()} onInput={(e: any) => setPoQty(parseInt(e.target.value) || 0)} />
                  <Input label="Harga beli" type="number" value={poPrice.toString()} onInput={(e: any) => setPoPrice(parseInt(e.target.value) || 0)} />
                  <Button onClick={addPoItem} icon={<Icons.Plus size={14} />} class="flex-shrink-0" />
                </div>

                {poItems.length > 0 && (
                  <div class="divide-y divide-gray-100 dark:divide-gray-700 border-t border-gray-100 dark:border-gray-700 pt-1">
                    {poItems.map(i => {
                      const p = activeProducts.find(x => x.id === i.productId);
                      return (
                        <div key={i.productId} class="py-1.5 flex items-center justify-between gap-2 text-xs">
                          <div class="min-w-0">
                            <p class="font-medium text-gray-900 dark:text-gray-100 truncate">{p?.name ?? i.productId}</p>
                            <p class="text-gray-400">{i.qty} {p?.sellUnit ?? ""} × {formatRupiah(i.unitPrice)}</p>
                          </div>
                          <div class="flex items-center gap-2 flex-shrink-0">
                            <span class="font-semibold text-gray-700 dark:text-gray-300">{formatRupiah(i.qty * i.unitPrice)}</span>
                            <button onClick={() => removePoItem(i.productId)} class="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Icons.Trash size={13} /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div class="flex justify-between text-xs font-bold text-gray-900 dark:text-gray-100 border-t border-gray-200 dark:border-gray-700 pt-2">
                  <span>TOTAL</span><span>{formatRupiah(poTotal)}</span>
                </div>
              </div>

              <Input label="Catatan (opsional)" value={poNotes} onInput={(e: any) => setPoNotes(e.target.value)} placeholder="Contoh: pesan untuk restock mingguan" />
            </div>
            <div class="flex gap-3 mt-5">
              <Button variant="secondary" fullWidth onClick={() => setShowPoModal(false)}>Batal</Button>
              <Button fullWidth onClick={savePo}>Buat PO</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
