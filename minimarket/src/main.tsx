import { render } from "preact";
import { registerSW } from "virtual:pwa-register";
import { App } from "./app";
import { UpdateOverlay, updatePending, bindUpdateInstaller } from "@/ui/organisms/update-overlay";
import "./index.css";
import { initLocalData } from "@/data/db/hydrate";
import { loadOutbox, flush, pull, initSyncEngine } from "@/data/sync/sync-engine";
import { isDemoMode } from "@/data/supabase";
import { authService } from "@/logic/services/auth-service";
import { activeOutletId } from "@/logic/state/app-state";
import { isCloudOutletId } from "@/logic/services/outlet-service";
import { ensureSynced } from "@/logic/services/license";

// SW mode "prompt": ketemu versi baru → tampilkan overlay OKE (jangan reload sendiri).
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh: () => { updatePending.value = true; },
});
bindUpdateInstaller(() => { void updateSW(true); });
// Poll berkala untuk sesi kasir yang berhari-hari tanpa refresh.
setInterval(() => { void updateSW(false); }, 30 * 60_000);

const el = document.getElementById("app");
if (el) render(<><App /><UpdateOverlay /></>, el);

void (async () => {
  initSyncEngine();

  // Supabase restores its session asynchronously. Do this before hydration so
  // outlet/profile RLS can resolve the cloud context before any pull starts.
  if (!isDemoMode) await authService.restoreSession();

  await initLocalData();
  await ensureSynced();
  await loadOutbox();
  if (!isDemoMode && isCloudOutletId(activeOutletId.value)) {
    await flush();
    await pull();
  }
})();
