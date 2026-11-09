/**
 * minimarket/src/logic/services/license/ui.tsx
 * License UI (Preact) — porting VISUAL dari kaki5/js/license.ui.js.
 *
 * Semua class CSS disamakan persis dengan kaki5:
 * - .license-steps / .license-step / .license-step-dot / .license-step-line
 * - .license-state-card + .license-card-{trial,active,pending,revoked}
 * - .trial-badge + .trial-label-xs + .trial-value-sm
 * - .license-progress + .license-header + .license-icon + .license-title
 * - .license-description + .license-actions + .badge + .lic-unit
 * - .license-hint + .license-active-actions
 *
 * Prinsip kaki5: chip/gate = cermin getLicenseStatus(), revoked full-lock,
 * quota habis = banner (bukan lock).
 */
import { JSX } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { openModal, closeAllModals, setHardGate } from './modal';
import {
  getLicenseStatus, isLicensed, getDeviceIdentity,
  type LicenseStatus,
} from './logic';
import { syncLicenseStatus } from './sync';

// ─── License step indicator (PERSIS dengan kaki5 license.ui.js:41-47) ────────
function LicenseSteps({ activeStep }: { activeStep: number }) {
  const steps = [['1', 'Gratis'], ['2', 'Beli'], ['3', 'Proses'], ['4', 'Aktif']];
  return (
    <div class="license-steps" aria-label="Tahapan lisensi">
      {steps.map(([number, label], index) => {
        const stepNum = index + 1;
        const isDone = stepNum < activeStep;
        const isCurrent = stepNum === activeStep;
        return (
          <div key={number}>
            <div class={`license-step ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''}`}>
              <span class="license-step-dot">{isDone ? '✓' : number}</span>
              <span>{label}</span>
            </div>
            {index < steps.length - 1 && <span class="license-step-line" />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Helper: Device ID baris (licUnitHtml kaki5:53-58) ───────────────────────
// kfs11 = font-size 11px, ktext3 = color var(--text3) / #9ca3af
function LicUnitHtml({ deviceCode }: { deviceCode: string }) {
  if (!deviceCode) return null;
  return (
    <div class="lic-unit" style={{ fontSize: '11px', color: '#9ca3af' }}>
      ID Perangkat: <span class="font-mono">{deviceCode}</span>
    </div>
  );
}

// ─── Helper: Badge (pola kaki5 .badge) ───────────────────────────────────────
function Badge({ variant, children, compact }: { variant: 'green' | 'red' | 'amber' | 'orange'; children: string; compact?: boolean }) {
  const colorMap = {
    green:  'bg-green-100 text-green-700 border-green-300',
    red:    'bg-red-100 text-red-700 border-red-300',
    amber:  'bg-amber-100 text-amber-700 border-amber-300',
    orange: 'bg-orange-100 text-orange-700 border-orange-300',
  };
  return (
    <span class={`badge ${colorMap[variant]}${compact ? ' compact' : ''}`}>
      {children}
    </span>
  );
}

// ─── License Sheet cards ──────────────────────────────────────────────────────

function TrialCard({ status }: { status: LicenseStatus }): JSX.Element {
  const { txQuota = 0, txCount = 0, txRemaining = 0, txAdjust = 0, unitId = '' } = status;
  const remaining = Math.max(0, txRemaining);
  const used = Math.max(0, txQuota - remaining);
  const pct = txQuota > 0 ? Math.min(100, Math.max(4, Math.round((remaining / txQuota) * 100))) : 0;
  const habis = remaining === 0;
  // Bonus admin adjustment text — persis kaki5 licenseStatusHtml:82
  const adjText = txAdjust ? ` · termasuk bonus admin ${txAdjust > 0 ? '+' : ''}${txAdjust}` : '';

  return (
    <div class="card license-card-trial license-state-card">
      <LicenseSteps activeStep={1} />
      <div class="license-header">
        <div class="license-icon">🎁</div>
        <div class="license-title">Kuota Transaksi Gratis</div>
        <Badge variant={habis ? 'red' : remaining <= 10 ? 'orange' : 'green'}>
          {habis ? 'Habis bulan ini' : `Sisa ${remaining} transaksi`}
        </Badge>
      </div>
      <div class="license-description">
        Setiap bulan kamu dapat <b>{txQuota} transaksi</b> gratis tanpa batas waktu —
        kuota segar lagi di awal bulan. Terpakai <b>{used}</b> bulan ini{adjText}.
      </div>
      {/* animation:none = bar statis (bukan animasi bergerak), persis kaki5:83 */}
      <div class="license-progress"><span style={{ width: pct + '%', animation: 'none' }} /></div>
      <div class="license-actions license-actions-row">
        <button class="btn btn-primary" data-action="open-purchase-sheet">
          💳 Beli Lisensi
        </button>
      </div>
      <LicUnitHtml deviceCode={unitId} />
    </div>
  );
}

function ActiveCard({ serial, expiryLabel, deviceCode }: { serial: string; expiryLabel?: string; deviceCode: string }): JSX.Element {
  return (
    <div class="card license-card-active license-state-card">
      <LicenseSteps activeStep={4} />
      <div class="license-icon">✅</div>
      <Badge variant="green" compact>✓ Lisensi Aktif</Badge>
      <p class="license-key"><b>{serial || '—'}</b></p>
      <LicUnitHtml deviceCode={deviceCode} />
      <p class="license-expiry">{expiryLabel ? `Masa berlaku: ${expiryLabel}` : 'Berlaku seumur hidup'}</p>
      <p class="license-desc">Semua fitur sudah terbuka. Terima kasih sudah memakai Kasir Solo.</p>
      <div class="license-active-actions">
        <button class="btn btn-outline" data-action="check-license-status">🔄 Refresh Status</button>
      </div>
    </div>
  );
}

function PendingCard({ deviceCode }: { deviceCode: string }): JSX.Element {
  return (
    <div class="card license-card-pending license-state-card">
      <LicenseSteps activeStep={3} />
      <div class="license-header">
        <div class="license-icon">⏳</div>
        <div class="license-title">Aktivasi sedang diproses</div>
        <Badge variant="amber">Menunggu admin</Badge>
      </div>
      <div class="license-description">
        Bukti pembayaran sudah diterima. Lisensi akan aktif otomatis setelah verifikasi selesai.
      </div>
      {/* Progress bar kosong (animating), persis kaki5:195 */}
      <div class="license-progress"><span /></div>
      <div class="license-actions license-actions-primary">
        <button class="btn btn-primary" data-action="check-license-status">🔄 Cek Status Sekarang</button>
      </div>
      <div class="license-hint">Tidak perlu kirim ulang bukti pembayaran.</div>
      <LicUnitHtml deviceCode={deviceCode} />
    </div>
  );
}

function RevokedCard({ deviceCode }: { deviceCode: string }): JSX.Element {
  // kmt8 = margin-top 8px (ekivalen DaisyUI .mt-2 ≈ 0.5rem = 8px)
  return (
    <div class="card license-card-revoked license-state-card">
      <div class="license-icon">🚫</div>
      <Badge variant="red" compact>✖ Lisensi Dinonaktifkan</Badge>
      <div class="license-title" style={{ marginTop: '8px' }}>Lisensi Dicabut</div>
      <p class="license-desc">
        Lisensi untuk perangkat ini telah <b>dinonaktifkan</b> oleh admin.
        Aplikasi tidak dapat digunakan sampai lisensi dipulihkan.
      </p>
      <LicUnitHtml deviceCode={deviceCode} />
      <div class="license-actions license-actions-row">
        <button class="btn btn-primary" data-action="open-purchase-sheet">💳 Beli Lisensi</button>
      </div>
    </div>
  );
}

// ─── Full License Sheet ───────────────────────────────────────────────────────
interface LicenseSheetProps {
  status: LicenseStatus;
  onRefresh?: () => void;
}

export function LicenseSheet({ status, onRefresh }: LicenseSheetProps): JSX.Element {
  const { level, serial, txQuota, txRemaining, txAdjust, expiryLabel, unitId } = status;
  const [busy, setBusy] = useState(false);

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setBusy(true);
    await onRefresh();
    setBusy(false);
  };

  if (level === 'active') {
    return (
      <div class="p-6">
        <ActiveCard serial={serial || unitId} expiryLabel={expiryLabel} deviceCode={unitId} />
        <button
          onClick={() => void handleRefresh()}
          disabled={busy}
          class="w-full mt-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm transition-colors disabled:opacity-60"
        >
          {busy ? 'Memeriksa...' : '🔄 Refresh Status'}
        </button>
      </div>
    );
  }

  if (level === 'pending') {
    return (
      <div class="p-6">
        <PendingCard deviceCode={unitId} />
        <button
          onClick={() => void handleRefresh()}
          disabled={busy}
          class="w-full mt-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm transition-colors disabled:opacity-60"
        >
          {busy ? 'Memeriksa...' : '🔄 Cek Status Sekarang'}
        </button>
      </div>
    );
  }

  if (level === 'revoked') {
    return (
      <div class="p-6">
        <RevokedCard deviceCode={unitId} />
        <button
          onClick={() => void handleRefresh()}
          disabled={busy}
          class="w-full mt-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm transition-colors disabled:opacity-60"
        >
          {busy ? 'Memeriksa...' : '🔄 Cek Status Sekarang'}
        </button>
      </div>
    );
  }

  // trial / expired — tampilkan kartu quota
  return (
    <div class="p-6">
      <TrialCard status={{ ...status, txAdjust: txAdjust ?? 0 }} />
      <button
        onClick={() => void handleRefresh()}
        disabled={busy}
        class="w-full mt-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm transition-colors disabled:opacity-60"
      >
        {busy ? 'Memeriksa...' : '🔄 Refresh'}
      </button>
    </div>
  );
}

/** Buka sheet lisensi penuh — dipanggil dari chip header atau settings. */
export function openLicenseSheet(): void {
  void getLicenseStatus().then(status => {
    openModal(
      <LicenseSheet status={status} onRefresh={async () => {
        await syncLicenseStatus({ force: true });
        closeAllModals();
        setTimeout(() => openLicenseSheet(), 50);
      }} />,
      { title: 'Status Lisensi', showClose: true, overlayClose: true }
    );
  });
}

// ─── Icons ───────────────────────────────────────────────────────────────────
const IconCheck = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);
const IconX = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);
const IconClock = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);

// ─── License Chip di header (PERSIS dengan kaki5 .trial-badge) ─────────────────
interface LicenseChipProps {
  level: string;
  txCount: number;
  txQuota: number;
  daysLeft?: number | null;
  onClick?: () => void;
}

export function LicenseStatusChip({ level, txCount, txQuota, daysLeft, onClick }: LicenseChipProps): JSX.Element {
  const remaining = Math.max(0, (txQuota || 0) - (txCount || 0));
  const isWarn = remaining <= 10 || level === 'expired' || level === 'revoked';

  let labelTop: string;
  let labelBottom: string;

  if (level === 'active') {
    labelTop = 'LISENSI';
    labelBottom = '✓ Aktif';
  } else if (level === 'trial') {
    labelTop = 'GRATIS';
    labelBottom = `${remaining} trx`;
  } else if (level === 'expired') {
    labelTop = 'GRATIS';
    labelBottom = 'Habis';
  } else if (level === 'revoked') {
    labelTop = 'LISENSI';
    labelBottom = '✕ Dicabut';
  } else if (level === 'pending') {
    labelTop = 'LISENSI';
    labelBottom = '⏳ Proses';
  } else {
    labelTop = 'GRATIS';
    labelBottom = '—';
  }

  return (
    <button
      type="button"
      onClick={onClick}
      class={`trial-badge${isWarn ? ' warn' : ''}`}
      title="Klik untuk melihat lisensi"
    >
      <div class="trial-label-xs">{labelTop}</div>
      <div class="trial-value-sm">{labelBottom}</div>
    </button>
  );
}

// ─── Layar kunci "Lisensi Dicabut" full-page ──────────────────────────────────
export function RevokedLockScreen({ message }: { message?: string }): JSX.Element {
  const [deviceCode, setDeviceCode] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setHardGate(true);
    void getDeviceIdentity().then(id => setDeviceCode(id.deviceCode)).catch(() => { /* halaman tetap tampil tanpa ID */ });

    // Polling 60 dtk — bila admin memulihkan, buka tanpa reload
    const recheck = async () => {
      try {
        await syncLicenseStatus({ force: true });
        if (await isLicensed()) {
          const st = await getLicenseStatus();
          if (st.level !== 'revoked') window.location.reload();
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
        {/* Logo */}
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
          <br />Ada masalah? Hubungi admin — sertakan ID perangkat di atas.
        </div>
      </div>
    </div>
  );
}

// ─── License Status Bar di halaman Pengaturan (pola licenseStatusHtml kaki5) ──
interface LicenseStatusBarProps {
  status: LicenseStatus;
  onActivateClick?: () => void;
}

export function LicenseStatusBar({ status, onActivateClick }: LicenseStatusBarProps): JSX.Element {
  const { level, serial, txQuota = 0, txCount = 0, txRemaining = 0, expiryLabel, unitId = '' } = status;

  if (level === 'active') {
    return (
      <div class="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
        <div class="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center text-green-600 flex-shrink-0"><IconCheck size={16}/></div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-green-800">
            Lisensi Aktif{expiryLabel ? ` · ${expiryLabel}` : ''}
          </p>
          <p class="text-xs text-green-600 font-mono truncate">{serial || unitId}</p>
        </div>
        <span class="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">✓ Aktif</span>
      </div>
    );
  }

  if (level === 'trial') {
    const remaining = Math.max(0, txRemaining);
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
        <span class="text-xs font-semibold text-yellow-700 bg-yellow-200 px-2 py-0.5 rounded-full flex-shrink-0">Beli →</span>
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
        <div class="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600 flex-shrink-0"><IconX size={16}/></div>
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
    <button
      type="button"
      onClick={onActivateClick}
      class="w-full flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-left hover:bg-red-100 transition-colors"
    >
      <div class="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600 flex-shrink-0"><IconX size={16}/></div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-red-800">{level === 'revoked' ? 'Lisensi Dinonaktifkan' : 'Menunggu verifikasi…'}</p>
        <p class="text-xs text-red-600 font-mono truncate">{unitId}</p>
      </div>
      <span class="text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full flex-shrink-0">Cek →</span>
    </button>
  );
}
