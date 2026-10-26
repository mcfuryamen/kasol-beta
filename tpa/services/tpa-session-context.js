/**
 * Shared session-location helper for remote write services.
 *
 * Reads the same session record as db/init.js getSessionUser()
 * (localStorage 'tpa_session': { id, name, role, locationId, locationName, ... }).
 * Every INSERT into tenant-scoped tables (tpa_classes, tpa_schedules,
 * tpa_students, tpa_class_students, tpa_class_teachers, ...) REQUIRES a
 * location_id — the RLS WITH CHECK policies reject rows without it (42501).
 * Guarded for Node test runs (no localStorage global).
 */

export function getSessionLocationId() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('tpa_session');
    if (!raw) return null;
    return JSON.parse(raw)?.locationId ?? null;
  } catch {
    return null;
  }
}

export function requireSessionLocationId() {
  const locationId = getSessionLocationId();
  if (!locationId || typeof locationId !== 'string') throw new Error('LOCATION_REQUIRED');
  return locationId;
}
