/**
 * minimarket/src/logic/services/license/ui.tsx
 * License UI (Preact) — port kaki5/js/license.ui.js.
 *
 * Prinsip kaki5 yang dipertahankan:
 *  - Chip/gate = cermin PERSIS getLicenseStatus() (satu sumber kebenaran).
 *  - Revoked = halaman penuh (lock), dengan tombol aktivasi manual; saat
 *    lock tampil, layer UI rutin cek ulang ke cloud supaya pemulihan admin
 *    (status → 'aktif') langsung membuka tanpa reload (polling kaki5 60 dtk).
 *  - Trial habis / kedaluwarsa = BANNER (aplikasi tetap bisa dieksplor),
 *    bukan lock — transaksi diblokir di POS.
 */
import { JSX } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { openModal, closeAllModals, setHardGate } from './modal';
import {
  activateSerial, getLicenseStatus, isLicensed, getDeviceIdentity,
  type LicenseStatus,
} from './logic';
import { syncLicenseStatus } from './sync';

const WA_SUPPORT = '628816566935'; // sama dengan kaki5 — owner yang sama

// ─── Icons (inline SVG, tanpa dependensi eksternal) ─────────────────────────
const IconCheck = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);
const IconX = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);
const IconKey = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
);
const IconClock = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);

// ─── Chip status (cermin getLicenseStatus — pola updateTrialChip kaki5) ─────
interface LicenseChipProps {
  level: string;
  txCount: number;
  txQuota: number;
  daysLeft?: number | null;
  onClick?: () => void;
}

