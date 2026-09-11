import { render } from "preact";
import { registerSW } from "virtual:pwa-register";
import { App } from "./app";
import "./index.css";
import { initLocalData } from "@/data/db/hydrate";
import { loadOutbox, flush, pull } from "@/data/sync/sync-engine";
import { isDemoMode } from "@/data/supabase";
import { authService } from "@/logic/services/auth-service";

registerSW({ immediate: true });

const el = document.getElementById("app");
if (el) render(<App />, el);

void (async () => {
  await initLocalData();
  await loadOutbox();
  if (!isDemoMode) {
    await authService.restoreSession();
    await flush();
    await pull();
  }
})();
