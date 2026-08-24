import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';

interface NavbarProps { onLogin: () => void; }

export function Navbar({ onLogin }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const links = [
    { href: '#tentang', label: 'Tentang' },
    { href: '#program', label: 'Program' },
    { href: '#pengajar', label: 'Pengajar' },
    { href: '#pendaftaran', label: 'Pendaftaran' },
    { href: '#kontak', label: 'Kontak' },
  ];

  return (
    <>
      <nav class={`fixed top-0 left-0 right-0 z-50 bg-white/92 backdrop-blur-md border-b border-slate-200 transition-shadow ${scrolled ? 'shadow-md' : ''}`}>
        <div class="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <a href="#" class="flex items-center gap-2.5 font-extrabold text-base">
            <div class="w-9 h-9 bg-brand-500 rounded-xl flex items-center justify-center text-lg">🕌</div>
            TPA Al-Hikmah
          </a>
          <div class="hidden md:flex items-center gap-1">
            {links.map(l => (
              <a key={l.href} href={l.href} class="px-3.5 py-2 text-sm font-medium text-slate-500 rounded-lg hover:bg-slate-50 hover:text-slate-800 transition-colors">
                {l.label}
              </a>
            ))}
            <button onClick={onLogin} class="ml-2 px-5 py-2 bg-brand-500 text-white text-sm font-semibold rounded-full hover:bg-brand-700 transition-colors">
              🔐 Masuk Sistem
            </button>
          </div>
          <button class="md:hidden text-2xl" onClick={() => setMobileOpen(!mobileOpen)}>☰</button>
        </div>
      </nav>
      {mobileOpen && (
        <div class="fixed inset-0 top-16 bg-white z-40 flex flex-col p-5 gap-1 md:hidden">
          {links.map(l => (
            <a key={l.href} href={l.href} onClick={() => setMobileOpen(false)} class="px-4 py-3.5 text-base font-medium text-slate-500 rounded-xl active:bg-slate-100">
              {l.label}
            </a>
          ))}
          <button onClick={() => { setMobileOpen(false); onLogin(); }} class="mt-3 px-5 py-3.5 bg-brand-500 text-white font-bold rounded-xl text-center">
            🔐 Masuk Sistem
          </button>
        </div>
      )}
    </>
  );
}
