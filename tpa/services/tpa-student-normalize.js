const GENDERS = new Set(['L', 'P']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function normalizeStudentWriteInput(input = {}) {
  const name = String(input.name ?? '').trim();
  if (!name) throw new Error('STUDENT_NAME_REQUIRED');
  const nis = String(input.nis ?? '').trim();
  if (!nis) throw new Error('STUDENT_NIS_REQUIRED');
  const gender = input.gender ? String(input.gender) : null;
  if (gender && !GENDERS.has(gender)) throw new Error('STUDENT_GENDER_INVALID');
  const guardianId = input.guardian_id ?? null;
  if (guardianId !== null && !isUuid(guardianId)) throw new Error('STUDENT_GUARDIAN_INVALID');
  return { name, nis, gender, guardian_id: guardianId, is_active: input.is_active === false ? false : true };
}

export function buildStudentConsentPayload({ consent, guardianId = null, currentAuthUserId, now }) {
  if (!consent) throw new Error('STUDENT_CONSENT_REQUIRED');
  if (!isUuid(currentAuthUserId)) throw new Error('STUDENT_CONSENT_ACTOR_REQUIRED');
  return {
    consent_at: now || new Date().toISOString(),
    consent_by: currentAuthUserId,
    consent_guardian_id: guardianId
  };
}