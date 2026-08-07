// ==================== ONBOARDING (ESM) ====================
// Onboarding kini SINGLE-STEP di license gate (index.html): input Nama Usaha +
// checklist "Syarat & Ketentuan" → tombol "Mulai Masa Percobaan".
// Tidak ada layar onboarding terpisah.
import { startTrial, ensureUnitId } from './license.js';

export async function checkOnboarding() {
  // Pastikan trial & unitId ada (idempoten). Nama usaha di-handle di gate.
  await startTrial();
  await ensureUnitId();
}
