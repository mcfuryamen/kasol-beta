import { useState } from "preact/hooks";
import { authService, demoUsers } from "@/logic/services/auth-service";
import { isDemoMode } from "@/data/supabase";
import { showToast } from "@/ui/molecules/toast";
import { Button } from "@/ui/atoms/button";
import { Input } from "@/ui/atoms/input";
import { Icons } from "@/ui/atoms/icon";
import { RoleBadge } from "@/ui/molecules/role-badge";

type Mode = "login" | "register";

export function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  const switchMode = (m: Mode) => {
    setMode(m);
    setPhone(""); setPassword(""); setConfirm(""); setOwnerName(""); setAcceptedTerms(false);
    setShowDemo(false);
  };

  const handleLogin = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    const { user, error } = await authService.login(phone, password);
    setLoading(false);
    if (error) showToast(error, "error");
  };

  const handleRegister = async (e: Event) => {
    e.preventDefault();
    if (!ownerName.trim()) { showToast("Nama pemilik wajib diisi", "error"); return; }
    if (!acceptedTerms) { showToast("Setujui Syarat & Ketentuan platform terlebih dahulu", "error"); return; }
    if (password !== confirm) { showToast("Konfirmasi kata sandi tidak cocok", "error"); return; }
    setLoading(true);
    const { ok, error } = await authService.register({ name: ownerName, phone, password });
    setLoading(false);
    if (!ok) { showToast(error || "Registrasi gagal", "error"); return; }
    showToast("Akun berhasil dibuat — silakan masuk dengan nomor WhatsApp dan kata sandi", "success");
    // Pindah ke form Masuk dengan nomor masih terisi supaya pemilik tinggal ketik sandi.
    setPassword(""); setConfirm("");
    setMode("login");
  };

  const handleDemoLogin = async (userId: string) => {
    setLoading(true);
    await authService.loginAsDemo(userId);
    setLoading(false);
  };

  const isRegister = mode === "register";

  return (
    <div class="w-full max-w-md">
      {/* Card */}
      <div class="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 ring-1 ring-gray-900/5 dark:ring-white/10 overflow-hidden">
        <div class="p-5 space-y-3">
          {isDemoMode ? (
            <div class="flex items-center justify-between p-2.5 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
              <div class="flex items-center gap-2">
                <span class="relative flex h-2 w-2">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                </span>
                <p class="text-xs font-bold text-orange-600 dark:text-orange-400">MODE DEMO AKTIF</p>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400">demo / <strong>demo123</strong></p>
            </div>
          ) : null}

          {/* Toggle Masuk / Daftar */}
          <div class="flex gap-1 bg-gray-100 dark:bg-gray-900/50 p-1 rounded-xl">
            {([["login", "Masuk"], ["register", "Daftar"]] as [Mode, string][]).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                class={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${mode === m ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {isRegister ? (
            <form onSubmit={handleRegister} class="space-y-3">
              <Input
                label="Nama Pemilik *"
                value={ownerName}
                onInput={(e: any) => setOwnerName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                autoComplete="name"
                icon={<Icons.User size={16} />}
              />
              <Input
                label="Nomor WhatsApp"
                type="tel"
                value={phone}
                onInput={(e: any) => setPhone(e.target.value)}
                placeholder="08xxxxxxxxxx"
                inputMode="tel"
                autoComplete="tel"
                icon={<Icons.User size={16} />}
              />
              <Input
                label="Kata Sandi"
                type="password"
                value={password}
                onInput={(e: any) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                icon={<Icons.Shield size={16} />}
              />
              <Input
                label="Ulangi Kata Sandi"
                type="password"
                value={confirm}
                onInput={(e: any) => setConfirm(e.target.value)}
                placeholder="••••••••"
                icon={<Icons.Shield size={16} />}
              />
              <label class="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300">
                <input type="checkbox" checked={acceptedTerms} onChange={(e: any) => setAcceptedTerms(e.currentTarget.checked)} class="mt-0.5 accent-orange-500" />
                <span>Saya menyetujui <button type="button" class="font-semibold text-orange-600 hover:underline" onClick={() => setShowTerms(true)}>Syarat & Ketentuan Platform</button>.</span>
              </label>
              <Button type="submit" variant="primary" fullWidth loading={loading} size="md">
                Buat Akun
              </Button>
              {isDemoMode ? (
                <p class="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
                  Mode demo: akun tersimpan di perangkat ini saja (tanpa server).
                </p>
              ) : null}
            </form>
          ) : (
            <>
              <form onSubmit={handleLogin} class="space-y-3">
                <Input
                  label="Nomor WhatsApp"
                  type="tel"
                  value={phone}
                  onInput={(e: any) => setPhone(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  inputMode="tel"
                  autoComplete="tel"
                  icon={<Icons.User size={16} />}
                />
                <Input
                  label="Kata Sandi"
                  type="password"
                  value={password}
                  onInput={(e: any) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  icon={<Icons.Shield size={16} />}
                />
                <Button type="submit" variant="primary" fullWidth loading={loading} size="md">
                  Masuk
                </Button>
              </form>

              {isDemoMode && <>
                <div class="relative">
                  <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-gray-200 dark:border-gray-600" /></div>
                  <div class="relative text-center"><span class="px-4 bg-white dark:bg-gray-800 text-xs text-gray-400">atau</span></div>
                </div>

                <Button variant="outline" fullWidth onClick={() => setShowDemo(!showDemo)} size="sm" icon={<Icons.Zap size={14} />}>
                  Masuk sebagai Demo
                </Button>
              </>}

              {isDemoMode && showDemo && (
                <div class="space-y-1.5">
                  {demoUsers.map(u => (
                    <button
                      key={u.id}
                      onClick={() => handleDemoLogin(u.id)}
                      class="w-full flex items-center gap-2.5 p-2 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-primary-300 dark:hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all text-left group"
                    >
                      <div class="w-7 h-7 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 font-bold text-xs flex-shrink-0">
                        {u.name.split(" ").map((n: string) => n[0]).join("").slice(0,2)}
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-xs font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 truncate">{u.name}</p>
                        <p class="text-xs text-gray-400">{u.phone || u.email}</p>
                      </div>
                      <RoleBadge role={u.role} />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showTerms && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="terms-title">
          <div class="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-800 p-5 shadow-xl">
            <div class="flex items-center justify-between mb-3">
              <h2 id="terms-title" class="text-lg font-bold text-gray-900 dark:text-gray-100">📜 Syarat & Ketentuan Platform</h2>
              <button type="button" onClick={() => setShowTerms(false)} class="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" aria-label="Tutup">✕</button>
            </div>
            <div class="space-y-3 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
              <p><b>1. Layanan.</b> Kasir Solo adalah aplikasi POS untuk mencatat transaksi, mengelola produk dan stok, laporan, kas, serta pencetakan nota.</p>
              <p><b>2. Akun.</b> Anda bertanggung jawab menjaga nomor WhatsApp dan kata sandi serta seluruh aktivitas pada akun.</p>
              <p><b>3. Data.</b> Gunakan aplikasi secara bertanggung jawab. Pastikan data transaksi dan data pelanggan yang dimasukkan memiliki dasar penggunaan yang sah.</p>
              <p><b>4. Lisensi dan kuota.</b> Fitur gratis dan berbayar mengikuti kuota, lisensi, dan ketentuan yang ditampilkan di dalam aplikasi.</p>
              <p><b>5. Perubahan.</b> Ketentuan dapat diperbarui. Penggunaan berkelanjutan setelah perubahan berarti menyetujui versi terbaru.</p>
              <p><b>6. Bantuan.</b> Hubungi pengelola platform melalui kanal bantuan yang tersedia di aplikasi jika mengalami kendala.</p>
            </div>
            <button type="button" onClick={() => { setAcceptedTerms(true); setShowTerms(false); }} class="mt-5 w-full rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600">Saya Setuju</button>
          </div>
        </div>
      )}

      <p class="text-center text-xs text-gray-400 mt-4">
        Kasir Solo <span class="text-gray-300 dark:text-gray-600">·</span> Minimarket v1.0
      </p>
    </div>
  );
}