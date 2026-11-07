/**
 * SPP Remote Sync Layer (Supabase <-> Dexie, offline-first)
 *
 * Kontrak tabel remote (migrasi paralel — JANGAN diasumsikan sudah ada saat
 * runtime, semua panggilan wajib lolos try/catch):
 *   tpa_spp_types(id, legacy_id, location_id, name, amount, is_recurring, is_active, ...)
 *   tpa_spp_bills(id, legacy_id, location_id, student_id, spp_type_id, bill_month, amount, paid_amount, status, is_active, ...)
 *   tpa_spp_payments(id, legacy_id, location_id, bill_id, student_id, amount, method, paid_at, is_active, ...)
 *   tpa_cash_flows(id, legacy_id, location_id, flow_type, category, amount, description, transaction_date, is_active, ...)
 *
 * Mapping wajib: flow_type<->type, bill_month 'YYYY-MM-01'<->billMonth 'YYYY-MM',
 * paid_at (ISO timestamptz)<->paidAt.
 *
 * Dexie tetap sumber kebenaran UI: pull hanya merge/upsert (tidak pernah
 * menghapus baris lokal), push best-effort. Semua kegagalan jaringan di-catch
 * -> console.warn('[tpa-spp-remote]', ...) -> return { ok: false, error }.
 */
import { db as dexieDb } from '../db/dexie.js';

function client() {
  // Konsisten dengan services/auth.js: client diambil dari globalThis yang
  // di-set bootstrapSupabaseIdentity() saat app-boot (bukan import app-boot.js,
  // agar modul tetap bisa di-load di spec Node tanpa env Vite).
  const supabase = globalThis.__TPA_SUPABASE_CLIENT__;
  if (!supabase) throw new Error('SUPABASE_NOT_READY');
  return supabase;
}

function localDb() {
  // Seam untuk spec: default-nya singleton Dexie produksi.
  return globalThis.__TPA_SPP_LOCAL_DB__ || dexieDb;
}

async function requireUser() {
  const { data, error } = await client().auth.getUser();
  if (error || !data?.user) throw new Error('AUTH_REQUIRED');
  return data.user;
}

function warnFailure(scope, error) {
  console.warn('[tpa-spp-remote]', scope, error?.message || error);
  return { ok: false, error: error?.message || String(error) };
}

// ─── Konversi nilai ─────────────────────────────────────────────────────

function monthToLocal(billMonth) {
  // 'YYYY-MM-01' -> 'YYYY-MM'
  return typeof billMonth === 'string' && billMonth.length >= 7 ? billMonth.slice(0, 7) : billMonth ?? null;
}

function monthToRemote(billMonth) {
  // 'YYYY-MM' -> 'YYYY-MM-01'
  return typeof billMonth === 'string' && /^\d{4}-\d{2}$/.test(billMonth) ? `${billMonth}-01` : billMonth ?? null;
}

function timestampToIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toNumberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// ─── Normalisasi snake_case (remote) -> camelCase (lokal) ───────────────

function normalizeRemoteType(row) {
  return {
    locationId: row.location_id ?? null,
    name: row.name ?? '',
    amount: toNumberOrNull(row.amount) ?? 0,
    isRecurring: row.is_recurring === true,
    isActive: row.is_active !== false
  };
}

function normalizeRemoteBill(row) {
  return {
    locationId: row.location_id ?? null,
    studentId: row.student_id ?? null,
    sppTypeId: row.spp_type_id ?? null,
    billMonth: monthToLocal(row.bill_month),
    amount: toNumberOrNull(row.amount) ?? 0,
    paidAmount: toNumberOrNull(row.paid_amount) ?? 0,
    status: row.status ?? 'pending',
    isActive: row.is_active !== false
  };
}

function normalizeRemotePayment(row) {
  return {
    billId: row.bill_id ?? null,
    studentId: row.student_id ?? null,
    amount: toNumberOrNull(row.amount) ?? 0,
    method: row.method ?? 'cash',
    paidAt: timestampToIso(row.paid_at),
    isActive: row.is_active !== false
  };
}

