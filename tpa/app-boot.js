/**
 * App Bootstrap
 * Initialize Supabase, restore session, set up auth listeners
 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { bootstrapSupabaseIdentity } from './services/identity/supabase-transport.js';
import { getIdentitySession, setIdentitySession, verifyIdentitySession, revokeIdentitySession } from './services/identity/session.js';
import { setSessionUser, getSessionUser } from './db/init.js';

// Dedup lintas-URL-modul: satu halaman bisa memuat app-boot.js lewat dua URL
// berbeda (mis. "app-boot.js?v=qa2" vs "app-boot.js"), sehingga modul dieksekusi
// dua kali dan initializeApp() menciptakan dua GoTrueClient dengan storage key
// sama (warning "Multiple GoTrueClient instances"). Satukan state via globalThis
// agar eksekusi modul kedua memakai boot yang sudah berjalan.
const bootState = (globalThis.__TPA_APP_BOOT__ ||= { promise: null, client: null, ready: false });
const readyPromise = bootState.promise || (bootState.promise = initializeApp());

export function getSupabaseClient() {
  return bootState.client;
}

export function getAppReady() {
  return readyPromise;
}

export async function initializeApp() {
  if (bootState.client && bootState.ready) {
    return { supabaseClient: bootState.client, appReady: true };
  }
  try {
    // 1. Initialize Supabase client
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl) {
      throw new Error('Supabase environment variables not configured');
    }
    if (!supabaseKey) {
      throw new Error('Supabase environment variables not configured');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        storage: window.localStorage,
        storageKey: 'tpa_supabase_session'
      }
    });
    bootState.client = supabaseClient;
    globalThis.__TPA_SUPABASE_CLIENT__ = supabaseClient;

    // 2. Bootstrap identity provider with Supabase.
    // Jalur login aktif = Supabase Auth (IDENTITY-CONTRACT.md, update 2026-10-12);
    // adapter hub (RPC identity_*) hanya terpasang bila VITE_IDENTITY_HUB_ENABLED=true.
    bootstrapSupabaseIdentity(supabaseClient);

    // 3. Restore session from localStorage (before rendering)
    await restoreSession(supabaseClient);

    // 4. Set up auth state listener
    setupAuthListener(supabaseClient);

    // 5. Listen for session changes
    setupSessionListener(supabaseClient);

    bootState.ready = true;
    document.documentElement.setAttribute('data-app-ready', 'true');
    window.dispatchEvent(new Event('app:ready'));

    return { supabaseClient, appReady: true };
  } catch (error) {
    console.error('[app-boot] Initialization failed', error);
    bootState.ready = false;
    document.documentElement.setAttribute('data-app-ready', 'false');
    window.dispatchEvent(new CustomEvent('app:error', { detail: error }));
    throw error;
  }
}

/**
 * Detect network-level failures (offline, DNS, timeout) so they can be
 * distinguished from real auth/data problems. A dropped connection must NOT
 * wipe a valid local session.
 */
function isNetworkError(error) {
  if (!error) return false;
  if (error.name === 'TypeError') return true; // supabase-js wraps fetch failures as TypeError
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const msg = String(error.message || error || '');
  return /failed to fetch|networkerror|network error|load failed|internet disconnected|err_inet|err_name|err_connection|timed?\s?out|offline/i.test(msg);
}

/**
 * Restore user session from storage before rendering.
 * This prevents flashing of login screen when user is already logged in.
 */
