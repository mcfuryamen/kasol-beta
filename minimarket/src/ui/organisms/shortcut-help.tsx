import { showShortcutHelp } from "@/logic/state/app-state";
import { Icons } from "@/ui/atoms/icon";

const shortcuts = [
  { key: "F1", desc: "Fokus input barcode / cari" },
  { key: "F2", desc: "Tahan order (Hold)" },
  { key: "F3", desc: "Tampilkan order ditahan" },
  { key: "F4", desc: "Bayar / Proses pembayaran" },
  { key: "F5", desc: "Hapus keranjang / Transaksi baru" },
  { key: "F6", desc: "Toggle mode numpad (QTY/DISC/BAYAR)" },
  { key: "F7", desc: "Pilih pelanggan" },
  { key: "F8", desc: "Buka cash drawer (visual)" },
  { key: "F9", desc: "Cetak struk terakhir" },
  { key: "F10", desc: "Void item terakhir ditambahkan" },
  { key: "F12", desc: "Toggle fullscreen POS" },
  { key: "Esc", desc: "Tutup modal yang terbuka" },
  { key: "Enter", desc: "Konfirmasi aksi saat ini" },
  { key: "+ / -", desc: "Tambah / Kurangi qty item dipilih" },
  { key: "Del", desc: "Hapus item yang dipilih" },
  { key: "?", desc: "Tampilkan/sembunyikan panel ini" },
];

export function ShortcutHelp() {
  if (!showShortcutHelp.value) return null;

  return (
    <div class="fixed inset-0 bg-black/50 z-[150] flex items-end sm:items-center justify-center p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div class="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h3 class="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Icons.Keyboard size={18} class="text-primary-500" />
            Pintasan Keyboard POS
          </h3>
          <button onClick={() => { showShortcutHelp.value = false; }} class="text-gray-400 hover:text-gray-600">
            <Icons.X size={20} />
          </button>
        </div>
        <div class="p-4 max-h-96 overflow-y-auto scrollbar-thin">
          <div class="space-y-1.5">
            {shortcuts.map(s => (
              <div key={s.key} class="flex items-center gap-3">
                <span class="font-mono text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-md w-14 text-center flex-shrink-0">{s.key}</span>
                <span class="text-sm text-gray-600 dark:text-gray-400">{s.desc}</span>
              </div>
            ))}
          </div>
        </div>
        <div class="p-3 bg-gray-50 dark:bg-gray-900/50 text-center">
          <p class="text-xs text-gray-500">Tekan <kbd class="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">?</kbd> kapan saja untuk membuka/menutup panel ini</p>
        </div>
      </div>
    </div>
  );
}