function normalizeRemoteCashFlow(row) {
  return {
    locationId: row.location_id ?? null,
    type: row.flow_type ?? 'masuk',
    category: row.category ?? '',
    amount: toNumberOrNull(row.amount) ?? 0,
    description: row.description ?? '',
    transactionDate: row.transaction_date ?? null,
    isActive: row.is_active !== false
  };
}

const SPP_TABLES = Object.freeze({
  types: { remote: 'tpa_spp_types', local: 'sppTypes', normalize: normalizeRemoteType },
  bills: { remote: 'tpa_spp_bills', local: 'sppBills', normalize: normalizeRemoteBill },
  payments: { remote: 'tpa_spp_payments', local: 'payments', normalize: normalizeRemotePayment },
  cashFlows: { remote: 'tpa_cash_flows', local: 'cashFlows', normalize: normalizeRemoteCashFlow }
});

// ─── Upsert remote (match legacy_id = String(record.id)) ────────────────

async function upsertRemoteByLegacy(table, legacyValue, payload, columns) {
  const supabase = client();
  const { data: existing, error: selectError } = await supabase.from(table)
    .select('id,legacy_id')
    .eq('legacy_id', legacyValue)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing) {
    const { data, error } = await supabase.from(table)
      .update(payload)
      .eq('id', existing.id)
      .select(columns)
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from(table)
    .insert(payload)
    .select(columns)
    .single();
  if (error) throw error;
  return data;
}

async function writeBackRemoteId(localTable, localId, remoteId) {
  // Kalau Supabase mengembalikan id uuid, tulis balik ke baris Dexie terkait.
  if (remoteId && localId != null) await localTable.update(localId, { remoteId });
}

// ─── Resolver FK lokal -> uuid remote (student/type/bill) ────────────────

function isUuid(value) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function resolveRefMap(remoteTable, localTable, values) {
  // Peta String(idLokal) -> uuid remote. Urutan resolusi:
  //   1) id yang sudah uuid lolos langsung;
  //   2) field remoteId pada baris lokal (hasil push/pull sebelumnya);
  //   3) lookup remote by legacy_id = String(idLokal) (konvensi seluruh layer remote).
  // Nilai null/'' tidak masuk peta — pemanggil memutuskan (throw/skip).
  const result = new Map();
  const pending = [];
  const seen = new Set();
  for (const original of values) {
    if (original == null || original === '') continue;
    const key = String(original);
    if (seen.has(key)) continue;
    seen.add(key);
    if (isUuid(key)) result.set(key, key);
    else pending.push({ key, original });
  }
  for (const item of pending) {
    if (result.has(item.key)) continue;
    const row = await localTable.get(item.original).catch(() => null);
    if (row?.remoteId) result.set(item.key, String(row.remoteId));
  }
  const unresolved = pending.filter(item => !result.has(item.key)).map(item => item.key);
  if (unresolved.length) {
    const supabase = client();
    const { data, error } = await supabase.from(remoteTable)
      .select('id,legacy_id')
      .in('legacy_id', unresolved);
    if (error) throw error;
    const byLegacy = new Map((data || []).map(row => [String(row.legacy_id), row.id]));
    for (const key of unresolved) result.set(key, byLegacy.get(key) ?? null);
  }
  return result;
}

function requireRef(refMap, value, errorCode) {
  const uuid = value == null || value === '' ? null : refMap.get(String(value));
  if (!uuid) throw new Error(errorCode);
  return uuid;
}

// ─── Pull ───────────────────────────────────────────────────────────────

function findLocalRow(localRows, remoteRow) {
  // Prioritas: remoteId (uuid hasil push/pull sebelumnya), lalu legacy_id vs id lokal.
  const legacy = remoteRow.legacy_id == null ? null : String(remoteRow.legacy_id);
  return localRows.find(row => row.remoteId && row.remoteId === remoteRow.id)
    || (legacy ? localRows.find(row => String(row.id) === legacy) : null);
}

