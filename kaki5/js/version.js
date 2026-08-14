// ==================== APP VERSION (ESM) ====================
// SINGLE source of truth for the app version string (P1 / N7+K8, audit 2026-08-11).
// Before this file existed, the version was hard-coded in many places that
// drifted apart: index.html "Versi 1.0", README "?v=36", app.js cache-bust "?v=46",
// and sw.js CACHE_NAME "v40". Update APP_VERSION here only; every consumer reads
// from this module (or window.APP_VERSION, set by app.js).
export const APP_VERSION = '1.0.2';

// Human-friendly short label for the UI (the "Versi X.Y.Z" shown on the Settings
// license card). Derived from APP_VERSION so it can never drift.
export const APP_VERSION_LABEL = 'Versi ' + APP_VERSION;

// Cache-busting value used for <script>/<link> URLs and documented in README.
// A single bump forces browsers to refetch assets after a release.
export const CACHE_BUST = 'v52';
