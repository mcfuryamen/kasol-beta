import { APP_KEY, normalizePhoneE164 } from './contract.js';

export const MIGRATION_KEY = 'tpa-identity-projection-v1';
const UUID_HEX = /^[0-9a-f]{32}$/;

function hashHex(value) {
  let h1 = 0x811c9dc5; let h2 = 0x9e3779b9; let h3 = 0x85ebca6b; let h4 = 0xc2b2ae35;
  for (const char of String(value)) {
    const c = char.charCodeAt(0);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ c, 2246822519);
    h3 = Math.imul(h3 ^ c, 3266489917);
    h4 = Math.imul(h4 ^ c, 668265263);
  }
  return [h1, h2, h3, h4].map(n => (n >>> 0).toString(16).padStart(8, '0')).join('');
}

export function deterministicUuid(namespace, key) {
  const hex = hashHex(`${namespace}:${key}`);
  if (!UUID_HEX.test(hex)) throw new Error('deterministic UUID gagal dibuat');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0')}${hex.slice(18, 20)}-${hex.slice(20)}`;
}

export function normalizeLegacyPhone(value) {
  if (value == null || String(value).trim() === '') return null;
  const raw = String(value).trim().replace(/[\s().-]/g, '');
  const candidate = raw.startsWith('+') ? raw : raw.startsWith('0') ? `+62${raw.slice(1)}` : raw.startsWith('62') ? `+${raw}` : raw;
  try { return normalizePhoneE164(candidate); } catch { return null; }
}

function sourceFingerprint(users, guardians, teachers, locations) {
  return hashHex(JSON.stringify({ users, guardians, teachers, locations }));
}

function reportBase(fingerprint) {
  return {
    migrationKey: MIGRATION_KEY, sourceFingerprint: fingerprint, status: 'ready',
    scannedUsers: 0, migratedIdentities: 0, migratedMemberships: 0, migratedSubjectLinks: 0,
    invalidPhones: [], duplicates: [], missingRelations: [], crossLocationRelations: [], conflicts: []
  };
}

export function buildMigrationPlan({ users = [], guardians = [], teachers = [], locations = [] }) {
  const fingerprint = sourceFingerprint(users, guardians, teachers, locations);
  const report = reportBase(fingerprint);
  const identities = []; const memberships = []; const subjectLinks = [];
  const byPhone = new Map();
  const guardianById = new Map(guardians.map(row => [String(row.id), row]));
  const teacherById = new Map(teachers.map(row => [String(row.id), row]));
  const locationIds = new Set(locations.map(row => String(row.id)));

  for (const user of users) {
    report.scannedUsers += 1;
    const locationId = String(user.locationId ?? '');
    if (!locationIds.has(locationId)) {
      report.conflicts.push({ userId: user.id, reason: 'location_missing', locationId });
      continue;
    }
    const relation = user.role === 'wali' ? guardianById.get(String(user.guardianId)) : user.role === 'ustadz' ? teacherById.get(String(user.teacherId)) : null;
    const relationPhone = relation?.phone;
    const phone = normalizeLegacyPhone(user.phone) || normalizeLegacyPhone(relationPhone);
    if (!phone) {
      report.invalidPhones.push({ userId: user.id, name: user.name || '', value: user.phone || relationPhone || null });
      continue;
    }
    const identityKey = `phone:${phone}`;
    const existing = byPhone.get(`${locationId}:${phone}`);
    if (existing) {
      report.duplicates.push({ phoneE164: phone, locationId, userIds: [existing.userId, user.id] });
      report.conflicts.push({ userId: user.id, reason: 'duplicate_phone', phoneE164: phone });
      continue;
    }
    byPhone.set(`${locationId}:${phone}`, { userId: user.id });

    const globalIdentityId = deterministicUuid('kasol-global-identity', identityKey);
    const membershipId = deterministicUuid('kasol-tpa-membership', `${user.id}:${locationId}`);
    const tenantId = deterministicUuid('kasol-tpa-tenant', locationId);
    const identity = { globalIdentityId, phoneE164: phone, displayName: String(user.name || relation?.name || 'Akun TPA'), status: user.isActive === false ? 'suspended' : 'active', phoneVerifiedAt: null, legacyUserId: user.id, source: 'legacy-tpa' };
    const membership = { membershipId, globalIdentityId, appKey: APP_KEY, tenantId, locationId: user.locationId, role: user.role, status: user.isActive === false ? 'suspended' : 'active', expiresAt: null, legacyUserId: user.id };
    if (!['admin', 'ustadz', 'wali'].includes(membership.role)) {
      report.conflicts.push({ userId: user.id, reason: 'invalid_role', role: membership.role });
      continue;
    }
    if (membership.role !== 'admin') {
      if (!relation) {
        report.missingRelations.push({ userId: user.id, role: membership.role, relationId: membership.role === 'wali' ? user.guardianId : user.teacherId });
        continue;
      }
      if (relation.isActive === false) {
        report.missingRelations.push({ userId: user.id, role: membership.role, reason: 'relation_inactive', relationId: relation.id });
        continue;
      }
      if (String(relation.locationId) !== locationId) {
        report.crossLocationRelations.push({ userId: user.id, relationId: relation.id, userLocationId: user.locationId, relationLocationId: relation.locationId });
        continue;
      }
      const subjectType = membership.role === 'wali' ? 'guardian' : 'teacher';
      subjectLinks.push({ membershipId, subjectType, subjectId: relation.id, locationId: user.locationId, legacyUserId: user.id });
    }
    identities.push(identity);
    memberships.push(membership);
  }
  report.migratedIdentities = identities.length;
  report.migratedMemberships = memberships.length;
  report.migratedSubjectLinks = subjectLinks.length;
  report.status = report.invalidPhones.length || report.duplicates.length || report.missingRelations.length || report.crossLocationRelations.length || report.conflicts.length ? 'needs_manual_review' : 'ready';
  return { report, identities, memberships, subjectLinks };
}

export async function migrateLegacyAccounts({ db, dryRun = false, force = false }) {
  const [users, guardians, teachers, locations] = await Promise.all([db.users.toArray(), db.guardians.toArray(), db.teachers.toArray(), db.locations.toArray()]);
  const plan = buildMigrationPlan({ users, guardians, teachers, locations });
  if (!dryRun) {
    const previous = await db.migrationReports.where('migrationKey').equals(MIGRATION_KEY).last();
    if (!force && previous?.sourceFingerprint === plan.report.sourceFingerprint && previous.status === 'completed') return previous;
    await db.transaction('rw', [db.identityProjections, db.appMembershipProjections, db.appSubjectLinks, db.migrationReports], async () => {
      await db.identityProjections.clear(); await db.appMembershipProjections.clear(); await db.appSubjectLinks.clear();
      await db.identityProjections.bulkPut(plan.identities);
      await db.appMembershipProjections.bulkPut(plan.memberships);
      await db.appSubjectLinks.bulkPut(plan.subjectLinks);
      plan.report.status = plan.report.status === 'ready' ? 'completed' : 'needs_manual_review';
      plan.report.createdAt = new Date().toISOString();
      await db.migrationReports.put(plan.report);
    });
  }
  return plan.report;
}