export async function pullSppSnapshot(locationId) {
  try {
    if (!locationId || typeof locationId !== 'string') throw new Error('LOCATION_REQUIRED');
    await requireUser();
    const supabase = client();
    const db = localDb();
    const result = {};
    for (const [key, def] of Object.entries(SPP_TABLES)) {
      const { data, error } = await supabase.from(def.remote).select('*').eq('location_id', locationId);
      if (error) throw error;
      const remoteRows = data || [];
      const localRows = await db[def.local].toArray();
      const byId = new Map(localRows.map(row => [row.id, row]));
      // bill_id uuid remote -> id lokal, hanya bila baris bill terkait ikut ter-pull.
      const billIdByRemote = key === 'payments'
        ? new Map((result.bills || []).filter(bill => bill.remoteId).map(bill => [bill.remoteId, bill.id]))
        : null;
      const merged = [];
      for (const remoteRow of remoteRows) {
        const normalized = def.normalize(remoteRow);
        if (key === 'payments' && remoteRow.bill_id && billIdByRemote?.has(remoteRow.bill_id)) {
          normalized.billId = billIdByRemote.get(remoteRow.bill_id);
        }
        const existing = findLocalRow(localRows, remoteRow);
        // is_active=false remote -> isActive=false lokal; baris lokal TIDAK pernah dihapus.
        const payload = existing
          ? { ...existing, ...normalized, id: existing.id, remoteId: remoteRow.id }
          : { ...normalized, remoteId: remoteRow.id };
        let localId = existing ? existing.id : null;
        if (existing) {
          await db[def.local].put(payload);
        } else {
          // Baris baru: pakai legacy_id numerik sebagai id lokal bila bebas,
          // selain itu biarkan auto-increment Dexie (link tetap via remoteId).
          const legacyNumber = remoteRow.legacy_id == null || String(remoteRow.legacy_id).trim() === ''
            ? NaN
            : Number(remoteRow.legacy_id);
          if (Number.isInteger(legacyNumber) && legacyNumber >= 1 && !byId.has(legacyNumber)) payload.id = legacyNumber;
          localId = await db[def.local].put(payload);
        }
        payload.id = localId;
        byId.set(localId, payload);
        merged.push(payload);
      }
      result[key] = merged;
    }
    return result; // { types, bills, payments, cashFlows }
  } catch (error) {
    return warnFailure('pullSppSnapshot', error);
  }
}

// ─── Push ───────────────────────────────────────────────────────────────

export async function pushSppType(type) {
  try {
    if (!type || type.id == null) throw new Error('SPP_TYPE_ID_REQUIRED');
    await requireUser();
    const payload = {
      legacy_id: String(type.id),
      location_id: type.locationId ?? null,
      name: type.name ?? '',
      amount: toNumberOrNull(type.amount) ?? 0,
      is_recurring: type.isRecurring === true,
      is_active: type.isActive !== false
    };
    const row = await upsertRemoteByLegacy('tpa_spp_types', payload.legacy_id, payload, 'id,legacy_id');
    const remoteId = row?.id ?? null;
    await writeBackRemoteId(localDb().sppTypes, type.id, remoteId);
    return { ok: true, id: remoteId };
  } catch (error) {
    return warnFailure('pushSppType', error);
  }
}

function buildBillPayload(bill, refs) {
  return {
    legacy_id: String(bill.id),
    location_id: bill.locationId ?? null,
    student_id: requireRef(refs.students, bill.studentId, 'SPP_STUDENT_NOT_SYNCED'),
    spp_type_id: requireRef(refs.types, bill.sppTypeId, 'SPP_TYPE_NOT_SYNCED'),
    bill_month: monthToRemote(bill.billMonth),
    amount: toNumberOrNull(bill.amount) ?? 0,
    paid_amount: toNumberOrNull(bill.paidAmount) ?? 0,
    status: bill.status ?? 'pending',
    is_active: bill.isActive !== false
  };
}

