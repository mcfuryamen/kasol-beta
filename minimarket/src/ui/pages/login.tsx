import { useState } from "preact/hooks";
import { authService, demoUsers } from "@/logic/services/auth-service";
import { isDemoMode } from "@/data/supabase";
import { showToast } from "@/ui/molecules/toast";
import { Button } from "@/ui/atoms/button";
import { Input } from "@/ui/atoms/input";
import { Icons } from "@/ui/atoms/icon";
import { RoleBadge } from "@/ui/molecules/role-badge";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  const handleLogin = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    const { user, error } = await authService.login(email, password);
    setLoading(false);
    if (error) showToast(error, "error");
  };

  const handleDemoLogin = async (userId: string) => {
    setLoading(true);
    await authService.loginAsDemo(userId);
    setLoading(false);
  };

  return (
    <div class="w-full max-w-md">
      {/* Card */}
      <div class="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header banner */}
        <div class="bg-gradient-to-r from-orange-500 to-orange-600 px-8 py-8 text-white text-center">
          <div class="flex justify-center mb-4">
            <div class="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
              <img src="/logo.png" alt="Logo" class="w-12 h-12 object-contain" />
            </div>
          </div>
          <h1 class="text-2xl font-black">Kasir Solo</h1>
          <p class="text-orange-100 font-semibold text-lg">Minimarket</p>
          <p class="text-orange-200 text-xs mt-1">Solusi POS untuk Minimarket Modern</p>
        </div>

        <div class="p-8">
          {isDemoMode ? (
            <div class="mb-6 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-200 dark:border-primary-800 text-center">
              <p class="text-xs font-semibold text-primary-600 dark:text-primary-400 mb-1">MODE DEMO AKTIF</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">Gunakan email demo dan password <strong>demo123</strong></p>
            </div>
          ) : null}

          <form onSubmit={handleLogin} class="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onInput={(e: any) => setEmail(e.target.value)}
              placeholder="email@contoh.com"
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
            <Button type="submit" variant="primary" fullWidth loading={loading} size="lg">
              Masuk
            </Button>
          </form>

          <div class="relative my-6">
            <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-gray-200 dark:border-gray-600" /></div>
            <div class="relative text-center"><span class="px-4 bg-white dark:bg-gray-800 text-xs text-gray-400">atau</span></div>
          </div>

          <Button variant="outline" fullWidth onClick={() => setShowDemo(!showDemo)} size="md" icon={<Icons.Zap size={16} />}>
            Masuk sebagai Demo
          </Button>

          {showDemo && (
            <div class="mt-4 space-y-2">
              {demoUsers.map(u => (
                <button
                  key={u.id}
                  onClick={() => handleDemoLogin(u.id)}
                  class="w-full flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-xl hover:border-primary-300 dark:hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all text-left group"
                >
                  <div class="w-9 h-9 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 font-bold text-sm flex-shrink-0">
                    {u.name.split(" ").map((n: string) => n[0]).join("").slice(0,2)}
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 truncate">{u.name}</p>
                    <p class="text-xs text-gray-400">{u.email}</p>
                  </div>
                  <RoleBadge role={u.role} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <p class="text-center text-xs text-gray-400 mt-6">
        Kasir Solo Minimarket v1.0 · Powered by Preact + Supabase
      </p>
    </div>
  );
}
