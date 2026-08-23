import { signal } from "@preact/signals";
import { useEffect } from "preact/hooks";

export const isMobile = signal(window.innerWidth < 768);
export const isTablet = signal(window.innerWidth < 1024);

export function useResponsive() {
  useEffect(() => {
    const handler = () => {
      isMobile.value = window.innerWidth < 768;
      isTablet.value = window.innerWidth < 1024;
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return { isMobile, isTablet };
}
