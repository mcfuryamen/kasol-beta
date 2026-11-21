/**
 * kasol/js/sync.js
 * Supabase sync utilities for kasol
 * Didasarkan dari kaki5/js/sync.js
 */
import { getSetting, setSetting } from './db.js';

const SUPABASE_URL = 'https://xyz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtha2k1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2NjE5MTgxOTEsImV4cCI6MTk3NzQ5NDE5MX0.XFDeH3iImxLm-ktam_XvXrMgNtHmcI4JHGAO2qDAfAY';

/** Lazy Supabase client */
let _sb = null;
export function getSupabase() {
  if (_sb) return _sb;
  // Dynamic import to avoid blocking
  try {
    _sb = window.supabase || import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    );
  } catch {
    return null;
  }
  return _sb;
}

/**
 * Ensure we have a valid auth session (anonymous or real)
 * @returns {Promise<{session:object|null, error:string|null}>}
 */
export async function ensureAuthSession() {
  try {
    const sb = await Promise.resolve(getSupabase());
    if (!sb) return { session: null, error: 'Supabase unavailable' };
    const { data, error } = await sb.auth.getSession();
    if (error) return { session: null, error: error.message };
    if (!data.session) {
      // Sign in anonymously
      const { data: anonData, error: anonError } = await sb.auth.signInAnonymously();
      if (anonError) return { session: null, error: anonError.message };
      return { session: anonData.session, error: null };
    }
    return { session: data.session, error: null };
  } catch (err) {
    return { session: null, error: String(err) };
  }
}

/**
 * Get device identity for this browser
 * @returns {Promise<string>}
 */
export async function getDeviceId() {
  let deviceId = await getSetting('device_id', null);
  if (!deviceId) {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    deviceId = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
    await setSetting('device_id', deviceId);
  }
  return deviceId;
}

/**
 * Ensure device is registered in cloud
 * @returns {Promise<{ok:boolean, error:string|null}>}
 */
export async function ensureDeviceKnown() {
  try {
    const sb = await Promise.resolve(getSupabase());
    if (!sb) return { ok: false, error: 'Supabase unavailable' };
    const { session, error } = await ensureAuthSession();
    if (error || !session) return { ok: false, error: error || 'No session' };

    const deviceId = await getDeviceId();
    const { error: rpcError } = await sb.rpc('device_known', {
      p_device_id: deviceId,
      p_app_type: 'kasol'
    }).single();

    if (rpcError && rpcError.code !== 'PGRST204') {
      // Ignore "function not found" for new installations
      return { ok: false, error: rpcError.message };
    }
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Sync settings to cloud (merge — cloud wins for conflicts)
 * @param {object} localSettings
 * @returns {Promise<{ok:boolean, merged:object|null}>}
 */
export async function syncSettingsToCloud(localSettings) {
  try {
    const sb = await Promise.resolve(getSupabase());
    if (!sb) return { ok: false, merged: null };
    const { session } = await ensureAuthSession();
    if (!session) return { ok: false, merged: null };

    const deviceId = await getDeviceId();
    const { data, error } = await sb
      .from('client_settings')
      .select('settings')
      .eq('device_id', deviceId)
      .eq('app_type', 'kasol')
      .maybeSingle();

    if (error) return { ok: false, merged: null };

    let merged = localSettings;
    if (data?.settings) {
      // Deep merge: local + cloud, cloud overwrites
      merged = { ...localSettings, ...data.settings };
    }

    // Upsert merged
    await sb.from('client_settings').upsert({
      device_id: deviceId,
      app_type: 'kasol',
      settings: merged,
      updated_at: new Date().toISOString()
    }, { onConflict: 'device_id,app_type' });

    return { ok: true, merged };
  } catch {
    return { ok: false, merged: null };
  }
}

/**
 * Pull cloud profile to local
 * @returns {Promise<object|null>}
 */
export async function pullCloudProfile() {
  try {
    const sb = await Promise.resolve(getSupabase());
    if (!sb) return null;
    const { session } = await ensureAuthSession();
    if (!session) return null;

    const deviceId = await getDeviceId();
    const { data, error } = await sb
      .from('clients')
      .select('*')
      .eq('device_id', deviceId)
      .eq('app_type', 'kasol')
      .maybeSingle();

    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}
