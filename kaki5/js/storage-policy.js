const BUCKETS = new Set(['bukti', 'backups']);

export function isAllowedStorageObjectPath(bucket, unitId, objectPath) {
  if (!BUCKETS.has(bucket)) return false;
  const unit = String(unitId || '').trim();
  const path = String(objectPath || '').trim();
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(unit)) return false;
  if (!path || path.length > 500 || path.includes('\\') || path.includes('..') || /^(?:https?:|javascript:|data:)/i.test(path)) return false;
  if (!path.startsWith(`${unit}/`)) return false;
  if (bucket === 'bukti') return new RegExp(`^${escapeRegExp(unit)}/[0-9]{1,16}-[A-Za-z0-9_-]{8,64}\\.jpg$`).test(path);
  return new RegExp(`^${escapeRegExp(unit)}/[A-Za-z0-9][A-Za-z0-9._-]{0,480}$`).test(path);
}

export function isCrossUnitStorageObjectPath(bucket, unitId, objectPath) {
  if (!BUCKETS.has(bucket)) return true;
  const path = String(objectPath || '').trim();
  return !isAllowedStorageObjectPath(bucket, unitId, path) && /^[A-Za-z0-9_-]{1,120}\//.test(path);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
