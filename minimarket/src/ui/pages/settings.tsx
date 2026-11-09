import { useState, useRef, useEffect } from "preact/hooks";
import type { JSX } from "preact";
import { storeSettings, darkMode, printerConfig, currentUser, outlets, activeOutletId, operatingMode, businessId, type Outlet } from "@/logic/state/app-state";
import { outletService } from "@/logic/services/outlet-service";
import { showConfirm } from "@/ui/molecules/confirm-dialog";
import { printerService } from "@/logic/services/printer-service";
import { showToast } from "@/ui/molecules/toast";
import { Icons } from "@/ui/atoms/icon";
import { Button } from "@/ui/atoms/button";
import { Input, Select } from "@/ui/atoms/input";
import { LicenseStatusBar, openLicenseSheet, getLicenseStatus, getSetting, setSetting, ensureSynced, type LicenseStatus } from "@/logic/services/license";

interface DataUsaha { namaUsaha: string; namaPemilik: string; noWhatsapp: string; alamat: string; }
const emptyUsaha: DataUsaha = { namaUsaha: "", namaPemilik: "", noWhatsapp: "", alamat: "" };

type TabId = "outlet" | "usaha" | "pos" | "printer" | "license";

const TABS: { id: TabId; label: string; icon: any; hint: string }[] = [
  { id: "outlet",  label: "Outlet",         icon: Icons.Home,    hint: "Cabang, struk & PPN" },
  { id: "usaha",   label: "Data Usaha",     icon: Icons.Users,   hint: "Profil lisensi" },
  { id: "pos",     label: "POS & Tampilan", icon: Icons.Grid,    hint: "Mode gelap & pintasan" },
  { id: "printer", label: "Printer",        icon: Icons.Print,   hint: "ESC/POS" },
  { id: "license", label: "Lisensi",        icon: Icons.Shield,  hint: "Status & aktivasi" },
];

