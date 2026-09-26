import { h } from 'preact';
import { useState, useCallback } from 'preact/hooks';

interface LoginModalProps {
  isOpen: boolean;
  defaultRole: string;
  onClose: () => void;
}

export function LoginModal({ isOpen, defaultRole, onClose }: LoginModalProps) {
  const [role, setRole] = useState(defaultRole);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = useCallback(async (e: Event) => {
    e.preventDefault();
    if (!name.trim()) { setError('Nama harus diisi'); return; }

    // Store session
    localStorage.setItem('tpa_session', JSON.stringify({ name: name.trim(), role }));

    // Redirect to appropriate app
    const urls: Record<string, string> = {
      admin: '/admin/',
      ustadz: '/guru/',
      wali: '/wali/',
    };
    window.location.href = urls[role] || '/admin/';
  }, [name, role]);

  if (!isOpen) return null;

  return (
    <div class="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-5" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl relative">
        <button onClick={onClose} class="absolute top-4 right-4 text-slate-400 text-xl hover:text-slate-600">✕</button>
        <div class="w-16 h-16 bg-brand-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg shadow-orange-200">🔐</div>
        <h2 class="text-center text-xl font-extrabold mb-1">Masuk Sistem</h2>
        <p class="text-center text-sm text-slate-500 mb-5">Akses portal sesuai peran Anda</p>

        {error && <div class="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">{error}</div>}

        <form onSubmit={handleSubmit} class="space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Masuk Sebagai</label>
            <select
              value={role}
              onChange={(e: any) => setRole(e.target.value)}
              class="w-full px-4 py-3 border border-slate-200 rounded-xl text-base focus:border-brand-500 focus:ring-2 focus:ring-orange-100 outline-none"
            >
              <option value="admin">👑 Admin / Kepala TPA</option>
              <option value="ustadz">👳 Ustadz / Pengajar</option>
              <option value="wali">👨‍👩‍👧 Wali Santri</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Nama Anda</label>
            <input
              type="text"
              value={name}
              onInput={(e: any) => { setName(e.target.value); setError(''); }}
              placeholder="Ketik nama..."
              class="w-full px-4 py-3 border border-slate-200 rounded-xl text-base focus:border-brand-500 focus:ring-2 focus:ring-orange-100 outline-none"
            />
          </div>
          <button type="submit" class="w-full py-3.5 bg-brand-500 text-white font-bold rounded-xl text-base hover:bg-brand-700 transition-colors active:scale-[.98]">
            Masuk →
          </button>
        </form>
        <p class="text-center text-xs text-slate-400 mt-5">Powered by Kasir Solo - TPA</p>
      </div>
    </div>
  );
}
