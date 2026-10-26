import { useState } from "preact/hooks";
import { stockMovementsSignal, stockService } from "@/logic/services/stock-service";
import { productService, productsSignal } from "@/logic/services/product-service";
import { hasConcreteOutlet } from "@/logic/services/outlet-service";
import { formatRupiah, formatDateTime } from "@/logic/utils/format";
import { showToast } from "@/ui/molecules/toast";
import { Icons } from "@/ui/atoms/icon";
import { Button } from "@/ui/atoms/button";
import { Input, Select } from "@/ui/atoms/input";
import { Badge } from "@/ui/atoms/badge";

export function StockPage() {
  const [tab, setTab] = useState<"overview" | "history" | "opname">("overview");
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ productId: "", qty: 0, type: "adjustment" as any, notes: "" });
  const [movementDetail, setMovementDetail] = useState<any | null>(null);

  const openMovementDetail = (movement: any) => setMovementDetail(movement);
  const handleRowKeyDown = (event: KeyboardEvent, action: () => void) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); action(); }
  };

  const products = productsSignal.value;
  const movements = stockMovementsSignal.value;
  const lowStock = productService.getLowStock();

  /** Tipe yang mengeluarkan barang dari stok fisik — arahnya MINUS. */
  const OUT_TYPES = new Set(["stockout", "damaged", "expired"]);

  const handleAdjust = () => {
    if (!hasConcreteOutlet()) { showToast("Mode gabungan lihat-saja — pilih outlet spesifik", "error"); return; }
    if (!adjustForm.productId || adjustForm.qty <= 0) { showToast("Pilih produk dan masukkan jumlah (minimal 1)", "error"); return; }
    const product = productService.getById(adjustForm.productId);
    if (!product) return;
    // Arah mutasi ditentukan TIPE, bukan tanda angka input. Dulu hanya
    // "stockout" yang dinegasikan — "Rusak"/"Kadaluarsa" justru MENAMBAH stok
    // sementara riwayat mutasi menampilkannya minus.
    const delta = OUT_TYPES.has(adjustForm.type) ? -Math.abs(adjustForm.qty) : Math.abs(adjustForm.qty);
    productService.updateStock(adjustForm.productId, delta);
    stockService.addMovement({ productId: adjustForm.productId, productName: product.name, type: adjustForm.type, qty: Math.abs(adjustForm.qty), notes: adjustForm.notes });
    showToast("Stok berhasil disesuaikan", "success");
    setShowAdjust(false);
    setAdjustForm({ productId: "", qty: 0, type: "adjustment", notes: "" });
  };

  const movementTypeLabels: Record<string, string> = {
    purchase: "Pembelian", sale: "Penjualan", adjustment: "Penyesuaian", stockout: "Stok Keluar", damaged: "Rusak", expired: "Kadaluarsa", return: "Retur", initial: "Stok Awal"
  };
  const movementColors: Record<string, string> = {
    purchase: "green", sale: "orange", adjustment: "blue", stockout: "orange", damaged: "red", expired: "red", return: "purple", initial: "blue"
  };
  const OUT_MOVEMENT_TYPES = ["sale", "damaged", "expired", "stockout"];

  return (
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-black text-gray-900 dark:text-gray-100">Stok & Inventori</h2>
        <Button onClick={() => setShowAdjust(true)} icon={<Icons.RefreshCw size={16} />}>Sesuaikan Stok</Button>
      </div>

      {/* Summary cards */}
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3">
          <p class="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Total Produk</p>
          <p class="text-xl font-black text-gray-900 dark:text-gray-100 mt-0.5">{products.length}</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3">
          <p class="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Stok Menipis</p>
          <p class="text-xl font-black text-yellow-600 dark:text-yellow-400 mt-0.5">{lowStock.length}</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3">
          <p class="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Produk Habis</p>
          <p class="text-xl font-black text-red-600 dark:text-red-400 mt-0.5">{products.filter(p => p.stock === 0).length}</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3">
          <p class="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Nilai Stok</p>
          <p class="text-xs font-black text-green-600 dark:text-green-400 mt-0.5">{formatRupiah(products.reduce((s, p) => s + p.stock * p.buyPrice, 0))}</p>
        </div>
      </div>

      {/* Tabs */}
      <div class="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        {[{id:"overview",l:"Overview"},{id:"history",l:"Riwayat Mutasi"},{id:"opname",l:"Stok Opname"}].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} class={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab===t.id ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-500 dark:text-gray-400"}`}>{t.l}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <table class="w-full text-xs">
            <thead>
              <tr class="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                <th class="text-left p-3 text-xs font-semibold text-gray-500 uppercase">Produk</th>
                <th class="text-left p-3 text-xs font-semibold text-gray-500 uppercase">Stok</th>
                <th class="text-left p-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th class="text-left p-3 text-xs font-semibold text-gray-500 uppercase">Nilai Stok</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50 dark:divide-gray-700">
              {products.map(p => {
                const isLow = p.stock <= p.minStock;
                const isOut = p.stock === 0;
                return (
                  <tr key={p.id} class={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 ${isOut ? "bg-red-50/50 dark:bg-red-900/10" : isLow ? "bg-yellow-50/50 dark:bg-yellow-900/10" : ""}`} role="button" tabIndex={0} onClick={() => { setAdjustForm(f => ({ ...f, productId: p.id })); setShowAdjust(true); }} onKeyDown={(e) => handleRowKeyDown(e, () => { setAdjustForm(f => ({ ...f, productId: p.id })); setShowAdjust(true); })}>
                    <td class="p-3">
                      <p class="font-semibold text-gray-900 dark:text-gray-100">{p.name}</p>
                      <p class="text-xs text-gray-400">{p.sku}</p>
                    </td>
                    <td class="p-3 font-bold text-gray-900 dark:text-gray-100">{p.stock} {p.sellUnit}</td>
                    <td class="p-3"><Badge color={isOut ? "red" : isLow ? "yellow" : "green"}>{isOut ? "Habis" : isLow ? "Menipis" : "Normal"}</Badge></td>
                    <td class="p-3 text-gray-700 dark:text-gray-300">{formatRupiah(p.stock * p.buyPrice)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === "history" && (
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div class="divide-y divide-gray-50 dark:divide-gray-700">
            {movements.length === 0 ? (
              <div class="p-8 text-center text-gray-400">Belum ada riwayat mutasi</div>
            ) : movements.slice(0,50).map(m => (
              <div key={m.id} class="px-3 py-2.5 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30" role="button" tabIndex={0} onClick={() => openMovementDetail(m)} onKeyDown={(e) => handleRowKeyDown(e, () => openMovementDetail(m))}>
                <div>
                  <p class="text-xs font-medium text-gray-900 dark:text-gray-100">{m.productName}</p>
                  <p class="text-xs text-gray-400">{formatDateTime(m.createdAt)}</p>
                  {m.notes && <p class="text-xs text-gray-400 italic">{m.notes}</p>}
                </div>
                <div class="text-right">
                  <Badge color={movementColors[m.type] as any}>{movementTypeLabels[m.type] ?? m.type}</Badge>
                  <p class={`font-bold text-xs mt-0.5 ${OUT_MOVEMENT_TYPES.includes(m.type) ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                    {OUT_MOVEMENT_TYPES.includes(m.type) ? "-" : "+"}{m.qty}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "opname" && (
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 text-center text-gray-400">
          <Icons.RefreshCw size={32} class="mx-auto mb-2 opacity-30" />
          <p>Fitur Stok Opname dalam pengembangan</p>
        </div>
      )}

      {movementDetail && (
        <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="stock-movement-detail-title" onClick={() => setMovementDetail(null)}>
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <div class="flex items-center justify-between mb-4">
              <h3 id="stock-movement-detail-title" class="font-bold text-gray-900 dark:text-gray-100">Detail Mutasi Stok</h3>
              <button aria-label="Tutup detail mutasi" onClick={() => setMovementDetail(null)} class="text-gray-400 hover:text-gray-600"><Icons.X size={20} /></button>
            </div>
            <div class="space-y-2 text-xs">
              <div class="flex justify-between gap-3"><span class="text-gray-500">Produk</span><span class="font-semibold text-right text-gray-900 dark:text-gray-100">{movementDetail.productName}</span></div>
              <div class="flex justify-between gap-3"><span class="text-gray-500">Jenis</span><Badge color={movementColors[movementDetail.type] as any}>{movementTypeLabels[movementDetail.type] ?? movementDetail.type}</Badge></div>
              <div class="flex justify-between"><span class="text-gray-500">Jumlah</span><span class="font-semibold">{OUT_MOVEMENT_TYPES.includes(movementDetail.type) ? "-" : "+"}{movementDetail.qty}</span></div>
              <div class="flex justify-between gap-3"><span class="text-gray-500">Waktu</span><span class="text-right">{formatDateTime(movementDetail.createdAt)}</span></div>
              {movementDetail.notes && <div><p class="text-gray-500 mb-1">Catatan</p><p class="text-gray-700 dark:text-gray-300 italic">{movementDetail.notes}</p></div>}
            </div>
          </div>
        </div>
      )}

      {/* Adjust modal */}
      {showAdjust && (
        <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-5">
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-bold text-gray-900 dark:text-gray-100">Sesuaikan Stok</h3>
              <button onClick={() => setShowAdjust(false)} class="text-gray-400 hover:text-gray-600"><Icons.X size={20} /></button>
            </div>
            <div class="space-y-3">
              <Select label="Produk" value={adjustForm.productId} onChange={(e: any) => setAdjustForm(f => ({...f, productId: e.target.value}))} options={[{value:"",label:"Pilih produk..."}, ...products.map(p => ({value:p.id, label:p.name}))]} />
              <Select label="Tipe" value={adjustForm.type} onChange={(e: any) => setAdjustForm(f => ({...f, type:e.target.value}))} options={[{value:"purchase",label:"Stok Masuk (Pembelian)"},{value:"stockout",label:"Stok Keluar"},{value:"adjustment",label:"Penyesuaian"},{value:"damaged",label:"Barang Rusak"},{value:"expired",label:"Kadaluarsa"}]} />
              <Input label="Jumlah" type="number" value={adjustForm.qty.toString()} onInput={(e: any) => setAdjustForm(f => ({...f, qty: parseInt(e.target.value)||0}))} />
              <Input label="Catatan" value={adjustForm.notes} onInput={(e: any) => setAdjustForm(f => ({...f, notes:e.target.value}))} placeholder="Alasan penyesuaian..." />
            </div>
            <div class="flex gap-3 mt-5">
              <Button variant="secondary" fullWidth onClick={() => setShowAdjust(false)}>Batal</Button>
              <Button fullWidth onClick={handleAdjust}>Simpan</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
