import { useState } from "preact/hooks";
import { activeShift, currentUser } from "@/logic/state/app-state";
import { financeService, shiftsSignal, pettyCashSignal, voidRecordsSignal, cashFlowsSignal } from "@/logic/services/finance-service";
import { ordersSignal } from "@/logic/services/pos-service";
import { formatRupiah, formatDateTime, formatDate } from "@/logic/utils/format";
import { showToast } from "@/ui/molecules/toast";
import { Icons } from "@/ui/atoms/icon";
import { Button } from "@/ui/atoms/button";
import { Input, Select } from "@/ui/atoms/input";
import { Badge } from "@/ui/atoms/badge";
import { CashFlowItem } from "@/ui/molecules/cash-flow-item";
import { CashFlowForm } from "@/ui/organisms/cash-flow-form";
import { OpenKasModal } from "@/ui/organisms/open-kas-modal";
import { CloseKasModal } from "@/ui/organisms/close-kas-modal";

export function FinancePage() {
  const [tab, setTab] = useState<"kas"|"cashflow"|"shifts"|"void">("kas");
  const [showOpenKas, setShowOpenKas] = useState(false);
  const [showCloseKas, setShowCloseKas] = useState(false);
  const [showCashFlowForm, setShowCashFlowForm] = useState<"in"|"out"|null>(null);
  const [cfFilter, setCfFilter] = useState<"all"|"in"|"out">("all");

  const user = currentUser.value;
  const shift = activeShift.value;
  const shifts = shiftsSignal.value;
  const petties = pettyCashSignal.value;
  const voids = voidRecordsSignal.value;
  const cashFlows = cashFlowsSignal.value;
  const cashFlow = financeService.getDailyCashFlow();
  const runningBalance = financeService.getRunningBalance();

  const filteredCF = cashFlows.filter(cf => cfFilter === "all" || cf.type === cfFilter);

  return (
    <div class="space-y-5 max-w-5xl mx-auto">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-black text-gray-900 dark:text-gray-100">Keuangan & Kas</h2>
        <div class="flex gap-2">
          {!shift ? (
            <Button onClick={() => setShowOpenKas(true)} variant="success" icon={<Icons.Zap size={16} />}>Buka Kas</Button>
          ) : (
            <Button onClick={() => setShowCloseKas(true)} variant="danger" icon={<Icons.X size={16} />}>Tutup Kas</Button>
          )}
        </div>
      </div>

      {/* Cash flow summary */}
      <div class="grid grid-cols-3 gap-4">
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <p class="text-sm text-gray-500 dark:text-gray-400">Uang Masuk Hari Ini</p>
          <p class="text-2xl font-black text-green-600 dark:text-green-400 mt-1">{formatRupiah(cashFlow.cashIn)}</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <p class="text-sm text-gray-500 dark:text-gray-400">Pengeluaran Hari Ini</p>
          <p class="text-2xl font-black text-red-600 dark:text-red-400 mt-1">-{formatRupiah(cashFlow.cashOut)}</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <p class="text-sm text-gray-500 dark:text-gray-400">Saldo Kas</p>
          <p class={`text-2xl font-black mt-1 ${runningBalance >= 0 ? "text-primary-600 dark:text-primary-400" : "text-red-600 dark:text-red-400"}`}>{formatRupiah(runningBalance)}</p>
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
        <div class="space-y-4">
          {shift ? (
            <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-5">
              <div class="flex items-center gap-3 mb-4">
                <div class="w-10 h-10 bg-green-100 dark:bg-green-900/40 rounded-xl flex items-center justify-center text-green-600 dark:text-green-400">
                  <Icons.Zap size={22} />
                </div>
                <div>
                  <p class="font-bold text-green-800 dark:text-green-300 flex items-center gap-2">
                    <span class="w-2 h-2 bg-green-500 rounded-full kas-pulse inline-block" />Kas Aktif
                  </p>
                  <p class="text-xs text-green-600 dark:text-green-400">Dibuka: {formatDateTime(shift.openedAt)}</p>
                </div>
              </div>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><p class="text-xs text-gray-500">Modal Awal</p><p class="font-bold text-gray-900 dark:text-gray-100">{formatRupiah(shift.openingBalance)}</p></div>
                <div><p class="text-xs text-gray-500">Penjualan Tunai</p><p class="font-bold text-green-600 dark:text-green-400">{formatRupiah(cashFlow.cashIn)}</p></div>
                <div><p class="text-xs text-gray-500">Pengeluaran</p><p class="font-bold text-red-600 dark:text-red-400">-{formatRupiah(cashFlow.cashOut)}</p></div>
                <div><p class="text-xs text-gray-500">Saldo Kas</p><p class="font-bold text-primary-600 dark:text-primary-400">{formatRupiah(runningBalance)}</p></div>
              </div>
            </div>
          ) : (
            <div class="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-8 text-center">
              <Icons.Clock size={40} class="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p class="text-gray-500 dark:text-gray-400 mb-4">Tidak ada shift aktif.</p>
              <Button onClick={() => setShowOpenKas(true)} variant="success" icon={<Icons.Zap size={16} />}>Buka Kas</Button>
            </div>
          )}

          {/* Today's transactions */}
          <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div class="p-4 border-b border-gray-100 dark:border-gray-700">
              <h3 class="font-semibold text-gray-900 dark:text-gray-100">Transaksi Hari Ini</h3>
            </div>
            <div class="divide-y divide-gray-50 dark:divide-gray-700 max-h-80 overflow-y-auto scrollbar-thin">
              {ordersSignal.value.filter(o => o.createdAt.startsWith(new Date().toISOString().slice(0,10)) && o.status==="completed").slice(0,10).map(o => (
                <div key={o.id} class="p-3 flex items-center justify-between">
                  <div><p class="text-sm font-medium text-gray-900 dark:text-gray-100">{o.orderNumber}</p><p class="text-xs text-gray-400">{o.paymentMethod} · {o.items.length} item</p></div>
                  <p class="font-bold text-sm text-primary-600 dark:text-primary-400">{formatRupiah(o.total)}</p>
                </div>
              ))}
              {ordersSignal.value.filter(o => o.createdAt.startsWith(new Date().toISOString().slice(0,10))).length === 0 && (
                <div class="p-8 text-center text-gray-400 text-sm">Belum ada transaksi hari ini</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Uang Masuk/Keluar */}
      {tab === "cashflow" && (
        <div class="space-y-4">
          <div class="flex gap-3">
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
          <div class="space-y-2">
            {filteredCF.length === 0 ? (
              <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-10 text-center text-gray-400">Belum ada catatan arus kas</div>
            ) : filteredCF.map(cf => <CashFlowItem key={cf.id} item={cf} />)}
          </div>
        </div>
      )}

      {/* Tab: Riwayat Shift */}
      {tab === "shifts" && (
        <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div class="divide-y divide-gray-50 dark:divide-gray-700">
            {shifts.length === 0 ? <div class="p-10 text-center text-gray-400">Belum ada riwayat shift</div> : shifts.map(s => (
              <div key={s.id} class="p-4 flex items-center justify-between">
                <div>
                  <p class="font-semibold text-gray-900 dark:text-gray-100 text-sm">{formatDateTime(s.openedAt)}</p>
                  <p class="text-xs text-gray-400">Dibuka oleh: {s.openedBy}</p>
                  {s.closedAt && <p class="text-xs text-gray-400">Ditutup: {formatDateTime(s.closedAt)}</p>}
                  {s.notes && <p class="text-xs text-gray-400 italic">{s.notes}</p>}
                </div>
                <div class="text-right">
                  <Badge color={s.status==="open"?"green":"gray"}>{s.status==="open"?"Buka":"Tutup"}</Badge>
                  <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mt-1">Modal: {formatRupiah(s.openingBalance)}</p>
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
        <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div class="divide-y divide-gray-50 dark:divide-gray-700">
            {voids.length === 0 ? <div class="p-10 text-center text-gray-400">Belum ada void/retur</div> : voids.map(v => (
              <div key={v.id} class="p-4 flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{v.orderNumber}</p>
                  <p class="text-xs text-gray-400">{v.reason} · {formatDateTime(v.createdAt)}</p>
                </div>
                <div class="text-right">
                  <Badge color={v.type==="void"?"red":"orange"}>{v.type==="void"?"Void":"Retur"}</Badge>
                  <p class="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-1">{formatRupiah(v.amount)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showOpenKas && <OpenKasModal onClose={() => setShowOpenKas(false)} onOpened={() => setShowOpenKas(false)} />}
      {showCloseKas && <CloseKasModal onClose={() => setShowCloseKas(false)} onClosed={() => setShowCloseKas(false)} />}
      {showCashFlowForm && <CashFlowForm type={showCashFlowForm} onClose={() => setShowCashFlowForm(null)} />}
    </div>
  );
}
