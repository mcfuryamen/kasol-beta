import { useState } from "preact/hooks";
import { activeShift, currentUser } from "@/logic/state/app-state";
import { financeService, shiftsSignal, pettyCashSignal, voidRecordsSignal, cashFlowsSignal } from "@/logic/services/finance-service";
import { ordersSignal } from "@/logic/services/pos-service";
import { staffList } from "@/logic/services/auth-service";
import { formatRupiah, formatDateTime, formatDate, isToday } from "@/logic/utils/format";
import { showToast } from "@/ui/molecules/toast";
import { Icons } from "@/ui/atoms/icon";
import { Button } from "@/ui/atoms/button";
import { Input, Select } from "@/ui/atoms/input";
import { Badge } from "@/ui/atoms/badge";
import { CashFlowItem } from "@/ui/molecules/cash-flow-item";
import { CashFlowForm } from "@/ui/organisms/cash-flow-form";
import { OpenKasModal } from "@/ui/organisms/open-kas-modal";
import { CloseKasModal } from "@/ui/organisms/close-kas-modal";
import type { Order } from "@/data/types/order";

export function FinancePage() {
  const [tab, setTab] = useState<"kas"|"cashflow"|"shifts"|"void">("kas");
  const [showOpenKas, setShowOpenKas] = useState(false);
  const [showCloseKas, setShowCloseKas] = useState(false);
  const [showCashFlowForm, setShowCashFlowForm] = useState<"in"|"out"|null>(null);
  const [cfFilter, setCfFilter] = useState<"all"|"in"|"out">("all");
  const [detail, setDetail] = useState<{ title: string; rows: string[][] } | null>(null);

  const handleRowKeyDown = (event: KeyboardEvent, action: () => void) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); action(); }
  };
  const showDetail = (title: string, rows: string[][]) => setDetail({ title, rows });

  // ── Void / retur transaksi ────────────────────────────────────────────────
  const [voidTarget, setVoidTarget] = useState<Order | null>(null);
  const [voidType, setVoidType] = useState<"void"|"return">("void");
  const [voidReason, setVoidReason] = useState("");

  const openVoid = (o: Order) => { setVoidTarget(o); setVoidType("void"); setVoidReason(""); };

  const confirmVoid = () => {
    if (!voidTarget) return;
    if (!voidReason.trim()) { showToast("Alasan wajib diisi", "error"); return; }
    financeService.voidOrder(voidTarget.id, voidReason.trim(), voidType);
    showToast(
      voidType === "void"
        ? `Transaksi ${voidTarget.orderNumber} di-void — stok & poin dikembalikan`
        : `Retur ${voidTarget.orderNumber} dicatat — stok dikembalikan`,
      "success"
    );
    setVoidTarget(null);
  };

  const user = currentUser.value;
  // Klaim help: void hanya owner/manager — kini benar-benar ditegakkan.
  const canVoid = user?.role === "owner" || user?.role === "manager";
  const shift = activeShift.value;
  const shifts = shiftsSignal.value;
  const staffName = (id: string) => staffList.value.find(u => u.id === id)?.name ?? id;
  const petties = pettyCashSignal.value;
  const voids = voidRecordsSignal.value;
  const cashFlows = cashFlowsSignal.value;
  const cashFlow = financeService.getDailyCashFlow();
  const runningBalance = financeService.getRunningBalance();

  const filteredCF = cashFlows.filter(cf => cfFilter === "all" || cf.type === cfFilter);

  return (
    <div class="space-y-3 max-w-5xl mx-auto">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-black text-gray-900 dark:text-gray-100">Keuangan & Kas</h2>
        <div class="flex gap-2">
          {!shift ? (
            <Button onClick={() => setShowOpenKas(true)} variant="success" icon={<Icons.Zap size={16} />}>Buka Kas</Button>
          ) : (
            <Button onClick={() => setShowCloseKas(true)} variant="danger" icon={<Icons.X size={16} />}>Tutup Kas</Button>
          )}
        </div>
      </div>

      {/* Cash flow summary */}
      <div class="grid grid-cols-3 gap-3">
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3">
          <p class="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Uang Masuk Hari Ini</p>
          <p class="text-xl font-black text-green-600 dark:text-green-400 mt-0.5">{formatRupiah(cashFlow.cashIn)}</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3">
          <p class="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Pengeluaran Hari Ini</p>
          <p class="text-xl font-black text-red-600 dark:text-red-400 mt-0.5">-{formatRupiah(cashFlow.cashOut)}</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3">
          <p class="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Saldo Kas</p>
          <p class={`text-xl font-black mt-0.5 ${runningBalance >= 0 ? "text-primary-600 dark:text-primary-400" : "text-red-600 dark:text-red-400"}`}>{formatRupiah(runningBalance)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div class="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
        {[{id:"kas",l:"Kas Aktif"},{id:"cashflow",l:"Uang Masuk/Keluar"},{id:"shifts",l:"Riwayat Shift"},{id:"void",l:"Void & Retur"}].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} class={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${tab===t.id?"bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm":"text-gray-500 dark:text-gray-400"}`}>{t.l}</button>
        ))}
      </div>

      {/* Tab: Kas Aktif */}
      {tab === "kas" && (
        <div class="space-y-3">
          {shift ? (
            <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
              <div class="flex items-center gap-2.5 mb-3">
                <div class="w-9 h-9 bg-green-100 dark:bg-green-900/40 rounded-lg flex items-center justify-center text-green-600 dark:text-green-400">
                  <Icons.Zap size={18} />
                </div>
                <div>
                  <p class="font-bold text-green-800 dark:text-green-300 flex items-center gap-2">
                    <span class="w-2 h-2 bg-green-500 rounded-full kas-pulse inline-block" />Kas Aktif
                  </p>
                  <p class="text-xs text-green-600 dark:text-green-400">Dibuka: {formatDateTime(shift.openedAt)}</p>
                </div>
              </div>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><p class="text-xs text-gray-500">Modal Awal</p><p class="font-bold text-gray-900 dark:text-gray-100">{formatRupiah(shift.openingBalance)}</p></div>
                <div><p class="text-xs text-gray-500">Penjualan Tunai</p><p class="font-bold text-green-600 dark:text-green-400">{formatRupiah(cashFlow.cashIn)}</p></div>
                <div><p class="text-xs text-gray-500">Pengeluaran</p><p class="font-bold text-red-600 dark:text-red-400">-{formatRupiah(cashFlow.cashOut)}</p></div>
                <div><p class="text-xs text-gray-500">Saldo Kas</p><p class="font-bold text-primary-600 dark:text-primary-400">{formatRupiah(runningBalance)}</p></div>
              </div>
            </div>
          ) : (
            <div class="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center">
              <Icons.Clock size={32} class="mx-auto mb-2 text-gray-300 dark:text-gray-600" />
              <p class="text-gray-500 dark:text-gray-400 mb-3">Tidak ada shift aktif.</p>
              <Button onClick={() => setShowOpenKas(true)} variant="success" icon={<Icons.Zap size={16} />}>Buka Kas</Button>
            </div>
          )}

          {/* Today's transactions */}
          <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div class="px-3 py-2.5 border-b border-gray-100 dark:border-gray-700">
              <h3 class="font-semibold text-xs text-gray-900 dark:text-gray-100">Transaksi Hari Ini</h3>
            </div>
            <div class="divide-y divide-gray-50 dark:divide-gray-700 max-h-72 overflow-y-auto scrollbar-thin">
              {ordersSignal.value.filter(o => isToday(o.createdAt) && o.status==="completed").slice(0,10).map(o => (
                <div key={o.id} class="px-3 py-2 flex items-center justify-between gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30" role="button" tabIndex={0} onClick={() => showDetail(`Detail ${o.orderNumber}`, [["Order", o.orderNumber], ["Pembayaran", o.paymentMethod], ["Item", `${o.items.length} item`], ["Total", formatRupiah(o.total)], ["Waktu", formatDateTime(o.createdAt)]])} onKeyDown={(e) => handleRowKeyDown(e, () => showDetail(`Detail ${o.orderNumber}`, [["Order", o.orderNumber], ["Pembayaran", o.paymentMethod], ["Item", `${o.items.length} item`], ["Total", formatRupiah(o.total)], ["Waktu", formatDateTime(o.createdAt)]]))}>
                  <div class="min-w-0"><p class="text-xs font-medium text-gray-900 dark:text-gray-100">{o.orderNumber}</p><p class="text-[10px] text-gray-400">{o.paymentMethod} · {o.items.length} item</p></div>
                  <div class="flex items-center gap-2 flex-shrink-0">
                    <p class="font-bold text-xs text-primary-600 dark:text-primary-400">{formatRupiah(o.total)}</p>
                    {canVoid && (
                      <button
                        onClick={(e) => { e.stopPropagation(); openVoid(o); }}
                        title="Void / Retur transaksi ini"
                        class="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Icons.X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {ordersSignal.value.filter(o => isToday(o.createdAt)).length === 0 && (
                <div class="p-6 text-center text-gray-400 text-xs">Belum ada transaksi hari ini</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Uang Masuk/Keluar */}
      {tab === "cashflow" && (
        <div class="space-y-3">
          <div class="flex gap-2">
            <Button variant="success" icon={<Icons.ArrowDown size={16} />} onClick={() => setShowCashFlowForm("in")}>Uang Masuk</Button>
            <Button variant="danger" icon={<Icons.ArrowUp size={16} />} onClick={() => setShowCashFlowForm("out")}>Uang Keluar</Button>
            <div class="ml-auto flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
              {(["all","in","out"] as const).map(f => (
                <button key={f} onClick={() => setCfFilter(f)} class={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${cfFilter===f?"bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100":"text-gray-500"}`}>
                  {f==="all"?"Semua":f==="in"?"Masuk":"Keluar"}
                </button>
              ))}
            </div>
          </div>
          <div class="space-y-1.5">
            {filteredCF.length === 0 ? (
              <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-8 text-center text-gray-400">Belum ada catatan arus kas</div>
            ) : filteredCF.map(cf => <CashFlowItem key={cf.id} item={cf} />)}
          </div>
        </div>
      )}

      {/* Tab: Riwayat Shift */}
      {tab === "shifts" && (
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div class="divide-y divide-gray-50 dark:divide-gray-700">
            {shifts.length === 0 ? <div class="p-8 text-center text-gray-400">Belum ada riwayat shift</div> : shifts.map(s => (
              <div key={s.id} class="px-3 py-2.5 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30" role="button" tabIndex={0} onClick={() => showDetail("Detail Shift", [["Dibuka", formatDateTime(s.openedAt)], ["Dibuka oleh", staffName(s.openedBy)], ...(s.closedAt ? [["Ditutup", formatDateTime(s.closedAt)]] : []), ["Status", s.status === "open" ? "Buka" : "Tutup"], ["Modal awal", formatRupiah(s.openingBalance)], ...(s.closingBalance !== undefined ? [["Aktual", formatRupiah(s.closingBalance)]] : []), ...(s.difference !== undefined ? [["Selisih", formatRupiah(s.difference)]] : []), ...(s.notes ? [["Catatan", s.notes]] : [])])} onKeyDown={(e) => handleRowKeyDown(e, () => showDetail("Detail Shift", [["Dibuka", formatDateTime(s.openedAt)], ["Dibuka oleh", staffName(s.openedBy)], ...(s.closedAt ? [["Ditutup", formatDateTime(s.closedAt)]] : []), ["Status", s.status === "open" ? "Buka" : "Tutup"], ["Modal awal", formatRupiah(s.openingBalance)], ...(s.closingBalance !== undefined ? [["Aktual", formatRupiah(s.closingBalance)]] : []), ...(s.difference !== undefined ? [["Selisih", formatRupiah(s.difference)]] : []), ...(s.notes ? [["Catatan", s.notes]] : [])]))}>
                <div>
                  <p class="font-semibold text-gray-900 dark:text-gray-100 text-xs">{formatDateTime(s.openedAt)}</p>
                  <p class="text-xs text-gray-400">Dibuka oleh: {staffName(s.openedBy)}</p>
                  {s.closedAt && <p class="text-xs text-gray-400">Ditutup: {formatDateTime(s.closedAt)}</p>}
                  {s.notes && <p class="text-xs text-gray-400 italic">{s.notes}</p>}
                </div>
                <div class="text-right">
                  <Badge color={s.status==="open"?"green":"gray"}>{s.status==="open"?"Buka":"Tutup"}</Badge>
                  <p class="text-xs font-medium text-gray-700 dark:text-gray-300 mt-0.5">Modal: {formatRupiah(s.openingBalance)}</p>
                  {s.closingBalance !== undefined && <p class="text-xs text-gray-500">Aktual: {formatRupiah(s.closingBalance)}</p>}
                  {s.difference !== undefined && (
                    <p class={`text-xs font-semibold ${s.difference >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      Selisih: {s.difference >= 0 ? "+" : ""}{formatRupiah(s.difference)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Void & Retur */}
      {tab === "void" && (
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          {canVoid && (
            <p class="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
              Untuk mem-void/mengembalikan transaksi, buka tab <b>Kas Aktif</b> lalu klik tombol ✕ pada baris transaksi hari ini.
            </p>
          )}
          <div class="divide-y divide-gray-50 dark:divide-gray-700">
            {voids.length === 0 ? <div class="p-8 text-center text-gray-400">Belum ada void/retur</div> : voids.map(v => (
              <div key={v.id} class="px-3 py-2.5 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30" role="button" tabIndex={0} onClick={() => showDetail(`Detail ${v.type === "void" ? "Void" : "Retur"}`, [["Order", v.orderNumber], ["Jenis", v.type === "void" ? "Void" : "Retur"], ["Alasan", v.reason], ["Jumlah", formatRupiah(v.amount)], ["Waktu", formatDateTime(v.createdAt)], ["Oleh", staffList.value.find(u => u.id === v.createdBy)?.name ?? v.createdBy]])} onKeyDown={(e) => handleRowKeyDown(e, () => showDetail(`Detail ${v.type === "void" ? "Void" : "Retur"}`, [["Order", v.orderNumber], ["Jenis", v.type === "void" ? "Void" : "Retur"], ["Alasan", v.reason], ["Jumlah", formatRupiah(v.amount)], ["Waktu", formatDateTime(v.createdAt)], ["Oleh", staffList.value.find(u => u.id === v.createdBy)?.name ?? v.createdBy]]))}>
                <div>
                  <p class="text-xs font-medium text-gray-900 dark:text-gray-100">{v.orderNumber}</p>
                  <p class="text-xs text-gray-400">{v.reason} · {formatDateTime(v.createdAt)}</p>
                  <p class="text-[10px] text-gray-400">oleh {staffList.value.find(u => u.id === v.createdBy)?.name ?? v.createdBy}</p>
                </div>
                <div class="text-right">
                  <Badge color={v.type==="void"?"red":"orange"}>{v.type==="void"?"Void":"Retur"}</Badge>
                  <p class="text-xs font-semibold text-gray-700 dark:text-gray-300 mt-0.5">{formatRupiah(v.amount)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {detail && (
        <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="finance-detail-title" onClick={() => setDetail(null)}>
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <div class="flex items-center justify-between mb-4">
              <h3 id="finance-detail-title" class="font-bold text-gray-900 dark:text-gray-100">{detail.title}</h3>
              <button aria-label="Tutup detail" onClick={() => setDetail(null)} class="text-gray-400 hover:text-gray-600"><Icons.X size={20} /></button>
            </div>
            <div class="space-y-2 text-xs">{detail.rows.map(([label, value]) => <div class="flex justify-between gap-3"><span class="text-gray-500">{label}</span><span class="text-right font-medium text-gray-900 dark:text-gray-100">{value}</span></div>)}</div>
          </div>
        </div>
      )}
      {showOpenKas && <OpenKasModal onClose={() => setShowOpenKas(false)} onOpened={() => setShowOpenKas(false)} />}
      {showCloseKas && <CloseKasModal onClose={() => setShowCloseKas(false)} onClosed={() => setShowCloseKas(false)} />}
      {showCashFlowForm && <CashFlowForm type={showCashFlowForm} onClose={() => setShowCashFlowForm(null)} />}

      {voidTarget && (
        <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-5">
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-bold text-gray-900 dark:text-gray-100">Void / Retur Transaksi</h3>
              <button onClick={() => setVoidTarget(null)} class="text-gray-400 hover:text-gray-600"><Icons.X size={20} /></button>
            </div>
            <div class="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3 mb-3 text-xs">
              <div class="flex justify-between"><span class="text-gray-500">Order</span><span class="font-semibold text-gray-900 dark:text-gray-100">{voidTarget.orderNumber}</span></div>
              <div class="flex justify-between"><span class="text-gray-500">Total</span><span class="font-semibold text-gray-900 dark:text-gray-100">{formatRupiah(voidTarget.total)}</span></div>
              <div class="flex justify-between"><span class="text-gray-500">Item</span><span class="text-gray-700 dark:text-gray-300">{voidTarget.items.length}</span></div>
            </div>
            <div class="space-y-3">
              <Select
                label="Jenis"
                value={voidType}
                onChange={(e: any) => setVoidType(e.target.value as "void"|"return")}
                options={[{ value: "void", label: "Void — salah input, transaksi dibatalkan" }, { value: "return", label: "Retur — pelanggan mengembalikan barang" }]}
              />
              <Input label="Alasan *" value={voidReason} onInput={(e: any) => setVoidReason(e.target.value)} placeholder="Wajib diisi, tercatat di riwayat" />
              <p class="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5">
                Stok barang dikembalikan otomatis{voidTarget.customerId ? ", poin & total belanja pelanggan dibatalkan" : ""}. Tindakan ini tercatat di riwayat Void & Retur.
              </p>
            </div>
            <div class="flex gap-3 mt-5">
              <Button variant="secondary" fullWidth onClick={() => setVoidTarget(null)}>Batal</Button>
              <Button variant="danger" fullWidth onClick={confirmVoid}>Konfirmasi {voidType === "void" ? "Void" : "Retur"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
