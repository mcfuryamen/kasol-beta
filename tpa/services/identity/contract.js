/**
 * Universal identity contract for the TPA application.
 *
 * TPA consumes this contract; it does not own universal credentials.
 */

export const APP_KEY = 'tpa';

export const IDENTITY_STATUSES = Object.freeze(['pending', 'active', 'suspended']);
export const MEMBERSHIP_STATUSES = Object.freeze(['active', 'suspended', 'expired']);
export const TPA_ROLES = Object.freeze(['admin', 'ustadz', 'wali']);
export const SUBJECT_TYPES = Object.freeze(['guardian', 'teacher']);

export const SECURITY_EVENTS = Object.freeze([
  'login_success',
  'login_failure',
  'lockout',
  'session_created',
  'session_revoked',
  'credential_changed',
  'recovery_requested',
  'recovery_completed'
]);

const PHONE_RE = /^\+[1-9]\d{7,14}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class IdentityContractError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'IdentityContractError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new IdentityContractError(code, message, details);
}

function requiredString(value, field) {
  if (typeof value !== 'string' || !value.trim()) fail('INVALID_FIELD', `${field} wajib diisi`, { field });
  return value.trim();
}

function requiredId(value, field) {
  const id = requiredString(value, field);
  if (!UUID_RE.test(id)) fail('INVALID_ID', `${field} harus UUID`, { field });
  return id;
}

function oneOf(value, values, field) {
  if (!values.includes(value)) fail('INVALID_ENUM', `${field} tidak valid`, { field, value });
  return value;
}

function nullableTimestamp(value, field) {
  if (value == null) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) fail('INVALID_TIMESTAMP', `${field} tidak valid`, { field });
  return date.toISOString();
}

export function normalizePhoneE164(value) {
  const raw = requiredString(value, 'phoneE164').replace(/[\s().-]/g, '');
  if (!PHONE_RE.test(raw)) fail('INVALID_PHONE', 'phoneE164 harus berformat E.164', { field: 'phoneE164' });
  return raw;
}

export const RECOVERY_METHODS = Object.freeze(['admin_approval']);
export const RECOVERY_STATUSES = Object.freeze(['pending', 'approved', 'rejected', 'completed', 'expired']);
export const GENERIC_RECOVERY_MESSAGE = 'Jika akun cocok, permintaan pemulihan sedang diproses oleh admin.';

export function validateRecoveryRequest(input) {
  if (!input || typeof input !== 'object') fail('INVALID_RECOVERY_REQUEST', 'Permintaan recovery tidak valid');
  return Object.freeze({ phoneE164: normalizePhoneE164(input.phoneE164) });
}

export function validateRecoveryChallenge(input) {
  if (!input || typeof input !== 'object') fail('INVALID_RECOVERY_CHALLENGE', 'Challenge recovery tidak valid');
  return Object.freeze({
    challengeId: requiredId(input.challengeId, 'challengeId'),
    status: oneOf(input.status, RECOVERY_STATUSES, 'status'),
    method: input.method == null ? 'admin_approval' : oneOf(input.method, RECOVERY_METHODS, 'method'),
    expiresAt: nullableTimestamp(input.expiresAt, 'expiresAt'),
    approvalExpiresAt: nullableTimestamp(input.approvalExpiresAt, 'approvalExpiresAt'),
    approvalToken: typeof input.approvalToken === 'string' && input.approvalToken ? input.approvalToken : null
  });
}

export function validateRecoveryCompletion(input) {
  if (!input || typeof input !== 'object') fail('INVALID_RECOVERY_COMPLETION', 'Completion recovery tidak valid');
  return Object.freeze({ completed: input.completed === true, sessionsRevoked: Number.isInteger(input.sessionsRevoked) && input.sessionsRevoked >= 0 ? input.sessionsRevoked : 0 });
}

export function validateNewCredential(value) {
  if (typeof value !== 'string' || value.length < 6 || value.length > 128 || /[\\u0000-\\u001f\\u007f]/.test(value)) fail('INVALID_CREDENTIAL', 'Credential baru tidak memenuhi kebijakan');
  return value;
}

export function validateIdentity(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('INVALID_IDENTITY', 'Identity harus object');
  const identity = {
    globalIdentityId: requiredId(input.globalIdentityId, 'globalIdentityId'),
    phoneE164: normalizePhoneE164(input.phoneE164),
    displayName: requiredString(input.displayName, 'displayName'),
    status: oneOf(input.status, IDENTITY_STATUSES, 'status'),
    phoneVerifiedAt: nullableTimestamp(input.phoneVerifiedAt, 'phoneVerifiedAt')
  };
  if ('passwordHash' in input || 'pinHash' in input || 'credentialHash' in input || 'salt' in input) {
    fail('CREDENTIAL_BOUNDARY_VIOLATION', 'Identity projection tidak boleh membawa credential');
  }
  return Object.freeze(identity);
}

