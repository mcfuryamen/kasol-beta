import { useEffect } from "preact/hooks";
import { darkMode } from "@/logic/state/app-state";

export function useDarkMode() {
  useEffect(() => {
    const saved = localStorage.getItem("darkMode");
    if (saved !== null) darkMode.value = saved === "true";
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode.value) root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("darkMode", String(darkMode.value));
  });
}