async function resolveBillRefMaps(db, bills) {
  return {
    students: await resolveRefMap('tpa_students', db.students, bills.map(bill => bill?.studentId)),
    types: await resolveRefMap('tpa_spp_types', db.sppTypes, bills.map(bill => bill?.sppTypeId))
  };
}

export async function pushSppBill(bill) {
  try {
    if (!bill || bill.id == null) throw new Error('SPP_BILL_ID_REQUIRED');
    await requireUser();
    const db = localDb();
    const refs = await resolveBillRefMaps(db, [bill]);
    const payload = buildBillPayload(bill, refs);
    const row = await upsertRemoteByLegacy('tpa_spp_bills', payload.legacy_id, payload, 'id,legacy_id');
    const remoteId = row?.id ?? null;
    await writeBackRemoteId(db.sppBills, bill.id, remoteId);
    return { ok: true, id: remoteId };
  } catch (error) {
    return warnFailure('pushSppBill', error);
  }
}

export async function pushSppBillsBatch(bills) {
  // Untuk generate tagihan massal: update baris existing by legacy_id,
  // insert sisanya sekaligus. Return { ok, count }.
  try {
    const list = Array.isArray(bills) ? bills : [];
    if (!list.length) return { ok: true, count: 0 };
    await requireUser();
    const supabase = client();
    const db = localDb();
    const refMaps = await resolveBillRefMaps(db, list);
    const prepared = [];
    const skipped = [];
    for (const bill of list) {
      if (!bill || bill.id == null) throw new Error('SPP_BILL_ID_REQUIRED');
      const payload = (() => {
        try { return buildBillPayload(bill, refMaps); }
        catch (error) {
          // Referensi belum ter-sync (student/type tanpa uuid remote): lewati
          // bill ini, jangan kirim payload yang pasti menabrak FK remote.
          console.warn('[tpa-spp-remote]', 'pushSppBillsBatch skip', String(bill.id), error.message);
          skipped.push(String(bill.id));
          return null;
        }
      })();
      if (payload) prepared.push({ bill, payload });
    }
    const existingByLegacy = new Map();
    if (prepared.length) {
      const legacyIds = prepared.map(item => String(item.bill.id));
      const { data: existingRows, error: selectError } = await supabase.from('tpa_spp_bills')
        .select('id,legacy_id')
        .in('legacy_id', legacyIds);
      if (selectError) throw selectError;
      for (const row of existingRows || []) existingByLegacy.set(String(row.legacy_id), row.id);
    }
    const updates = [];
    const inserts = [];
    for (const item of prepared) {
      const { bill, payload } = item;
      const remoteId = existingByLegacy.get(String(bill.id));
      if (remoteId) updates.push({ bill, remoteId, payload });
      else inserts.push({ bill, payload });
    }
    let count = 0;
    for (const item of updates) {
      const { error } = await supabase.from('tpa_spp_bills')
        .update(item.payload)
        .eq('id', item.remoteId)
        .select('id,legacy_id')
        .single();
      if (error) throw error;
      await writeBackRemoteId(db.sppBills, item.bill.id, item.remoteId);
      count += 1;
    }
    if (inserts.length) {
      const { data, error } = await supabase.from('tpa_spp_bills')
        .insert(inserts.map(item => item.payload))
        .select('id,legacy_id');
      if (error) throw error;
      const created = data || [];
      for (let i = 0; i < inserts.length; i += 1) {
        await writeBackRemoteId(db.sppBills, inserts[i].bill.id, created[i]?.id ?? null);
        count += 1;
      }
    }
    return { ok: true, count, skipped };
  } catch (error) {
    return warnFailure('pushSppBillsBatch', error);
  }
}

