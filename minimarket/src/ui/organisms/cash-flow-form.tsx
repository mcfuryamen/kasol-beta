import { useState } from "preact/hooks";
import { financeService } from "@/logic/services/finance-service";
import { activeShift, currentUser } from "@/logic/state/app-state";
import { showToast } from "@/ui/molecules/toast";
import { Icons } from "@/ui/atoms/icon";
import { Button } from "@/ui/atoms/button";
import { Input, Select } from "@/ui/atoms/input";

interface CashFlowFormProps {
  onClose: () => void;
  type: "in" | "out";
}

const inCategories = [
  { value: "setoran_tambahan", label: "Setoran Tambahan" },
  { value: "pengembalian", label: "Pengembalian" },
  { value: "lainnya", label: "Lainnya" }
];

const outCategories = [
  { value: "belanja_operasional", label: "Belanja Operasional" },
  { value: "setor_bank", label: "Setor Bank" },
  { value: "gaji", label: "Gaji" },
  { value: "listrik_air", label: "Listrik/Air" },
  { value: "kebersihan", label: "Kebersihan" },
  { value: "lainnya", label: "Lainnya" }
];

export function CashFlowForm({ onClose, type }: CashFlowFormProps) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(type === "in" ? "setoran_tambahan" : "belanja_operasional");
  const [description, setDescription] = useState("");
  const user = currentUser.value;
  const shift = activeShift.value;

  const isIn = type === "in";
  const categories = isIn ? inCategories : outCategories;

  const handleSubmit = () => {
    const amt = parseInt(amount) || 0;
    if (amt <= 0) { showToast("Masukkan jumlah yang valid", "error"); return; }
    if (!description.trim()) { showToast("Masukkan keterangan", "error"); return; }
    if (!user) return;

    financeService.addCashFlow({
      type, category: category as any, amount: amt,
      description: description.trim(),
      shiftId: shift?.id,
      createdBy: user.id
    });

    showToast(`${isIn ? "Uang masuk" : "Uang keluar"} berhasil dicatat`, "success");
    onClose();
  };

  return (
    <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div class={`p-4 ${isIn ? "bg-green-500" : "bg-red-500"} text-white`}>
          <div class="flex items-center justify-between">
            <h3 class="font-bold text-lg flex items-center gap-2">
              {isIn ? <Icons.ArrowDown size={20} /> : <Icons.ArrowUp size={20} />}
              {isIn ? "Uang Masuk" : "Uang Keluar"}
            </h3>
            <button onClick={onClose} class="text-white/70 hover:text-white"><Icons.X size={20} /></button>
          </div>
        </div>
        <div class="p-5 space-y-4">
          <Input
            label="Jumlah (Rp) *"
            type="number"
            value={amount}
            onInput={(e: any) => setAmount(e.target.value)}
            placeholder="0"
          />
          <Select
            label="Kategori"
            value={category}
            onChange={(e: any) => setCategory(e.target.value)}
            options={categories}
          />
          <Input
            label="Keterangan *"
            value={description}
            onInput={(e: any) => setDescription(e.target.value)}
            placeholder={isIn ? "Contoh: Setoran dari pemilik" : "Contoh: Beli plastik kresek"}
          />
          <div class="flex gap-3">
            <Button variant="secondary" fullWidth onClick={onClose}>Batal</Button>
            <Button variant={isIn ? "success" : "danger"} fullWidth onClick={handleSubmit}>
              Catat
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