export function LicenseStatusChip({ level, txCount, txQuota, daysLeft, onClick }: LicenseChipProps): JSX.Element {
  const configs: Record<string, { label: string; cls: string; icon: JSX.Element; warn?: boolean }> = {
    trial: { label: `GRATIS ${Math.max(0, (txQuota || 0) - (txCount || 0))} trx`, cls: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: <IconClock size={12}/>, warn: (txQuota - txCount) <= 10 },
    active: { label: 'LISENSI ✓', cls: 'bg-green-100 text-green-800 border-green-300', icon: <IconCheck size={12}/> },
    expired: { label: 'GRATIS Habis', cls: 'bg-red-100 text-red-800 border-red-300', icon: <IconX size={12}/>, warn: true },
    revoked: { label: '✕ Dicabut', cls: 'bg-red-100 text-red-800 border-red-300', icon: <IconX size={12}/>, warn: true },
    pending: { label: 'Menunggu', cls: 'bg-gray-100 text-gray-600 border-gray-300', icon: <IconClock size={12}/> },
  };
  const cfg = configs[level] ?? configs.pending;

  return (
    <button
      type="button"
      onClick={onClick}
      class={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${cfg.cls} transition-opacity hover:opacity-80`}
      title="Klik untuk melihat lisensi"
    >
      {cfg.icon}
      <span>{cfg.label}</span>
      {level === 'active' && daysLeft != null && daysLeft > 0 && (
        <span class="opacity-75">· {daysLeft}h</span>
      )}
    </button>
  );
}

// ─── Modal aktivasi serial (fallback offline — pola kaki5) ──────────────────
interface ActivationModalProps {
  unitId: string;
  onSuccess?: () => void;
  onClose?: () => void;
}

export function ActivationModal({ unitId, onSuccess, onClose }: ActivationModalProps): JSX.Element {
  const [serial, setSerial] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'err' | 'ok'; text: string } | null>(null);

  const handleActivate = async () => {
    if (!serial.trim()) { setMsg({ kind: 'err', text: 'Masukkan serial terlebih dahulu.' }); return; }
    setLoading(true);
    setMsg(null);
    const result = await activateSerial(serial.trim());
    setLoading(false);
    if (result.ok) {
      onSuccess?.();
      onClose?.();
      closeAllModals();
    } else {
      setMsg({ kind: 'err', text: result.message || 'Aktivasi gagal.' });
    }
  };

  return (
    <div class="p-6">
      <div class="flex items-center gap-3 mb-5">
        <div class="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 flex-shrink-0">
          <IconKey size={20}/>
        </div>
        <div>
          <h2 class="font-bold text-gray-900 text-base m-0">Aktivasi Lisensi</h2>
          <p class="text-xs text-gray-500 m-0">Pembelian normal: bayar → admin verifikasi → aktif otomatis. Ini fallback offline.</p>
        </div>
      </div>

      <div class="bg-gray-50 rounded-xl p-3 mb-4">
        <p class="text-xs text-gray-500 mb-1">ID Perangkat</p>
        <p class="font-mono text-sm text-gray-700 m-0 select-all">{unitId}</p>
      </div>

      <div class="mb-3">
        <label class="block text-xs font-semibold text-gray-600 mb-1.5">Serial Lisensi</label>
        <input
          type="text"
          value={serial}
          onInput={(e: any) => setSerial(String(e.target.value).toUpperCase())}
          placeholder="MML-XXXX-XXXX-YY-SIGGGG"
          class="w-full px-3 py-2.5 text-sm font-mono rounded-xl border border-gray-200
                 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent
                 placeholder:text-gray-300 transition-all"
          autoFocus
          onKeyDown={(e: any) => { if (e.key === 'Enter') void handleActivate(); }}
        />
        {msg && (
          <p class={`flex items-center gap-1.5 text-xs mt-1.5 ${msg.kind === 'err' ? 'text-red-600' : 'text-green-600'}`}>
            {msg.kind === 'err' ? <IconX size={12}/> : <IconCheck size={12}/>} {msg.text}
          </p>
        )}
      </div>

      <button
        onClick={() => void handleActivate()}
        disabled={loading}
        class="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600
               text-white font-semibold text-sm shadow-sm
               hover:from-orange-600 hover:to-orange-700
               disabled:opacity-60 disabled:cursor-not-allowed transition-all"
      >
        {loading ? 'Mengaktifkan...' : 'Aktivasi Sekarang'}
      </button>

      <p class="text-center text-xs text-gray-400 mt-3">
        Beli lisensi: <a class="text-green-600 underline" href={`https://wa.me/${WA_SUPPORT}`} target="_blank" rel="noreferrer">WhatsApp admin</a> — sertakan ID perangkat
      </p>
    </div>
  );
}

export function showActivationModal(unitId: string, onSuccess?: () => void): void {
  openModal(
    <ActivationModal unitId={unitId} onSuccess={onSuccess} />,
    { title: 'Aktivasi Lisensi', showClose: true, overlayClose: true }
  );
}

// ─── Layar kunci "Lisensi Dicabut" (pola revokedPageHtml + cek ulang cloud) ─
export function RevokedLockScreen({ message }: { message?: string }): JSX.Element {
  const [deviceCode, setDeviceCode] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setHardGate(true);
    void getDeviceIdentity().then(id => setDeviceCode(id.deviceCode)).catch(() => { /* halaman tetap tampil tanpa ID */ });

    // Polling pemulihan (60 dtk — pola kaki5): kalau admin sudah memulihkan
    // status cloud, buka kunci tanpa perlu reload.
    const recheck = async () => {
      try {
        await syncLicenseStatus({ force: true });
        if (await isLicensed()) {
          const st = await getLicenseStatus();
          if (st.level !== 'revoked') {
            window.location.reload(); // app.tsx render ulang dari state bersih
          }
        }
      } catch { /* offline — tetap terkunci */ }
    };
    timer.current = setInterval(() => void recheck(), 60_000);
    return () => {
      if (timer.current) clearInterval(timer.current);
      setHardGate(false);
    };
  }, []);

  const handleRefresh = async () => {
    setBusy(true);
    setNote(null);
    await syncLicenseStatus({ force: true });
    const st = await getLicenseStatus();
    setBusy(false);
    if (st.level !== 'revoked') window.location.reload();
    else setNote('Masih dicabut oleh admin. Pulih setelah pembayaran diverifikasi.');
  };

  return (
    <div class="min-h-screen bg-white flex flex-col items-center justify-center p-6">
      <div class="w-full max-w-sm text-center">
        <div class="w-20 h-20 rounded-3xl bg-orange-100 flex items-center justify-center mx-auto mb-3 text-orange-600">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>
        </div>
        <div class="text-xl font-black text-gray-900">Kasir Solo</div>
        <div class="text-sm text-gray-500 mb-4">Minimarket Edition</div>
        <div class="text-base font-extrabold text-red-600 mb-2">Lisensi Dinonaktifkan</div>
        <p class="text-sm text-gray-500 mb-5 leading-relaxed">
          {message || 'Lisensi untuk perangkat ini telah dicabut oleh admin.'}
          <br />Beli lisensi baru — aktivasi otomatis setelah pembayaran diverifikasi.
        </p>

        <button
          onClick={() => void handleRefresh()}
          disabled={busy}
          class="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold text-sm shadow-sm disabled:opacity-60"
        >
          {busy ? 'Memeriksa...' : '🔄 Cek Status Sekarang'}
        </button>
        {note && <p class="text-xs text-red-600 mt-2">{note}</p>}

        <div class="text-xs text-gray-400 mt-6 leading-relaxed">
          ID Perangkat: <b class="text-gray-500 select-all">{deviceCode || '—'}</b>
          <br />Ada masalah? Hubungi{' '}
          <a href={`https://wa.me/${WA_SUPPORT}`} class="text-green-600 no-underline">WhatsApp</a>
          {' '}— sertakan ID perangkat
        </div>
      </div>
    </div>
  );
}