async function restoreSession(supabaseClient) {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session?.user) {
      setSessionUser(null);
      return;
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id,name,email,phone,phone_e164,is_active')
      .eq('id', session.user.id)
      .maybeSingle();
    const { data: memberships, error: membershipError } = await supabaseClient
      .from('tpa_memberships')
      .select('id,location_id,role,teacher_id,guardian_id,is_active,tpa_locations(id,name)')
      .eq('user_id', session.user.id)
      .eq('is_active', true);
    if (profileError && isNetworkError(profileError)) {
      console.warn('[app-boot] restoreSession: jaringan tidak tersedia saat memuat profil; sesi dipertahankan (tidak signOut)');
      return;
    }
    if (membershipError && isNetworkError(membershipError)) {
      console.warn('[app-boot] restoreSession: jaringan tidak tersedia saat memuat membership; sesi dipertahankan (tidak signOut)');
      return;
    }
    if (profileError || membershipError || !profile || profile.is_active === false || memberships?.length !== 1) {
      await supabaseClient.auth.signOut();
      setSessionUser(null);
      return;
    }
    const membership = memberships[0];
    const location = Array.isArray(membership.tpa_locations) ? membership.tpa_locations[0] : membership.tpa_locations;
    setSessionUser({
      id: profile.id,
      name: profile.name || profile.email || 'Pengguna',
      role: membership.role,
      phone: profile.phone_e164 || profile.phone || '',
      locationId: membership.location_id,
      locationName: location?.name || '',
      teacherId: membership.teacher_id || undefined,
      guardianId: membership.guardian_id || undefined,
      globalIdentityId: profile.id,
      authUserId: session.user.id,
      membershipId: membership.id,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null
    });
  } catch (error) {
    console.warn('[app-boot] Session restore failed:', error);
    setSessionUser(null);
  }
}

/**
 * Listen for Supabase auth state changes and update TPA session.
 */
function setupAuthListener(supabaseClient) {
  supabaseClient.auth.onAuthStateChange((event, supabaseSession) => {
    if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
      if (!supabaseSession) {
        setSessionUser(null);
      } else {
        void restoreSession(supabaseClient);
      }
    } else if (event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
      if (!supabaseSession) {
        setSessionUser(null);
      }
    }
  });
}

/**
 * Listen for TPA session changes and handle expiry.
 */
function setupSessionListener(supabaseClient) {
  const checkSessionExpiry = async () => {
    // Pemeriksaan ini hanya relevan untuk sesi adapter Identity Hub. Pada jalur
    // aktif Supabase Auth, kedaluwarsa ditangani supabase-js (autoRefreshToken +
    // SIGNED_OUT); menyentuh sisa tpa_identity_session lama justru bisa
    // memaksa signOut untuk sesi Supabase yang masih valid.
    if (!globalThis.__TPA_IDENTITY_ADAPTER__) return;
    const session = getIdentitySession();
    if (!session) return;

    // Check if session is expired or about to expire
    const expiresAt = new Date(session.expiresAt);
    const now = new Date();
    const timeUntilExpiry = expiresAt - now;
    const fiveMinutes = 5 * 60 * 1000;

    if (timeUntilExpiry < 0) {
      // Session expired; sign out
      console.log('[session-listener] Session expired, signing out');
      await supabaseClient.auth.signOut();
      revokeIdentitySession();
      window.location.href = 'login.html';
    } else if (timeUntilExpiry < fiveMinutes) {
      // Session expiring soon; show warning
      window.dispatchEvent(new CustomEvent('session:expiring-soon', {
        detail: { minutesRemaining: Math.floor(timeUntilExpiry / 60000) }
      }));
    }
  };

  // Check session expiry every minute
  setInterval(checkSessionExpiry, 60000);
  checkSessionExpiry(); // Check immediately

  // Also check on visibility change (user returns to tab)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkSessionExpiry();
    }
  });
}

/**
 * Wait for app to be ready before rendering main content.
 * Prevents flash of login screen.
 */
export async function waitForAppReady(timeoutMs = 5000) {
  if (bootState.ready) return true;

  try {
    await Promise.race([
      readyPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('App ready timeout')), timeoutMs)
      )
    ]);
    return true;
  } catch (error) {
    console.error('[app-boot] Failed to initialize within timeout:', error);
    return false;
  }
}
