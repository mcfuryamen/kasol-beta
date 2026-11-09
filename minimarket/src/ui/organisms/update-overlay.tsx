import { signal } from "@preact/signals";

/**
 * Overlay "Ada Versi Baru" — port pola kaki5:
 * - Service worker dipasang dengan registerType "prompt" (BUKAN autoUpdate),
 *   jadi versi baru tidak pernah mengambil alih aplikasi secara tiba-tiba di
 *   tengah transaksi kasir.
 * - Overlay ini satu-satunya pintu memasang versi baru: klik OKE = reload.
 * - Tanpa OKE, SW baru tetap menunggu (waiting) dan aplikasi terus berjalan
 *   di versi lama yang stabil.
 */
export const updatePending = signal(false);

let applyUpdate: (() => void) | null = null;

/** Diikat dari main.tsx — fungsi updateSW(true) dari virtual:pwa-register. */
export function bindUpdateInstaller(fn: () => void): void {
  applyUpdate = fn;
}

export function UpdateOverlay() {
  if (!updatePending.value) return null;

  const apply = () => {
    updatePending.value = false;
    if (applyUpdate) applyUpdate();
    else window.location.reload();
  };

  return (
    <div
      class="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ background: "linear-gradient(160deg, #FB923C 0%, #F97316 55%, #EA580C 100%)" }}
    >
      <div class="bg-white/95 dark:bg-gray-900/95 rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center">
        <img src="/logo.png" alt="Kasir Solo" class="w-16 h-16 rounded-full mx-auto mb-3 shadow-md object-contain bg-white" />
        <h2 class="text-lg font-black text-gray-900 dark:text-gray-100">Ada Versi Baru! 🔄</h2>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
          Pembaruan sudah selesai diunduh. Klik OKE untuk memuat versi terbaru — hanya butuh beberapa detik.
        </p>
        <button
          onClick={apply}
          class="mt-5 w-full py-3 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-bold text-sm shadow-md transition-colors"
        >
          OKE
        </button>
      </div>
    </div>
  );
}
