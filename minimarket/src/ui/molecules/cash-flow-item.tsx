import type { CashFlow } from "@/data/types/finance";
import { formatRupiah, formatDateTime } from "@/logic/utils/format";
import { Icons } from "@/ui/atoms/icon";

const categoryLabels: Record<string, string> = {
  setoran_tambahan: "Setoran Tambahan", pengembalian: "Pengembalian",
  belanja_operasional: "Operasional", setor_bank: "Setor Bank",
  gaji: "Gaji", listrik_air: "Listrik/Air", kebersihan: "Kebersihan", lainnya: "Lainnya"
};

interface CashFlowItemProps {
  item: CashFlow;
}

export function CashFlowItem({ item }: CashFlowItemProps) {
  const isIn = item.type === "in";
  return (
    <div class="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
      <div class={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isIn ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"}`}>
        {isIn ? <Icons.ArrowDown size={18} /> : <Icons.ArrowUp size={18} />}
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{item.description}</p>
        <p class="text-xs text-gray-400 dark:text-gray-500">{categoryLabels[item.category] || item.category} · {formatDateTime(item.createdAt)}</p>
      </div>
      <span class={`font-bold text-sm flex-shrink-0 ${isIn ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
        {isIn ? "+" : "-"}{formatRupiah(item.amount)}
      </span>
    </div>
  );
}
