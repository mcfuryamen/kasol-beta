import { useState } from "preact/hooks";
import { productsSignal, productService } from "@/logic/services/product-service";
import { formatRupiah, formatDate } from "@/logic/utils/format";
import { showToast } from "@/ui/molecules/toast";
import { showConfirm } from "@/ui/molecules/confirm-dialog";
import { Icons } from "@/ui/atoms/icon";
import { Button } from "@/ui/atoms/button";
import { Input, Select } from "@/ui/atoms/input";
import { Badge } from "@/ui/atoms/badge";
import type { Product, ProductCategory } from "@/data/types/product";

const CATEGORIES: { value: ProductCategory | ""; label: string }[] = [
  { value: "", label: "Semua Kategori" },
  { value: "snacks",     label: "Makanan Ringan" },
  { value: "beverages",  label: "Minuman" },
  { value: "staples",    label: "Sembako" },
  { value: "tobacco",    label: "Rokok" },
  { value: "toiletries", label: "Toiletries" },
  { value: "household",  label: "Rumah Tangga" },
  { value: "frozen",     label: "Frozen" },
  { value: "spices",     label: "Bumbu" },
  { value: "dairy",      label: "Susu" },
  { value: "other",      label: "Lainnya" }
];

const emptyForm = {
  name: "", sku: "", barcode: "", category: "staples" as ProductCategory,
  buyPrice: 0, sellPrice: 0, wholesalePrice: 0,
  buyUnit: "Karton", sellUnit: "Pcs", conversionFactor: 1,
  stock: 0, minStock: 5, maxStock: 100, active: true
};

