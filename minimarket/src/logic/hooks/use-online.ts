import { useEffect } from "preact/hooks";
import { isOnline } from "@/data/sync/sync-engine";

export function useOnline() {
  useEffect(() => {
    const on = () => { isOnline.value = true; };
    const off = () => { isOnline.value = false; };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return isOnline;
}