export function SettingsPage() {
  // Desktop: tab aktif (sidebar kiri). Mobile: akordeon satu-terbuka.
  const [tab, setTab] = useState<TabId>("outlet");
  const [mobileOpen, setMobileOpen] = useState<TabId | null>(null);
  const [licStatus, setLicStatus] = useState<LicenseStatus | null>(null);
  // Data Usaha — profil lisensi ala kaki5: dikirim ke cloud saat aktivasi
  // (device_assign) dan dipakai guard tabrakan identitas perangkat.
  const [usaha, setUsaha] = useState<DataUsaha>(emptyUsaha);
  const [usahaLoaded, setUsahaLoaded] = useState(false);

  const isSectionActive = (id: TabId) => tab === id || mobileOpen === id;

  const selectTab = (id: TabId) => {
    setTab(id);
    if (id !== "license") setLicStatus(null);
    else void getLicenseStatus().then(s => setLicStatus(s));
  };
  const toggleMobile = (id: TabId) => {
    const next = mobileOpen === id ? null : id;
    setMobileOpen(next);
    if (next === "license") void getLicenseStatus().then(s => setLicStatus(s));
  };

  // Load license status ketika bagian lisensi terbuka (desktop / mobile)
  if (isSectionActive("license") && !licStatus) {
    void getLicenseStatus().then(s => setLicStatus(s));
  }
  // Load Data Usaha saat bagiannya dibuka pertama kali
  if (isSectionActive("usaha") && !usahaLoaded) {
    void (async () => {
      const u: DataUsaha = {
        namaUsaha: String(await getSetting("namaUsaha", "") || ""),
        namaPemilik: String(await getSetting("namaPemilik", "") || ""),
        noWhatsapp: String(await getSetting("noWhatsapp", "") || ""),
        alamat: String(await getSetting("alamatUsaha", "") || ""),
      };
      setUsaha(u);
      setUsahaLoaded(true);
    })();
  }
  const settings = storeSettings.value;
  const cfg = printerConfig.value;
  // Janji help: manager boleh Pengaturan kecuali tarif pajak — itu domain owner.
  const canEditTax = currentUser.value?.role === "owner";

  const [form, setForm] = useState({...settings});
  const [outletForm, setOutletForm] = useState<Outlet | null>(null);
  const [outletLoadFailed, setOutletLoadFailed] = useState(false);
  const f = (k: string, v: any) => setForm(p => ({...p, [k]:v}));
  const loadOutlets = () => {
    setOutletLoadFailed(false);
    let settled = false;
    // Jaringan/IDB bisa gantung — jangan biarkan "Memuat outlet…" selamanya.
    const timer = setTimeout(() => { if (!settled) { settled = true; setOutletLoadFailed(true); } }, 10000);
    outletService.load().then(list => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      const active = list.find(o => o.id === activeOutletId.value) || list[0];
      if (active) setOutletForm(active);
      else setOutletLoadFailed(true);
    }).catch(() => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      setOutletLoadFailed(true);
    });
  };
  useEffect(() => { loadOutlets(); }, []);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll ke atas konten setiap ganti bagian — klik sidebar (desktop)
  // maupun buka akordeon (mobile): konten baru selalu dibaca dari awal.
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
    const main = document.querySelector("main");
    if (main) main.scrollTop = 0;
  }, [tab, mobileOpen]);

  const handleSaveOutlet = async () => {
    if (!outletForm) return;
    const r = await outletService.save(outletForm);
    if (!r.ok) { showToast(r.error || "Outlet gagal disimpan", "error"); return; }
    setOutletForm(outlets.value.find(o => o.id === outletForm.id) || null);
    setForm({ ...storeSettings.value });
    showToast("Pengaturan outlet disimpan", "success");
  };

  const handleSwitchOutlet = (id: string) => {
    const r = outletService.select(id);
    if (!r.ok) { showToast(r.error || "Tidak bisa pindah outlet", "error"); return; }
    const next = outlets.value.find(o => o.id === id);
    if (next) { setOutletForm(next); setForm({ ...storeSettings.value }); }
    // Data outlet baru dimuat oleh listener switch (hydrate + pull).
    showToast(`Berpindah ke ${next?.name || "outlet"} — data dimuat ulang`, "success");
  };

  const handleAddOutlet = () => {
    if (operatingMode.value !== "multi") { showToast("Tambah outlet tersedia pada mode Multi Outlet", "error"); return; }
    setOutletForm({
      id: "", businessId: businessId.value || "", code: "", name: "",
      address: "", phone: "", taxRate: storeSettings.value.taxRate,
      receiptFooter: storeSettings.value.receiptFooter,
      isActive: true, isDefault: false, archivedAt: null,
    });
  };

  const handleToggleArchive = (o: Outlet) => {
    const archived = !o.archivedAt;
    showConfirm({
      title: archived ? "Arsipkan Outlet" : "Pulihkan Outlet",
      message: archived
        ? `Arsipkan "${o.name}"? Outlet disembunyikan dari operasional, histori transaksinya tetap tersimpan.`
        : `Pulihkan "${o.name}" ke operasional?`,
      danger: archived,
      confirmLabel: archived ? "Arsipkan" : "Pulihkan",
      onConfirm: async () => {
        const r = await outletService.setArchived(o.id, archived);
        if (!r.ok) { showToast(r.error || "Gagal mengubah status outlet", "error"); return; }
        setOutletForm(outlets.value.find(x => x.id === o.id) || null);
        showToast(archived ? "Outlet diarsipkan" : "Outlet dipulihkan", "success");
      },
    });
  };

  const handleSetMode = (mode: "single" | "multi") => {
    if (operatingMode.value === mode) return;
    showConfirm({
      title: mode === "multi" ? "Aktifkan Multi Outlet" : "Aktifkan Single Outlet",
      message: mode === "multi"
        ? "Outlet yang ada tetap dipakai dan data lama tidak berpindah. Anda bisa menambahkan outlet lain setelah ini."
        : "Operasional akan memakai satu outlet utama. Outlet lain TIDAK dihapus — hanya disembunyikan sampai mode Multi Outlet diaktifkan lagi.",
      danger: mode === "single",
      confirmLabel: mode === "multi" ? "Aktifkan Multi" : "Aktifkan Single",
      onConfirm: async () => {
        const r = await outletService.setOperatingMode(mode);
        if (!r.ok) { showToast(r.error || "Gagal mengubah mode", "error"); return; }
        const active = outlets.value.find(o => o.id === activeOutletId.value);
        if (active) setOutletForm(active);
        showToast(mode === "multi" ? "Mode Multi Outlet aktif" : "Mode Single Outlet aktif", "success");
      },
    });
  };

  const handleSaveUsaha = async () => {
    if (!usaha.namaUsaha.trim() || !usaha.namaPemilik.trim() || !usaha.noWhatsapp.trim()) {
      showToast("Nama usaha, nama pemilik, dan nomor WhatsApp wajib diisi", "error");
      return;
    }
    await setSetting("namaUsaha", usaha.namaUsaha.trim());
    await setSetting("namaPemilik", usaha.namaPemilik.trim());
    await setSetting("noWhatsapp", usaha.noWhatsapp.trim());
    await setSetting("alamatUsaha", usaha.alamat.trim());
    showToast("Data usaha disimpan — ikut terkirim saat sinkron lisensi", "success");
    void ensureSynced();
  };

  const handleTestPrint = () => {
    printerService.printTest();
    showToast("Test print dijalankan", "info");
  };

  // ── Isi tiap bagian (tanpa kartu pembungkus — dibungkus layout di atas) ──
  const outletContent = outletForm ? (
    <div class="space-y-3">
      <div class="flex items-center gap-2">
        <Select
          label="Outlet aktif"
          value={outletForm.id}
          onChange={(e: any) => handleSwitchOutlet(e.target.value)}
          options={outletService.operational().map(o => ({ value: o.id, label: `${o.code} · ${o.name}` }))}
        />
      </div>
      {operatingMode.value === "multi" && (
        <div class="flex items-center justify-between p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
          <p class="text-xs text-blue-700 dark:text-blue-300">Mode Multi Outlet aktif — kelola cabang di bawah ini.</p>
          <Button variant="outline" size="sm" onClick={handleAddOutlet} icon={<Icons.Plus size={14} />}>Tambah Outlet</Button>
        </div>
      )}
      <Input label="Kode Outlet *" value={outletForm.code} onInput={(e: any) => setOutletForm(o => o && ({ ...o, code: e.target.value.toUpperCase() }))} placeholder="UTM" />
      <Input label="Nama Outlet *" value={outletForm.name} onInput={(e: any) => setOutletForm(o => o && ({ ...o, name: e.target.value }))} />
      <Input label="Alamat" value={outletForm.address} onInput={(e: any) => setOutletForm(o => o && ({ ...o, address: e.target.value }))} />
      <Input label="Telepon" value={outletForm.phone} onInput={(e: any) => setOutletForm(o => o && ({ ...o, phone: e.target.value }))} />
      <Input label="Tarif Pajak (%)" type="number" value={outletForm.taxRate.toString()} disabled={!canEditTax} onInput={(e: any) => { const v = parseFloat(e.target.value); setOutletForm(o => o && ({ ...o, taxRate: Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0 })); }} />
      <Input label="Footer Struk" value={outletForm.receiptFooter} onInput={(e: any) => setOutletForm(o => o && ({ ...o, receiptFooter: e.target.value }))} />
      <Button onClick={handleSaveOutlet} icon={<Icons.Check size={16} />}>{outletForm.id ? "Simpan Outlet" : "Tambah Outlet"}</Button>

      {operatingMode.value === "multi" && (
        <div class="pt-2 border-t border-gray-100 dark:border-gray-700">
          <p class="text-xs font-semibold text-gray-500 mb-1.5">Daftar Outlet</p>
          <div class="space-y-1">
            {outlets.value.map(o => (
              <div key={o.id} class="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-xs">
                <span class="font-mono font-semibold text-gray-600 dark:text-gray-300">{o.code || "—"}</span>
                <span class="flex-1 truncate text-gray-800 dark:text-gray-100">{o.name}</span>
                {o.isDefault && <span class="px-1.5 py-0.5 rounded bg-primary-100 text-primary-700 text-[10px] font-semibold">Default</span>}
                {o.archivedAt && <span class="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-500 text-[10px] font-semibold">Arsip</span>}
                {currentUser.value?.role === "owner" && (
                  <button
                    onClick={() => handleToggleArchive(o)}
                    disabled={o.isDefault}
                    class={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors ${o.isDefault ? "opacity-40 cursor-not-allowed text-gray-400" : o.archivedAt ? "text-green-600 hover:bg-green-50" : "text-red-500 hover:bg-red-50"}`}
                  >
                    {o.archivedAt ? "Pulihkan" : "Arsipkan"}
                  </button>
                )}
              </div>
            ))}
          </div>
          <p class="text-[11px] text-gray-400 mt-1">Outlet yang diarsipkan tidak menghapus histori transaksinya.</p>
        </div>
      )}
    </div>
  ) : outletLoadFailed ? (
    <div class="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
      <p class="flex-1 text-xs text-red-700 dark:text-red-300">Outlet gagal dimuat — periksa koneksi lalu coba lagi.</p>
      <Button variant="outline" size="sm" onClick={loadOutlets}>Coba Lagi</Button>
    </div>
  ) : <p class="text-xs text-gray-500">Memuat outlet…</p>;

  const usahaContent = (
    <div class="space-y-3">
      <p class="text-xs text-gray-500 dark:text-gray-400">
        Identitas usaha pemilik perangkat — dipakai admin untuk verifikasi lisensi dan mencegah tabrakan identitas antar perangkat.
      </p>
      {currentUser.value?.role === "owner" && (
        <div class="space-y-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
          <p class="font-medium text-xs text-gray-900 dark:text-gray-100">Mode Operasional</p>
          <p class="text-[11px] text-gray-500 dark:text-gray-400">
            {operatingMode.value === "single"
              ? "Single outlet: satu outlet utama dipakai otomatis tanpa pemilihan cabang."
              : "Multi outlet: cabang dapat ditambahkan dan data dipisah per outlet."}
          </p>
          <div class="flex gap-1 bg-gray-100 dark:bg-gray-900/60 p-1 rounded-xl">
            {([["single", "Single Outlet"], ["multi", "Multi Outlet"]] as const).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => handleSetMode(m)}
                class={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${operatingMode.value === m ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <p class="text-[11px] text-gray-400">Mode dapat diubah kapan saja; outlet yang diarsipkan beserta histori­nya tidak pernah dihapus.</p>
        </div>
      )}
      <Input label="Nama Usaha *" value={usaha.namaUsaha} onInput={(e: any) => setUsaha(u => ({ ...u, namaUsaha: e.target.value }))} placeholder="Contoh: Toko Berkah Jaya" />
      <Input label="Nama Pemilik *" value={usaha.namaPemilik} onInput={(e: any) => setUsaha(u => ({ ...u, namaPemilik: e.target.value }))} placeholder="Nama lengkap pemilik" />
      <Input label="Nomor WhatsApp *" value={usaha.noWhatsapp} onInput={(e: any) => setUsaha(u => ({ ...u, noWhatsapp: e.target.value }))} placeholder="08xxxxxxxxxx" />
      <Input label="Alamat" value={usaha.alamat} onInput={(e: any) => setUsaha(u => ({ ...u, alamat: e.target.value }))} placeholder="Alamat toko (opsional)" />
      <Button onClick={handleSaveUsaha} icon={<Icons.Check size={16} />}>Simpan Data Usaha</Button>
    </div>
  );

  const posContent = (
    <div class="space-y-3">
      <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
        <div>
          <p class="font-medium text-xs text-gray-900 dark:text-gray-100">Mode Gelap</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">Aktifkan tampilan dark mode</p>
        </div>
        <button
          onClick={() => { darkMode.value = !darkMode.value; }}
          class={`relative w-12 h-6 rounded-full transition-colors ${darkMode.value ? "bg-primary-500" : "bg-gray-300"}`}
        >
          <span class={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${darkMode.value ? "left-6" : "left-0.5"}`} />
        </button>
      </div>

      <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
        <p class="font-medium text-blue-800 dark:text-blue-300 mb-1">Pintasan Keyboard POS</p>
        <p class="text-xs text-blue-600 dark:text-blue-400 mb-2">Tekan <kbd class="font-mono bg-blue-100 dark:bg-blue-800 px-1 rounded">?</kbd> di halaman kasir untuk melihat semua pintasan keyboard.</p>
        <div class="grid grid-cols-2 gap-1 text-xs text-blue-700 dark:text-blue-300">
          <span>F1 - Fokus Barcode</span><span>F2 - Tahan Order</span>
          <span>F4 - Bayar</span><span>F5 - Hapus Keranjang</span>
          <span>F6 - Toggle Numpad</span><span>F12 - Fullscreen</span>
        </div>
      </div>
    </div>
  );

  const printerContent = (
    <div class="space-y-3">
      <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
        <div>
          <p class="font-medium text-xs text-gray-900 dark:text-gray-100">Printer Aktif</p>
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

      <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
        <div>
          <p class="font-medium text-xs text-gray-900 dark:text-gray-100">Auto Print</p>
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

      <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
        <div>
          <p class="font-medium text-xs text-gray-900 dark:text-gray-100">Cetak Barcode di Struk</p>
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

      <div class="p-2.5 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl text-xs text-yellow-700 dark:text-yellow-400">
        <strong>Catatan:</strong> Fitur printer ESC/POS memerlukan driver printer yang kompatibel. Untuk demo, klik "Test Print" untuk melihat pratinjau.
      </div>
    </div>
  );

  const licenseContent = licStatus ? (
    <div class="space-y-3">
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-3">Status Lisensi</h3>
        <LicenseStatusBar
          status={licStatus}
          onActivateClick={openLicenseSheet}
        />
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-2">ID Perangkat</h3>
        <div class="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3 flex items-center justify-between">
          <div>
            <p class="text-xs text-gray-500 mb-1">Unit ID</p>
            <p class="font-mono text-xs text-gray-700 dark:text-gray-200 select-all">{licStatus.unitId}</p>
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(licStatus.unitId); showToast("ID Perangkat disalin!", "success"); }}
            class="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-400"
            title="Salin"
          >
            <Icons.Clipboard size={16} />
          </button>
        </div>
      </div>

      <div class="bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800 p-3 text-xs text-orange-700 dark:text-orange-300">
        <strong>Beli Lisensi:</strong> Hubungi admin untuk membeli lisensi. Sertakan ID Perangkat di atas — aktivasi berjalan otomatis setelah pembayaran diverifikasi admin.
      </div>

      <button
        onClick={openLicenseSheet}
        class="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold text-xs shadow-sm hover:from-orange-600 hover:to-orange-700 transition-all"
      >
        💳 Lihat Detail & Aktifasi Lisensi
      </button>
    </div>
  ) : (
    <p class="text-xs text-gray-400 py-4 text-center">Memuat status lisensi…</p>
  );

  const sectionContent: Record<TabId, JSX.Element> = {
    outlet: outletContent,
    usaha: usahaContent,
    pos: posContent,
    printer: printerContent,
    license: licenseContent,
  };
  const current = TABS.find(t => t.id === tab)!;

  return (
    <div class="space-y-4">
      {/* Header */}
      <div class="flex items-center gap-2">
        <Icons.Settings size={20} class="text-primary-500" />
        <h2 class="text-xl font-black text-gray-900 dark:text-gray-100">Pengaturan</h2>
      </div>

      <p class="text-xs text-gray-500">Atur toko, tampilan, printer, dan lisensi aplikasi.</p>

      {/* Desktop: 2-column grid seperti halaman Bantuan. Mobile: hidden. */}
      <div class="hidden lg:grid lg:grid-cols-[220px_1fr] gap-4">
        {/* Sidebar bagian */}
        <aside class="self-start sticky top-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div class="px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
            <p class="font-semibold text-[10px] uppercase tracking-wide text-gray-500">Bagian</p>
          </div>
          <nav class="p-1.5 space-y-0.5">
            {TABS.map(t => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => selectTab(t.id)}
                  class={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left ${
                    active
                      ? "bg-primary-500 text-white"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <Icon size={14} class="flex-shrink-0" />
                  <span class="flex-1 truncate">{t.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Area konten */}
        <div ref={contentRef} class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden self-start max-h-[calc(100vh-7rem)] overflow-y-auto scrollbar-thin">
          <div class="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2 sticky top-0">
            <current.icon size={16} class="text-primary-500" />
            <h3 class="font-semibold text-xs text-gray-900 dark:text-gray-100">{current.label}</h3>
            <span class="ml-auto text-[10px] text-gray-400">{current.hint}</span>
          </div>
          <div class="p-4">
            {sectionContent[tab]}
          </div>
        </div>
      </div>

      {/* Mobile: akordeon satu-terbuka, pola halaman Bantuan */}
      <div class="lg:hidden space-y-2">
        {TABS.map(t => {
          const Icon = t.icon;
          const isOpen = mobileOpen === t.id;
          return (
            <div key={t.id} class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <button
                onClick={() => toggleMobile(t.id)}
                class="w-full flex items-center gap-2 px-3 py-2.5 text-left active:bg-gray-50 dark:active:bg-gray-700/50 transition-colors"
                aria-expanded={isOpen}
              >
                <Icon size={14} class={`flex-shrink-0 ${isOpen ? "text-primary-500" : "text-gray-400"}`} />
                <span class="flex-1 text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{t.label}</span>
                <Icons.ChevronDown
                  size={14}
                  class={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              {isOpen && (
                <div class="border-t border-gray-100 dark:border-gray-700 p-4">
                  {sectionContent[t.id]}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