export async function pushSppPayment(payment) {
  try {
    if (!payment || payment.id == null) throw new Error('SPP_PAYMENT_ID_REQUIRED');
    await requireUser();
    const db = localDb();
    // bill_id remote mengacu uuid tpa_spp_bills (NOT NULL): remoteId lokal dulu,
    // lalu lookup remote by legacy_id; tak ketemu -> error eksplisit (jangan kirim
    // payload yang pasti menabrak FK).
    const bill = payment.billId != null ? await db.sppBills.get(payment.billId) : null;
    let billRemoteId = bill?.remoteId ?? null;
    if (!billRemoteId && payment.billId != null) {
      const { data, error } = await client().from('tpa_spp_bills')
        .select('id,legacy_id')
        .eq('legacy_id', String(payment.billId))
        .maybeSingle();
      if (error) throw error;
      billRemoteId = data?.id ?? null;
    }
    if (!billRemoteId) throw new Error('SPP_BILL_NOT_SYNCED');
    const studentRefs = await resolveRefMap('tpa_students', db.students, [payment.studentId ?? bill?.studentId]);
    const payload = {
      legacy_id: String(payment.id),
      location_id: payment.locationId ?? bill?.locationId ?? null,
      bill_id: billRemoteId,
      student_id: requireRef(studentRefs, payment.studentId ?? bill?.studentId, 'SPP_STUDENT_NOT_SYNCED'),
      amount: toNumberOrNull(payment.amount) ?? 0,
      method: payment.method ?? 'cash',
      paid_at: timestampToIso(payment.paidAt ?? payment.paymentDate),
      is_active: payment.isActive !== false
    };
    const row = await upsertRemoteByLegacy('tpa_spp_payments', payload.legacy_id, payload, 'id,legacy_id');
    const remoteId = row?.id ?? null;
    await writeBackRemoteId(db.payments, payment.id, remoteId);
    return { ok: true, id: remoteId };
  } catch (error) {
    return warnFailure('pushSppPayment', error);
  }
}

export async function pushSppCashFlow(flow) {
  try {
    if (!flow || flow.id == null) throw new Error('SPP_CASH_FLOW_ID_REQUIRED');
    await requireUser();
    const payload = {
      legacy_id: String(flow.id),
      location_id: flow.locationId ?? null,
      flow_type: flow.type ?? 'masuk',
      category: flow.category ?? '',
      amount: toNumberOrNull(flow.amount) ?? 0,
      description: flow.description ?? '',
      transaction_date: flow.transactionDate ?? null,
      is_active: flow.isActive !== false
    };
    const row = await upsertRemoteByLegacy('tpa_cash_flows', payload.legacy_id, payload, 'id,legacy_id');
    const remoteId = row?.id ?? null;
    await writeBackRemoteId(localDb().cashFlows, flow.id, remoteId);
    return { ok: true, id: remoteId };
  } catch (error) {
    return warnFailure('pushSppCashFlow', error);
  }
}

export async function softDeleteSppByStudent(studentId) {
  // Nonaktifkan bills + payments milik satu student di remote (is_active=false).
  // student_id remote mengacu id student versi remote: UUID langsung lolos,
  // lalu remoteId baris lokal, lalu lookup legacy_id; fallback String(studentId).
  try {
    if (studentId == null || studentId === '') throw new Error('SPP_STUDENT_ID_REQUIRED');
    await requireUser();
    const supabase = client();
    const refs = await resolveRefMap('tpa_students', localDb().students, [studentId]);
    const remoteStudentId = refs.get(String(studentId)) ?? String(studentId);
    for (const table of ['tpa_spp_bills', 'tpa_spp_payments']) {
      const { error } = await supabase.from(table).update({ is_active: false }).eq('student_id', remoteStudentId);
      if (error) throw error;
    }
    return { ok: true };
  } catch (error) {
    return warnFailure('softDeleteSppByStudent', error);
  }
}
