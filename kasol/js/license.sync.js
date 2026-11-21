/**
 * kasol/js/license.sync.js
 * Supabase sync untuk lisensi kasol
 * NO DOM operations — toast dilakukan via dynamic import di titik usage
 *
 * Didasarkan dari kaki5/js/license.sync.js (versi disederhanakan)
 */
import { getLicense, saveLicense, markLicenseRevoked, bumpClockAnchor, currentTxMonth, cloudProfileMatchesLocal } from './license.logic.js';
import { quotaMarkOnline } from './quota.offline.js';
import { getSetting, setSetting } from './db.js';
import { getDeviceIdentity } from './license.logic.js';

const APP_TYPE = 'kasol';
const LICENSE_SYNC_KEY = 'kasol:licenseSync';

// ── Supabase client (lazy) ───────────────────────────────────────────────────
function isPlaceholderKey(k) {
  if (!k) return true;
  const s = String(k);
  return s.includes('***') || s.includes('...') || /^PASTE/i.test(s) || /^xxxx/i.test(s) || !s.includes('.');
}

function getSupabaseClient() {
  if (!window.supabase) return null;
  const url = window.KASIRSOLO_SUPABASE_URL;
  const anon = window.KASIRSOLO_SUPABASE_ANON_KEY;
  if (!url || isPlaceholderKey(anon)) return null;
  if (!window._kasolSupabaseClient) {
    window._kasolSupabaseClient = window.supabase.createClient(url, anon, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
  }
  return window._kasolSupabaseClient;
}

export { getSupabaseClient };

// ── Auth session ─────────────────────────────────────────────────────────────
async function ensureAuthSession() {
  const sb = getSupabaseClient();
  if (!sb) return { session: null, error: 'Supabase unavailable' };
  try {
    const { data, error } = await sb.auth.getSession();
    if (error) return { session: null, error: error.message };
    if (!data.session) {
      const { data: anonData, error: anonError } = await sb.auth.signInAnonymously();
      if (anonError) return { session: null, error: anonError.message };
      return { session: anonData.session, error: null };
    }
    return { session: data.session, error: null };
  } catch (err) {
    return { session: null, error: String(err) };
  }
}

// ── Read cloud license row ─────────────────────────────────────────────────────
async function readLicenseRow(sb, unitId) {
  try {
    const { data, error } = await sb
      .from('clients')
      .select('license_status, license_serial, license_expires_at, first_seen, tx_month, tx_used, tx_adjust, tx_updated_at, nama_usaha, nama_pemilik, no_whatsapp')
      .eq('unit_id', unitId)
      .eq('app_type', APP_TYPE)
      .maybeSingle();
    if (error) return { kind: 'network', error };
    if (!data) return { kind: 'not-found' };
    return { kind: 'ok', data };
  } catch (error) {
    return { kind: 'network', error };
  }
}

// ── Register device (RPC) ─────────────────────────────────────────────────────
async function registerDevice(sb, unitId, deviceCode) {
  try {
    const { error } = await sb.rpc('device_known', {
      p_unit_id: unitId,
      p_device_code: deviceCode,
      p_app_type: APP_TYPE
    });
    return { ok: !error, error: error?.message || null };
  } catch (_) {
    return { ok: false, error: 'RPC failed' };
  }
}

// ── Full sync: reconcile local ←→ cloud ─────────────────────────────────────
/**
 * Ensure device is registered + license state synced from cloud.
 * Returns { ok, changed, lic }
 */
export async function ensureSynced() {
  const sb = getSupabaseClient();
  if (!sb) return { ok: false, changed: false, error: 'Supabase unavailable' };

  const { session, error: authError } = await ensureAuthSession();
  if (authError || !session) return { ok: false, changed: false, error: authError || 'No session' };

  const { deviceCode, installId } = await getDeviceIdentity();
  const unitId = installId; // use installId as stable unit_id

  // Register device if not known
  await registerDevice(sb, unitId, deviceCode);

  // Read cloud license row
  const rowResult = await readLicenseRow(sb, unitId);

  if (rowResult.kind === 'network') {
    return { ok: false, changed: false, error: rowResult.error };
  }

  let changed = false;
  const local = await getLicense();

  if (rowResult.kind === 'ok' && rowResult.data) {
    const cloud = rowResult.data;

    // Cloud says revoked
    if (cloud.license_status === 'revoked') {
      await markLicenseRevoked(cloud.revoked_reason || 'cloud');
      changed = true;
    }
    // Cloud says aktif — adopt if local is not active
    else if (cloud.license_status === 'aktif') {
      if (local.status !== 'active') {
        const { persistCloudLicense } = await import('./license.logic.js');
        const result = await persistCloudLicense(cloud);
        if (result.valid) changed = true;
      }
    }

    // Reconcile tx quota: cloud wins if newer
    if (cloud.tx_month && cloud.tx_updated_at) {
      const localMonth = local.txMonth || currentTxMonth();
      if (cloud.tx_month === localMonth) {
        const cloudUsed = Number(cloud.tx_used) || 0;
        const localUsed = Number(local.txUsed) || 0;
        if (cloudUsed > localUsed) {
          await saveLicense({ ...local, txUsed: cloudUsed, txAdjust: Number(cloud.tx_adjust) || 0 });
          changed = true;
        }
      }
    }
  }

  // Bump clock anchor on successful sync
  await bumpClockAnchor();
  // Mark quota online (reset offline budget)
  try { await quotaMarkOnline(); } catch (_) { /* non-critical */ }

  const lic = await getLicense();
  return { ok: true, changed, lic };
}

// ── Pull cloud profile ───────────────────────────────────────────────────────
export async function pullCloudProfile() {
  const sb = getSupabaseClient();
  if (!sb) return null;
  const { session } = await ensureAuthSession();
  if (!session) return null;
  try {
    const { deviceCode, installId } = await getDeviceIdentity();
    const { data } = await sb
      .from('clients')
      .select('*')
      .eq('unit_id', installId)
      .eq('app_type', APP_TYPE)
      .maybeSingle();
    return data || null;
  } catch (_) {
    return null;
  }
}

// ── Sync settings ────────────────────────────────────────────────────────────
export async function syncSettingsToCloud(localSettings) {
  const sb = getSupabaseClient();
  if (!sb) return { ok: false, merged: null };
  const { session } = await ensureAuthSession();
  if (!session) return { ok: false, merged: null };

  try {
    const { installId } = await getDeviceIdentity();
    const { data, error } = await sb
      .from('client_settings')
      .select('settings')
      .eq('device_id', installId)
      .eq('app_type', APP_TYPE)
      .maybeSingle();

    if (error) return { ok: false, merged: null };

    let merged = localSettings;
    if (data?.settings) {
      merged = { ...localSettings, ...data.settings };
    }

    await sb.from('client_settings').upsert({
      device_id: installId,
      app_type: APP_TYPE,
      settings: merged,
      updated_at: new Date().toISOString()
    }, { onConflict: 'device_id,app_type' });

    return { ok: true, merged };
  } catch (_) {
    return { ok: false, merged: null };
  }
}
