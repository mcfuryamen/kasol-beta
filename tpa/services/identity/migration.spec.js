import assert from 'node:assert/strict';
import { buildMigrationPlan, deterministicUuid, migrateLegacyAccounts, normalizeLegacyPhone } from './migration.js';

assert.equal(normalizeLegacyPhone('0812 3456 7890'), '+6281234567890');
assert.equal(normalizeLegacyPhone('+62-812-3456-7890'), '+6281234567890');
assert.equal(normalizeLegacyPhone('not-a-phone'), null);
assert.equal(deterministicUuid('x', 'y'), deterministicUuid('x', 'y'));

const rows = {
  locations: [{ id: 10, name: 'TPA A' }, { id: 20, name: 'TPA B' }],
  guardians: [{ id: 1, locationId: 10, name: 'Wali', phone: '081234567890', isActive: true }],
  teachers: [{ id: 2, locationId: 10, name: 'Guru', phone: '081111111111', isActive: true }],
  users: [
    { id: 1, locationId: 10, name: 'Admin', role: 'admin', phone: '081200000001', isActive: true },
    { id: 2, locationId: 10, name: 'Guru', role: 'ustadz', teacherId: 2, isActive: true },
    { id: 3, locationId: 10, name: 'Wali', role: 'wali', guardianId: 1, isActive: true },
    { id: 4, locationId: 10, name: 'Invalid', role: 'wali', phone: 'bad', isActive: true },
    { id: 5, locationId: 20, name: 'Cross', role: 'ustadz', teacherId: 2, phone: '081200000005', isActive: true },
    { id: 6, locationId: 10, name: 'Duplicate', role: 'admin', phone: '081200000001', isActive: true }
  ]
};
const plan = buildMigrationPlan(rows);
assert.equal(plan.report.scannedUsers, 6);
assert.equal(plan.report.migratedMemberships, 3);
assert.equal(plan.report.migratedSubjectLinks, 2);
assert.equal(plan.report.invalidPhones.length, 1);
assert.equal(plan.report.duplicates.length, 1);
assert.equal(plan.report.crossLocationRelations.length, 1);
assert.equal(plan.report.status, 'needs_manual_review');
assert.ok(!('pinHash' in plan.identities[0]));

const fakeDb = {
  users: { toArray: async () => rows.users }, guardians: { toArray: async () => rows.guardians }, teachers: { toArray: async () => rows.teachers }, locations: { toArray: async () => rows.locations },
  identityProjections: { clear: async () => {}, bulkPut: async values => { fakeDb.identityValues = values; } },
  appMembershipProjections: { clear: async () => {}, bulkPut: async values => { fakeDb.membershipValues = values; } },
  appSubjectLinks: { clear: async () => {}, bulkPut: async values => { fakeDb.subjectValues = values; } },
  migrationReports: { where: () => ({ equals: () => ({ last: async () => null }) }), put: async value => { fakeDb.report = value; } },
  transaction: async (_mode, _tables, callback) => callback()
};
const dry = await migrateLegacyAccounts({ db: fakeDb, dryRun: true });
assert.equal(dry.status, 'needs_manual_review');
assert.equal(fakeDb.report, undefined);
await migrateLegacyAccounts({ db: fakeDb });
assert.equal(fakeDb.identityValues.length, 3);
assert.equal(fakeDb.membershipValues.length, 3);
assert.equal(fakeDb.subjectValues.length, 2);
assert.equal(fakeDb.report.status, 'needs_manual_review');

console.log('TPA identity Stage C migration tests: PASS');