export function validateMembership(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('INVALID_MEMBERSHIP', 'Membership harus object');
  const membership = {
    membershipId: requiredId(input.membershipId, 'membershipId'),
    globalIdentityId: requiredId(input.globalIdentityId, 'globalIdentityId'),
    appKey: requiredString(input.appKey, 'appKey'),
    tenantId: requiredId(input.tenantId, 'tenantId'),
    locationId: requiredId(input.locationId, 'locationId'),
    role: oneOf(input.role, TPA_ROLES, 'role'),
    status: oneOf(input.status, MEMBERSHIP_STATUSES, 'status'),
    expiresAt: nullableTimestamp(input.expiresAt, 'expiresAt')
  };
  if (membership.appKey !== APP_KEY) fail('WRONG_APP', 'Membership bukan untuk aplikasi TPA');
  if (membership.expiresAt && new Date(membership.expiresAt) <= new Date()) {
    fail('MEMBERSHIP_EXPIRED', 'Membership TPA sudah kedaluwarsa');
  }
  return Object.freeze(membership);
}

export function validateSubjectLink(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('INVALID_SUBJECT_LINK', 'Subject link harus object');
  const subjectType = oneOf(input.subjectType, SUBJECT_TYPES, 'subjectType');
  const subjectId = requiredId(input.subjectId, 'subjectId');
  const link = {
    membershipId: requiredId(input.membershipId, 'membershipId'),
    subjectType,
    subjectId,
    locationId: requiredId(input.locationId, 'locationId')
  };
  return Object.freeze(link);
}

export function validateAppSession(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('INVALID_SESSION', 'App session harus object');
  const session = {
    appSessionId: requiredId(input.appSessionId, 'appSessionId'),
    globalIdentityId: requiredId(input.globalIdentityId, 'globalIdentityId'),
    membershipId: requiredId(input.membershipId, 'membershipId'),
    appKey: requiredString(input.appKey, 'appKey'),
    tenantId: requiredId(input.tenantId, 'tenantId'),
    locationId: requiredId(input.locationId, 'locationId'),
    role: oneOf(input.role, TPA_ROLES, 'role'),
    sessionVersion: Number.isInteger(input.sessionVersion) && input.sessionVersion > 0 ? input.sessionVersion : fail('INVALID_SESSION_VERSION', 'sessionVersion tidak valid'),
    issuedAt: nullableTimestamp(input.issuedAt, 'issuedAt'),
    expiresAt: nullableTimestamp(input.expiresAt, 'expiresAt'),
    deviceId: input.deviceId == null ? null : requiredId(input.deviceId, 'deviceId')
  };
  if (session.appKey !== APP_KEY) fail('WRONG_APP', 'Session bukan untuk aplikasi TPA');
  if (!session.issuedAt || !session.expiresAt || new Date(session.expiresAt) <= new Date(session.issuedAt)) {
    fail('INVALID_SESSION_WINDOW', 'Rentang waktu session tidak valid');
  }
  return Object.freeze(session);
}

const SENSITIVE_KEY = /(password|passcode|pin|otp|credential|hash|salt|secret|token|authorization|phone|access.?key|private.?key)/i;

function safeMetadata(value, depth = 0) {
  if (depth > 2 || value == null || typeof value === 'function') return undefined;
  if (typeof value !== 'object') return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : undefined;
  if (Array.isArray(value)) return value.slice(0, 20).map(item => safeMetadata(item, depth + 1)).filter(item => item !== undefined);
  return Object.fromEntries(Object.entries(value).filter(([key]) => !SENSITIVE_KEY.test(key)).slice(0, 30).map(([key, item]) => [key, safeMetadata(item, depth + 1)]).filter(([, item]) => item !== undefined));
}

export function redactSecurityEvent(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('INVALID_SECURITY_EVENT', 'Security event harus object');
  const eventType = oneOf(input.eventType, SECURITY_EVENTS, 'eventType');
  const output = {
    identityId: input.identityId == null ? null : requiredId(input.identityId, 'identityId'),
    appKey: APP_KEY, eventType, success: Boolean(input.success),
    metadataRedacted: safeMetadata(input.metadataRedacted || {}),
    createdAt: nullableTimestamp(input.createdAt, 'createdAt') || new Date().toISOString()
  };
  return Object.freeze(output);
}