export function ProductsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ProductCategory | "">("");
  const [view, setView] = useState<"grid" | "list">("list");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const products = productService.search(search, category || undefined);

  const openAdd = () => { setForm({ ...emptyForm }); setEditing(null); setShowModal(true); };
  const openEdit = (p: Product) => {
    setForm({ name:p.name, sku:p.sku, barcode:p.barcode||"", category:p.category, buyPrice:p.buyPrice, sellPrice:p.sellPrice, wholesalePrice:p.wholesalePrice||0, buyUnit:p.buyUnit, sellUnit:p.sellUnit, conversionFactor:p.conversionFactor, stock:p.stock, minStock:p.minStock, maxStock:p.maxStock, active:p.active });
    setEditing(p);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.name || !form.sku) { showToast("Nama dan SKU wajib diisi", "error"); return; }
    if (form.sellPrice <= 0) { showToast("Harga jual harus lebih dari 0", "error"); return; }
    if (editing) {
      productService.update(editing.id, form);
      showToast("Produk berhasil diperbarui", "success");
    } else {
      productService.add({ ...form, photo: undefined });
      showToast("Produk berhasil ditambahkan", "success");
    }
    setShowModal(false);
  };

  const handleDelete = (p: Product) => {
    showConfirm({
      title: "Hapus Produk",
      message: `Hapus "${p.name}"? Tindakan ini tidak dapat dibatalkan.`,
      danger: true,
      confirmLabel: "Hapus",
      onConfirm: () => { productService.delete(p.id); showToast("Produk dihapus", "success"); }
    });
  };

  const f = (key: string, val: any) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <div class="space-y-5">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-black text-gray-900 dark:text-gray-100">Produk</h2>
        <Button onClick={openAdd} icon={<Icons.Plus size={16} />}>Tambah Produk</Button>
      </div>

      {/* Filters */}
      <div class="flex flex-wrap gap-3 items-center">
        <div class="flex-1 min-w-48">
          <Input value={search} onInput={(e: any) => setSearch(e.target.value)} placeholder="Cari nama, SKU, barcode..." icon={<Icons.Search size={14} />} />
        </div>
        <Select value={category} onChange={(e: any) => setCategory(e.target.value)} options={CATEGORIES} class="w-44" />
        <div class="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <button onClick={() => setView("list")} class={`p-1.5 rounded-md transition-colors ${view==="list" ? "bg-white dark:bg-gray-700 shadow-sm text-primary-500" : "text-gray-400"}`}><Icons.List size={16} /></button>
          <button onClick={() => setView("grid")} class={`p-1.5 rounded-md transition-colors ${view==="grid" ? "bg-white dark:bg-gray-700 shadow-sm text-primary-500" : "text-gray-400"}`}><Icons.Grid size={16} /></button>
        </div>
      </div>

      <p class="text-sm text-gray-500">{products.length} produk ditemukan</p>

      {view === "list" ? (
        <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                <th class="text-left p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Produk</th>
                <th class="text-left p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Harga</th>
                <th class="text-left p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Stok</th>
                <th class="text-left p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Kategori</th>
                <th class="text-right p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50 dark:divide-gray-700">
              {products.map(p => {
                const isLow = p.stock <= p.minStock;
                return (
                  <tr key={p.id} class="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td class="p-4">
                      <p class="font-semibold text-gray-900 dark:text-gray-100">{p.name}</p>
                      <p class="text-xs text-gray-400">{p.sku} · {p.barcode || "—"}</p>
                    </td>
                    <td class="p-4">
                      <p class="font-bold text-primary-600 dark:text-primary-400">{formatRupiah(p.sellPrice)}</p>
                      <p class="text-xs text-gray-400">Beli: {formatRupiah(p.buyPrice)}</p>
                    </td>
                    <td class="p-4">
                      <Badge color={p.stock === 0 ? "red" : isLow ? "yellow" : "green"}>{p.stock} {p.sellUnit}</Badge>
                      <p class="text-xs text-gray-400 mt-0.5">Min: {p.minStock}</p>
                    </td>
                    <td class="p-4">
                      <Badge color="gray">{p.category}</Badge>
                    </td>
                    <td class="p-4">
                      <div class="flex gap-1 justify-end">
                        <button onClick={() => openEdit(p)} class="p-1.5 rounded-lg text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"><Icons.Edit size={15} /></button>
                        <button onClick={() => handleDelete(p)} class="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><Icons.Trash size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {products.length === 0 && (
            <div class="p-12 text-center text-gray-400">
              <Icons.Package size={40} class="mx-auto mb-3 opacity-30" />
              <p>Tidak ada produk ditemukan</p>
            </div>
          )}
        </div>
      ) : (
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {products.map(p => (
            <div key={p.id} class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3 hover:border-primary-200 dark:hover:border-primary-700 transition-all group">
              <div class="w-full aspect-square rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mb-2">
                <Icons.Package size={24} class="text-primary-300 dark:text-primary-600" />
              </div>
              <p class="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate mb-1">{p.name}</p>
              <p class="text-sm font-bold text-primary-600 dark:text-primary-400 mb-1">{formatRupiah(p.sellPrice)}</p>
              <Badge color={p.stock === 0 ? "red" : p.stock <= p.minStock ? "yellow" : "green"} size="sm">{p.stock} {p.sellUnit}</Badge>
              <div class="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(p)} class="flex-1 py-1 text-[10px] bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-md font-medium hover:bg-primary-100 dark:hover:bg-primary-900/40">Edit</button>
                <button onClick={() => handleDelete(p)} class="px-2 py-1 text-[10px] bg-red-50 dark:bg-red-900/20 text-red-500 rounded-md font-medium hover:bg-red-100 dark:hover:bg-red-900/40">Hapus</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product modal */}
      {showModal && (
        <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div class="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
              <h3 class="font-bold text-gray-900 dark:text-gray-100">{editing ? "Edit Produk" : "Tambah Produk"}</h3>
              <button onClick={() => setShowModal(false)} class="text-gray-400 hover:text-gray-600"><Icons.X size={20} /></button>
            </div>
            <div class="p-5 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
              <div class="grid grid-cols-2 gap-3">
                <Input label="Nama Produk *" value={form.name} onInput={(e: any) => f("name", e.target.value)} placeholder="Nama produk" />
                <Input label="SKU *" value={form.sku} onInput={(e: any) => f("sku", e.target.value)} placeholder="SKU001" />
              </div>
              <Input label="Barcode" value={form.barcode} onInput={(e: any) => f("barcode", e.target.value)} placeholder="8999999001" />
              <Select label="Kategori" value={form.category} onChange={(e: any) => f("category", e.target.value)} options={CATEGORIES.filter(c => c.value).map(c => ({ value: c.value, label: c.label }))} />
              <div class="grid grid-cols-2 gap-3">
                <Input label="Harga Beli (Rp)" type="number" value={form.buyPrice.toString()} onInput={(e: any) => f("buyPrice", parseInt(e.target.value)||0)} />
                <Input label="Harga Jual (Rp)" type="number" value={form.sellPrice.toString()} onInput={(e: any) => f("sellPrice", parseInt(e.target.value)||0)} />
              </div>
              <Input label="Harga Grosir (Rp, opsional)" type="number" value={form.wholesalePrice.toString()} onInput={(e: any) => f("wholesalePrice", parseInt(e.target.value)||0)} />
              <div class="grid grid-cols-3 gap-3">
                <Input label="Stok" type="number" value={form.stock.toString()} onInput={(e: any) => f("stock", parseInt(e.target.value)||0)} />
                <Input label="Min Stok" type="number" value={form.minStock.toString()} onInput={(e: any) => f("minStock", parseInt(e.target.value)||0)} />
                <Input label="Max Stok" type="number" value={form.maxStock.toString()} onInput={(e: any) => f("maxStock", parseInt(e.target.value)||0)} />
              </div>
              <div class="grid grid-cols-3 gap-3">
                <Input label="Satuan Beli" value={form.buyUnit} onInput={(e: any) => f("buyUnit", e.target.value)} />
                <Input label="Satuan Jual" value={form.sellUnit} onInput={(e: any) => f("sellUnit", e.target.value)} />
                <Input label="Konversi" type="number" value={form.conversionFactor.toString()} onInput={(e: any) => f("conversionFactor", parseFloat(e.target.value)||1)} />
              </div>
            </div>
            <div class="p-5 border-t border-gray-100 dark:border-gray-700 flex gap-3 flex-shrink-0">
              <Button variant="secondary" fullWidth onClick={() => setShowModal(false)}>Batal</Button>
              <Button variant="primary" fullWidth onClick={handleSave}>{editing ? "Simpan" : "Tambah"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