// ─── Kartu status lisensi (Pengaturan/Dashboard — pola licenseStatusHtml) ───
interface LicenseStatusBarProps {
  status: LicenseStatus;
  onActivateClick?: () => void;
}

export function LicenseStatusBar({ status, onActivateClick }: LicenseStatusBarProps): JSX.Element {
  const { level, serial, txCount, txQuota, daysUntilExpiry, expiryLabel } = status;

  if (level === 'active') {
    return (
      <div class="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
        <div class="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center text-green-600"><IconCheck size={16}/></div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-green-800">Lisensi Aktif{expiryLabel ? ` · ${expiryLabel}` : ''}</p>
          <p class="text-xs text-green-600 font-mono truncate">{serial || status.deviceCode}</p>
        </div>
      </div>
    );
  }

  if (level === 'trial') {
    const remaining = Math.max(0, (txQuota || 0) - (txCount || 0));
    const pct = txQuota > 0 ? Math.min(100, Math.max(4, Math.round((remaining / txQuota) * 100))) : 0;
    return (
      <button
        type="button"
        onClick={onActivateClick}
        class="w-full flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl hover:bg-yellow-100 transition-colors text-left"
      >
        <div class="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center text-yellow-600 flex-shrink-0"><IconClock size={16}/></div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-yellow-800">Kuota Gratis — sisa {remaining} transaksi</p>
          <div class="h-1.5 rounded-full bg-yellow-200 overflow-hidden mt-1.5">
            <div class="h-full rounded-full bg-green-500" style={{ width: pct + '%' }} />
          </div>
          <p class="text-xs text-yellow-600 mt-1">Kuota segar tiap awal bulan · {txCount}/{txQuota} terpakai</p>
        </div>
        <span class="text-xs font-semibold text-yellow-700 bg-yellow-200 px-2 py-0.5 rounded-full flex-shrink-0">Pilih paket →</span>
      </button>
    );
  }

  if (level === 'expired') {
    return (
      <button
        type="button"
        onClick={onActivateClick}
        class="w-full flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-xl text-left hover:bg-orange-100 transition-colors"
      >
        <div class="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600"><IconX size={16}/></div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-orange-800">Kuota gratis bulan ini habis</p>
          <p class="text-xs text-orange-600">Transaksi baru diblokir sampai bulan depan atau beli lisensi.</p>
        </div>
        <span class="text-xs font-semibold text-orange-700 bg-orange-200 px-2 py-0.5 rounded-full flex-shrink-0">Aktifkan →</span>
      </button>
    );
  }

  // revoked / pending
  return (
    <div class="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
      <div class="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600"><IconX size={16}/></div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-red-800">{level === 'revoked' ? 'Lisensi Dinonaktifkan' : 'Menunggu verifikasi…'}</p>
        <p class="text-xs text-red-600 font-mono truncate">{status.deviceCode}</p>
      </div>
    </div>
  );
}
