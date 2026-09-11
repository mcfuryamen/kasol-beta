import { useState } from "preact/hooks";
import { stockMovementsSignal, stockService } from "@/logic/services/stock-service";
import { productService, productsSignal } from "@/logic/services/product-service";
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

  const products = productsSignal.value;
  const movements = stockMovementsSignal.value;
  const lowStock = productService.getLowStock();

  const handleAdjust = () => {
    if (!adjustForm.productId || adjustForm.qty === 0) { showToast("Pilih produk dan masukkan jumlah", "error"); return; }
    const product = productService.getById(adjustForm.productId);
    if (!product) return;
    const delta = adjustForm.type === "stockout" ? -adjustForm.qty : adjustForm.qty;
    productService.updateStock(adjustForm.productId, delta);
    stockService.addMovement({ productId: adjustForm.productId, productName: product.name, type: adjustForm.type, qty: Math.abs(adjustForm.qty), notes: adjustForm.notes });
    showToast("Stok berhasil disesuaikan", "success");
    setShowAdjust(false);
    setAdjustForm({ productId: "", qty: 0, type: "adjustment", notes: "" });
  };

  const movementTypeLabels: Record<string, string> = {
    purchase: "Pembelian", sale: "Penjualan", adjustment: "Penyesuaian", damaged: "Rusak", expired: "Kadaluarsa", return: "Retur"
  };
  const movementColors: Record<string, string> = {
    purchase: "green", sale: "orange", adjustment: "blue", damaged: "red", expired: "red", return: "purple"
  };

  return (
    <div class="space-y-5">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-black text-gray-900 dark:text-gray-100">Stok & Inventori</h2>
        <Button onClick={() => setShowAdjust(true)} icon={<Icons.RefreshCw size={16} />}>Sesuaikan Stok</Button>
      </div>

      {/* Summary cards */}
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <p class="text-sm text-gray-500 dark:text-gray-400">Total Produk</p>
          <p class="text-2xl font-black text-gray-900 dark:text-gray-100 mt-1">{products.length}</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <p class="text-sm text-gray-500 dark:text-gray-400">Stok Menipis</p>
          <p class="text-2xl font-black text-yellow-600 dark:text-yellow-400 mt-1">{lowStock.length}</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <p class="text-sm text-gray-500 dark:text-gray-400">Produk Habis</p>
          <p class="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{products.filter(p => p.stock === 0).length}</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <p class="text-sm text-gray-500 dark:text-gray-400">Nilai Stok</p>
          <p class="text-lg font-black text-green-600 dark:text-green-400 mt-1">{formatRupiah(products.reduce((s, p) => s + p.stock * p.buyPrice, 0))}</p>
        </div>
      </div>

      {/* Tabs */}
      <div class="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        {[{id:"overview",l:"Overview"},{id:"history",l:"Riwayat Mutasi"},{id:"opname",l:"Stok Opname"}].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} class={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab===t.id ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-500 dark:text-gray-400"}`}>{t.l}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                <th class="text-left p-4 text-xs font-semibold text-gray-500 uppercase">Produk</th>
                <th class="text-left p-4 text-xs font-semibold text-gray-500 uppercase">Stok</th>
                <th class="text-left p-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th class="text-left p-4 text-xs font-semibold text-gray-500 uppercase">Nilai Stok</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50 dark:divide-gray-700">
              {products.map(p => {
                const isLow = p.stock <= p.minStock;
                const isOut = p.stock === 0;
                return (
                  <tr key={p.id} class={`hover:bg-gray-50 dark:hover:bg-gray-700/30 ${isOut ? "bg-red-50/50 dark:bg-red-900/10" : isLow ? "bg-yellow-50/50 dark:bg-yellow-900/10" : ""}`}>
                    <td class="p-4">
                      <p class="font-semibold text-gray-900 dark:text-gray-100">{p.name}</p>
                      <p class="text-xs text-gray-400">{p.sku}</p>
                    </td>
                    <td class="p-4 font-bold text-gray-900 dark:text-gray-100">{p.stock} {p.sellUnit}</td>
                    <td class="p-4"><Badge color={isOut ? "red" : isLow ? "yellow" : "green"}>{isOut ? "Habis" : isLow ? "Menipis" : "Normal"}</Badge></td>
                    <td class="p-4 text-gray-700 dark:text-gray-300">{formatRupiah(p.stock * p.buyPrice)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === "history" && (
        <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div class="divide-y divide-gray-50 dark:divide-gray-700">
            {movements.length === 0 ? (
              <div class="p-10 text-center text-gray-400">Belum ada riwayat mutasi</div>
            ) : movements.slice(0,50).map(m => (
              <div key={m.id} class="p-4 flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{m.productName}</p>
                  <p class="text-xs text-gray-400">{formatDateTime(m.createdAt)}</p>
                  {m.notes && <p class="text-xs text-gray-400 italic">{m.notes}</p>}
                </div>
                <div class="text-right">
                  <Badge color={movementColors[m.type] as any}>{movementTypeLabels[m.type]}</Badge>
                  <p class={`font-bold text-sm mt-1 ${["sale","damaged","expired"].includes(m.type) ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                    {["sale","damaged","expired"].includes(m.type) ? "-" : "+"}{m.qty}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "opname" && (
        <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 text-center text-gray-400">
          <Icons.RefreshCw size={40} class="mx-auto mb-3 opacity-30" />
          <p>Fitur Stok Opname dalam pengembangan</p>
        </div>
      )}

      {/* Adjust modal */}
      {showAdjust && (
        <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-bold text-gray-900 dark:text-gray-100">Sesuaikan Stok</h3>
              <button onClick={() => setShowAdjust(false)} class="text-gray-400 hover:text-gray-600"><Icons.X size={20} /></button>
            </div>
            <div class="space-y-4">
              <Select label="Produk" value={adjustForm.productId} onChange={(e: any) => setAdjustForm(f => ({...f, productId: e.target.value}))} options={[{value:"",label:"Pilih produk..."}, ...products.map(p => ({value:p.id, label:p.name}))]} />
              <Select label="Tipe" value={adjustForm.type} onChange={(e: any) => setAdjustForm(f => ({...f, type:e.target.value}))} options={[{value:"purchase",label:"Stok Masuk (Pembelian)"},{value:"stockout",label:"Stok Keluar"},{value:"adjustment",label:"Penyesuaian"},{value:"damaged",label:"Barang Rusak"},{value:"expired",label:"Kadaluarsa"}]} />
              <Input label="Jumlah" type="number" value={adjustForm.qty.toString()} onInput={(e: any) => setAdjustForm(f => ({...f, qty: parseInt(e.target.value)||0}))} />
              <Input label="Catatan" value={adjustForm.notes} onInput={(e: any) => setAdjustForm(f => ({...f, notes:e.target.value}))} placeholder="Alasan penyesuaian..." />
            </div>
            <div class="flex gap-3 mt-6">
              <Button variant="secondary" fullWidth onClick={() => setShowAdjust(false)}>Batal</Button>
              <Button fullWidth onClick={handleAdjust}>Simpan</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
