import type { Product } from "@/data/types/product";
import { formatRupiah } from "@/logic/utils/format";
import { Badge } from "@/ui/atoms/badge";
import { Icons } from "@/ui/atoms/icon";

interface ProductCardProps {
  product: Product;
  view?: "grid" | "list";
  onAdd?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function ProductCard({ product: p, view = "grid", onAdd, onEdit, onDelete }: ProductCardProps) {
  const isLow = p.stock <= p.minStock;
  const isOut = p.stock === 0;

  if (view === "list") {
    return (
      <div class="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-700 transition-all">
        <div class="w-12 h-12 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center flex-shrink-0">
          <Icons.Package size={20} class="text-primary-400" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">{p.name}</p>
          <p class="text-xs text-gray-400 dark:text-gray-500">{p.sku} · {p.barcode || "—"}</p>
        </div>
        <div class="text-right flex-shrink-0">
          <p class="font-bold text-primary-600 dark:text-primary-400 text-sm">{formatRupiah(p.sellPrice)}</p>
          <Badge color={isOut ? "red" : isLow ? "yellow" : "green"} size="sm">{p.stock} {p.sellUnit}</Badge>
        </div>
        {onAdd && (
          <button onClick={onAdd} disabled={isOut} class="ml-2 w-8 h-8 rounded-lg bg-primary-500 hover:bg-primary-600 text-white flex items-center justify-center disabled:opacity-40">
            <Icons.Plus size={16} />
          </button>
        )}
        {onEdit && <button onClick={onEdit} class="ml-1 w-8 h-8 rounded-lg text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 flex items-center justify-center"><Icons.Edit size={14} /></button>}
        {onDelete && <button onClick={onDelete} class="ml-1 w-8 h-8 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center"><Icons.Trash size={14} /></button>}
      </div>
    );
  }

  return (
    <div
      class={`relative bg-white dark:bg-gray-800 rounded-xl border transition-all cursor-pointer hover:shadow-md hover:border-primary-300 dark:hover:border-primary-600 group
        ${isOut ? "opacity-60 border-gray-100 dark:border-gray-700" : "border-gray-100 dark:border-gray-700"}`}
      onClick={onAdd}
    >
      <div class="p-3">
        <div class="w-full aspect-square rounded-lg bg-gradient-to-br from-primary-50 to-orange-100 dark:from-primary-900/20 dark:to-orange-900/20 flex items-center justify-center mb-2">
          <Icons.Package size={28} class="text-primary-300 dark:text-primary-500" />
        </div>
        <p class="font-medium text-gray-900 dark:text-gray-100 text-xs leading-tight mb-1 line-clamp-2">{p.name}</p>
        <p class="font-bold text-primary-600 dark:text-primary-400 text-sm">{formatRupiah(p.sellPrice)}</p>
        <div class="flex items-center justify-between mt-1">
          <Badge color={isOut ? "red" : isLow ? "yellow" : "green"} size="sm">
            {isOut ? "Habis" : isLow ? `Sisa ${p.stock}` : `Stok ${p.stock}`}
          </Badge>
          {!isOut && (
            <div class="w-6 h-6 rounded-full bg-primary-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Icons.Plus size={12} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
