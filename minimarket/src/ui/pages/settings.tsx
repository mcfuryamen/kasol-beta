import { useState } from "preact/hooks";
import { storeSettings, darkMode, printerConfig } from "@/logic/state/app-state";
import { printerService } from "@/logic/services/printer-service";
import { showToast } from "@/ui/molecules/toast";
import { Icons } from "@/ui/atoms/icon";
import { Button } from "@/ui/atoms/button";
import { Input, Select } from "@/ui/atoms/input";

export function SettingsPage() {
  const [tab, setTab] = useState<"store"|"pos"|"printer">("store");
  const settings = storeSettings.value;
  const cfg = printerConfig.value;

  const [form, setForm] = useState({...settings});
  const f = (k: string, v: any) => setForm(p => ({...p, [k]:v}));

  const handleSaveStore = () => {
    storeSettings.value = { ...form };
    showToast("Pengaturan disimpan!", "success");
  };

  const handleTestPrint = () => {
    printerService.printTest();
    showToast("Test print dijalankan", "info");
  };

  return (
    <div class="space-y-5 max-w-2xl mx-auto">
      <h2 class="text-2xl font-black text-gray-900 dark:text-gray-100">Pengaturan</h2>

      <div class="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        {[{id:"store",l:"Toko"},{id:"pos",l:"POS & Tampilan"},{id:"printer",l:"Printer"}].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} class={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab===t.id?"bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100":"text-gray-500"}`}>{t.l}</button>
        ))}
      </div>

      {tab === "store" && (
        <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 space-y-4">
          <h3 class="font-semibold text-gray-900 dark:text-gray-100">Informasi Toko</h3>
          <Input label="Nama Toko" value={form.name} onInput={(e: any) => f("name", e.target.value)} />
          <Input label="Alamat" value={form.address} onInput={(e: any) => f("address", e.target.value)} />
          <Input label="Telepon" value={form.phone} onInput={(e: any) => f("phone", e.target.value)} />
          <Input label="Tarif Pajak (%)" type="number" value={form.taxRate.toString()} onInput={(e: any) => f("taxRate", parseFloat(e.target.value)||11)} />
          <Input label="Footer Struk" value={form.receiptFooter} onInput={(e: any) => f("receiptFooter", e.target.value)} />
          <Button onClick={handleSaveStore} icon={<Icons.Check size={16} />}>Simpan Pengaturan</Button>
        </div>
      )}

      {tab === "pos" && (
        <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 space-y-5">
          <h3 class="font-semibold text-gray-900 dark:text-gray-100">Tampilan & Mode</h3>

          <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
            <div>
              <p class="font-medium text-gray-900 dark:text-gray-100">Mode Gelap</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">Aktifkan tampilan dark mode</p>
            </div>
            <button
              onClick={() => { darkMode.value = !darkMode.value; }}
              class={`relative w-12 h-6 rounded-full transition-colors ${darkMode.value ? "bg-primary-500" : "bg-gray-300"}`}
            >
              <span class={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${darkMode.value ? "left-6" : "left-0.5"}`} />
            </button>
          </div>

          <div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <p class="font-medium text-blue-800 dark:text-blue-300 mb-1">Pintasan Keyboard POS</p>
            <p class="text-xs text-blue-600 dark:text-blue-400 mb-2">Tekan <kbd class="font-mono bg-blue-100 dark:bg-blue-800 px-1 rounded">?</kbd> di halaman kasir untuk melihat semua pintasan keyboard.</p>
            <div class="grid grid-cols-2 gap-1 text-xs text-blue-700 dark:text-blue-300">
              <span>F1 - Fokus Barcode</span><span>F2 - Tahan Order</span>
              <span>F4 - Bayar</span><span>F5 - Hapus Keranjang</span>
              <span>F6 - Toggle Numpad</span><span>F12 - Fullscreen</span>
            </div>
          </div>
        </div>
      )}

      {tab === "printer" && (
        <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 space-y-4">
          <h3 class="font-semibold text-gray-900 dark:text-gray-100">Konfigurasi Printer</h3>

          <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
            <div>
              <p class="font-medium text-gray-900 dark:text-gray-100">Printer Aktif</p>
              <p class="text-xs text-gray-500">Aktifkan untuk auto print / thermal printing</p>
            </div>
            <button
              onClick={() => printerService.updateConfig({ enabled: !cfg.enabled })}
              class={`relative w-12 h-6 rounded-full transition-colors ${cfg.enabled ? "bg-primary-500" : "bg-gray-300"}`}
            >
              <span class={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${cfg.enabled ? "left-6" : "left-0.5"}`} />
            </button>
          </div>

          <Select
            label="Ukuran Kertas"
            value={cfg.paperSize}
            onChange={(e: any) => printerService.updateConfig({ paperSize: e.target.value })}
            options={[{value:"58mm",label:"Thermal 58mm"},{value:"80mm",label:"Thermal 80mm"},{value:"a4",label:"Kertas A4"}]}
          />
          <Select
            label="Tipe Koneksi"
            value={cfg.connectionType}
            onChange={(e: any) => printerService.updateConfig({ connectionType: e.target.value })}
            options={[{value:"usb",label:"USB"},{value:"bluetooth",label:"Bluetooth"},{value:"network",label:"Network/WiFi"}]}
          />
          {cfg.connectionType === "network" && (
            <Input label="Alamat IP Printer" value={cfg.ipAddress || ""} onInput={(e: any) => printerService.updateConfig({ ipAddress: e.target.value })} placeholder="192.168.1.100" />
          )}

          <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
            <div>
              <p class="font-medium text-gray-900 dark:text-gray-100">Auto Print</p>
              <p class="text-xs text-gray-500">Cetak otomatis setiap transaksi berhasil</p>
            </div>
            <button
              onClick={() => printerService.updateConfig({ autoPrint: !cfg.autoPrint })}
              class={`relative w-12 h-6 rounded-full transition-colors ${cfg.autoPrint ? "bg-primary-500" : "bg-gray-300"}`}
            >
              <span class={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${cfg.autoPrint ? "left-6" : "left-0.5"}`} />
            </button>
          </div>

          <Input
            label="Jumlah Salinan"
            type="number"
            value={cfg.copies.toString()}
            onInput={(e: any) => printerService.updateConfig({ copies: parseInt(e.target.value) || 1 })}
          />
          <Input
            label="Header Struk"
            value={cfg.headerText}
            onInput={(e: any) => printerService.updateConfig({ headerText: e.target.value })}
          />
          <Input
            label="Footer Struk"
            value={cfg.footerText}
            onInput={(e: any) => printerService.updateConfig({ footerText: e.target.value })}
          />

          <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
            <div>
              <p class="font-medium text-gray-900 dark:text-gray-100">Cetak Barcode di Struk</p>
              <p class="text-xs text-gray-500">Tampilkan barcode order di struk</p>
            </div>
            <button
              onClick={() => printerService.updateConfig({ printBarcode: !cfg.printBarcode })}
              class={`relative w-12 h-6 rounded-full transition-colors ${cfg.printBarcode ? "bg-primary-500" : "bg-gray-300"}`}
            >
              <span class={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${cfg.printBarcode ? "left-6" : "left-0.5"}`} />
            </button>
          </div>

          <Button variant="outline" onClick={handleTestPrint} icon={<Icons.Print size={16} />} fullWidth>
            Test Print
          </Button>

          <div class="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl text-xs text-yellow-700 dark:text-yellow-400">
            <strong>Catatan:</strong> Fitur printer ESC/POS memerlukan driver printer yang kompatibel. Untuk demo, klik "Test Print" untuk melihat pratinjau.
          </div>
        </div>
      )}
    </div>
  );
}
