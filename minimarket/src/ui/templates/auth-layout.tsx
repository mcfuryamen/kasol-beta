import { JSX } from "preact";
import { DarkModeSync } from "@/logic/hooks/use-dark-mode";
import { ToastContainer } from "@/ui/molecules/toast";

export function AuthLayout({ children }: { children: JSX.Element }) {
  return (
    <div class="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <DarkModeSync />
      <div class="min-h-screen grid grid-cols-1 lg:grid-cols-2 gap-0">

        {/* ── Left branding panel — hidden on mobile ── */}
        <div class="hidden lg:flex flex-col justify-center bg-gradient-to-br from-orange-500 via-orange-500 to-orange-600 text-white p-8 relative overflow-hidden">
          {/* Layered decorative blobs */}
          <div class="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div class="absolute -bottom-16 -left-16 w-64 h-64 bg-orange-400/30 rounded-full blur-3xl" />

          {/* Grid dot pattern overlay */}
          <div class="absolute inset-0 opacity-[0.06]"
            style="background-image: radial-gradient(circle, #fff 1px, transparent 1px); background-size: 1.5rem 1.5rem;" />

          <div class="relative z-10 max-w-md mx-auto space-y-5">
            {/* Logo + wordmark */}
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-xl ring-1 ring-white/20">
                <img src="/logo.png" alt="Logo" class="w-9 h-9 object-contain" />
              </div>
              <div>
                <h1 class="text-2xl font-black tracking-tight leading-none">Kasir Solo</h1>
                <p class="text-orange-100 font-semibold text-xs">Minimarket</p>
              </div>
            </div>

            {/* Tagline */}
            <div class="space-y-1.5">
              <p class="text-xl font-bold leading-snug text-white">
                Kelola minimarket<br />lebih <span class="text-orange-200">cepat &amp; cerdas.</span>
              </p>
              <p class="text-orange-100/80 text-xs leading-relaxed">
                Sistem POS lengkap — dari kios hingga minimarket modern.
              </p>
            </div>

            {/* Feature pills */}
            <div class="flex flex-wrap gap-1.5">
              {[
                'Kasir &amp; Kasbon',
                'Stok Real-time',
                'Laporan Keuangan',
                'Multi-staff',
              ].map(f => (
                <span key={f} class="px-2.5 py-1 bg-white/15 backdrop-blur-sm rounded-full text-xs font-semibold text-white ring-1 ring-white/20">
                  {f}
                </span>
              ))}
            </div>

            {/* Stats row */}
            <div class="flex gap-5">
              {[['10rb+', 'Transaksi'], ['99.9%', 'Uptime'], ['500+', 'Toko']].map(([num, label]) => (
                <div key={label} class="text-center">
                  <p class="text-lg font-black text-white">{num}</p>
                  <p class="text-orange-200 text-xs font-medium">{label}</p>
                </div>
              ))}
            </div>

            {/* Bottom trust badge */}
            <div class="flex items-center gap-2">
              <div class="flex -space-x-1.5">
                {['bg-orange-300', 'bg-orange-200', 'bg-orange-100'].map((c, i) => (
                  <div key={i} class={`w-5 h-5 rounded-full ring-2 ring-orange-500 ${c}`} />
                ))}
              </div>
              <p class="text-orange-100 text-xs">Dipercaya <strong>500+</strong> pemilik toko</p>
            </div>
          </div>
        </div>

        {/* ── Right form panel ── */}
        <div class="flex items-center justify-center p-4 lg:p-8">
          <div class="w-full max-w-md">
            {/* Mobile logo — shown only when left panel is hidden */}
            <div class="lg:hidden flex flex-col items-center mb-5">
              <div class="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg mb-2">
                <img src="/logo.png" alt="Logo" class="w-8 h-8 object-contain" />
              </div>
              <h1 class="text-xl font-black text-gray-900 dark:text-white">Kasir Solo</h1>
              <p class="text-orange-500 font-semibold text-xs">Minimarket</p>
            </div>
            {children}
          </div>
        </div>

      </div>
      {/* Toast harus ada di layout auth juga — dulu error login/daftar tak pernah tampil */}
      <ToastContainer />
    </div>
  );
}
