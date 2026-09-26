import { useEffect } from "preact/hooks";
import { darkMode } from "@/logic/state/app-state";

/**
 * Komponen subscriber dark mode — wajib dirender sekali di root layout
 * (MainLayout / AuthLayout). Jangan panggil sebagai hook: efek classList yang
 * hidup di komponen yang TIDAK membaca darkMode.value saat render tidak pernah
 * dijalankan ulang saat sinyal berubah (Preact signals hanya me-render ulang
 * subscriber), sehingga toggle terasa mati sampai navigasi berikutnya.
 */
export function DarkModeSync() {
  const isDark = darkMode.value; // baca saat render → subscribe perubahan

  useEffect(() => {
    const saved = localStorage.getItem("darkMode");
    if (saved !== null) darkMode.value = saved === "true";
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode.value) root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("darkMode", String(darkMode.value));
  }, [isDark]);

  return null;
}
