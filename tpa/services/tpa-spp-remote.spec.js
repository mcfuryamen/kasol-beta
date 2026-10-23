/**
 * Spec untuk services/tpa-spp-remote.js (lapisan sync SPP offline-first).
 * Gaya mengikuti spec remote existing (assert Node, mock Supabase + fake Dexie).
 */
import assert from 'node:assert/strict';
import {
  pullSppSnapshot,
  pushSppType,
  pushSppBill,
  pushSppBillsBatch,
  pushSppPayment,
  pushSppCashFlow,
  softDeleteSppByStudent
} from './tpa-spp-remote.js';

// ─── Fake Dexie (cukup untuk pola get/put/update/toArray yang dipakai modul) ──
function makeFakeTable(initialRows = []) {
  let seq = initialRows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0);
  const rows = new Map(initialRows.map(row => [row.id, { ...row }]));
  return {
    async get(id) { return rows.has(id) ? { ...rows.get(id) } : undefined; },
    async put(row) {
      if (row.id === undefined) row.id = ++seq;
      rows.set(row.id, { ...row });
      return row.id;
    },
    async update(id, changes) {
      const row = rows.get(id);
      if (!row) return 0;
      Object.assign(row, changes);
      rows.set(id, { ...row });
      return 1;
    },
    async toArray() { return [...rows.values()].map(row => ({ ...row })); },
    count() { return rows.size; },
    all() { return [...rows.values()]; }
  };
}

function makeFakeDb() {
  return {
    students: makeFakeTable(),
    sppTypes: makeFakeTable(),
    sppBills: makeFakeTable(),
    payments: makeFakeTable(),
    cashFlows: makeFakeTable()
  };
}

// ─── Mock Supabase (query builder minimal sesuai pemakaian modul) ──────────
function makeSupabaseMock(seed = {}) {
  const rowsByTable = new Map(Object.entries(seed).map(([table, rows]) => [table, rows.map(row => ({ ...row }))]));
  const calls = [];
  let uuidSeq = 0;
  let failNext = null; // { message } -> error sekali lalu reset

  function from(table) {
    const rows = rowsByTable.get(table) || (rowsByTable.set(table, []), rowsByTable.get(table));
    const state = { op: 'select', payload: null, filters: [] };
    const builder = {
      select() { return builder; },
      eq(column, value) { state.filters.push({ column, value }); return builder; },
      in(column, values) { state.filters.push({ column, values }); return builder; },
      order() { return builder; },
      limit() { return builder; },
      update(payload) { state.op = 'update'; state.payload = payload; return builder; },
      insert(payload) { state.op = 'insert'; state.payload = payload; return builder; },
      async maybeSingle() { return exec('maybeSingle'); },
      async single() { return exec('single'); },
      then(onFulfilled, onRejected) { return exec('list').then(onFulfilled, onRejected); }
    };
    function match(row) {
      return state.filters.every(filter => 'values' in filter
        ? filter.values.includes(row[filter.column])
        : row[filter.column] === filter.value);
    }
    async function exec(mode) {
      calls.push({ table, op: state.op, filters: state.filters.map(f => ({ ...f })), payload: state.payload });
      if (failNext) {
        const error = failNext;
        failNext = null;
        return { data: null, error };
      }
      if (state.op === 'select') {
        const found = rows.filter(match);
        if (mode === 'maybeSingle') return { data: found[0] || null, error: null };
        if (mode === 'single') return { data: found[0] || null, error: found[0] ? null : { message: 'ROW_NOT_FOUND' } };
        return { data: found, error: null };
      }
      if (state.op === 'update') {
        let matched = 0;
        for (const row of rows) if (match(row)) { Object.assign(row, state.payload); matched += 1; }
        if (mode === 'list') return { data: rows.filter(match), error: null };
        const first = rows.find(match);
        return { data: first || null, error: matched ? null : { message: 'UPDATE_MISS' } };
      }
      if (state.op === 'insert') {
        const incoming = Array.isArray(state.payload) ? state.payload : [state.payload];
        const created = incoming.map(payload => ({ id: `uuid-${++uuidSeq}`, ...payload }));
        rows.push(...created);
        if (mode === 'single' || mode === 'maybeSingle') return { data: created[0] || null, error: null };
        return { data: created, error: null };
      }
      return { data: null, error: { message: 'OP_TIDAK_DIDUKUNG' } };
    }
    return builder;
  }

  return {
    client: {
      from,
      auth: { getUser: async () => ({ data: { user: { id: 'auth-user-1' } }, error: null }) }
    },
    calls,
    rowsOf: table => rowsByTable.get(table) || [],
    failOnce: message => { failNext = { message }; }
  };
}

// ─── Setup global (seam modul) ──────────────────────────────────────────────
const LOCATION = 'loc-remote-1';
const fakeDb = makeFakeDb();
const supabaseMock = makeSupabaseMock({
  tpa_spp_types: [
    { id: 'uuid-type-1', legacy_id: '11', location_id: LOCATION, name: 'Syahriyah', amount: 50000, is_recurring: true, is_active: true },
    { id: 'uuid-type-2', legacy_id: null, location_id: LOCATION, name: 'Infaq', amount: 10000, is_recurring: false, is_active: false }
  ],
  tpa_spp_bills: [
    { id: 'uuid-bill-1', legacy_id: '21', location_id: LOCATION, student_id: 'uuid-student-1', spp_type_id: 'uuid-type-1', bill_month: '2026-10-01', amount: 50000, paid_amount: 20000, status: 'partial', is_active: true }
  ],
  tpa_spp_payments: [
    { id: 'uuid-pay-1', legacy_id: '31', location_id: LOCATION, bill_id: 'uuid-bill-1', student_id: 'uuid-student-1', amount: 20000, method: 'cash', paid_at: '2026-10-05T03:00:00.000Z', is_active: true }
  ],
  tpa_cash_flows: [
    { id: 'uuid-cash-1', legacy_id: '41', location_id: LOCATION, flow_type: 'masuk', category: 'spp', amount: 20000, description: 'Setoran', transaction_date: '2026-10-05', is_active: true }
  ],
  // Referensi FK: resolver student memetakan legacy_id lokal -> uuid remote.
  tpa_students: [
    { id: 'uuid-student-1', legacy_id: 'stu-1', location_id: LOCATION },
    { id: 'uuid-student-2', legacy_id: 'stu-2', location_id: LOCATION },
    { id: 'uuid-student-3', legacy_id: 'stu-3', location_id: LOCATION }
  ]
});
globalThis.__TPA_SUPABASE_CLIENT__ = supabaseMock.client;
globalThis.__TPA_SPP_LOCAL_DB__ = fakeDb;

// Baris lokal pre-existing: id 11 cocok legacy_id remote; id 99 hanya lokal.
fakeDb.sppTypes.put({ id: 11, locationId: LOCATION, name: 'Syahriyah (lokal)', amount: 45000, isRecurring: false, isActive: true });
fakeDb.sppTypes.put({ id: 99, locationId: LOCATION, name: 'Hanya Lokal', amount: 1000, isRecurring: false, isActive: true });

// ─── pullSppSnapshot ────────────────────────────────────────────────────────
{
  const snapshot = await pullSppSnapshot(LOCATION);
  assert.equal(snapshot.ok, undefined, 'sukses pull tidak membawa ok:false');
  assert.equal(snapshot.types.length, 2);
  assert.equal(snapshot.bills.length, 1);
  assert.equal(snapshot.payments.length, 1);
  assert.equal(snapshot.cashFlows.length, 1);

  // Baris lokal id 11 (legacy_id 11) di-update, bukan ditambah/dihapus.
  const merged = snapshot.types.find(row => row.id === 11);
  assert.ok(merged, 'baris lokal legacy tetap dipertahankan');
  assert.equal(merged.name, 'Syahriyah');
  assert.equal(merged.amount, 50000);
  assert.equal(merged.isRecurring, true);
  assert.equal(merged.remoteId, 'uuid-type-1');
  // Lokal = 11 + 99 + Infaq (baru). Baris lokal-only (99) tidak pernah dihapus.
  assert.equal(fakeDb.sppTypes.count(), 3);
  assert.equal(snapshot.types.some(row => row.id === 99), false, 'row lokal-only tidak ikut snapshot (sumber: remote)');

  // Baris baru dari remote (tanpa legacy_id) dapat id auto, is_active=false -> isActive=false.
  const inaktif = snapshot.types.find(row => row.name === 'Infaq');
  assert.ok(inaktif && inaktif.id !== undefined && inaktif.id !== 11, 'baris baru dapat id lokal sendiri');
  assert.equal(inaktif.isActive, false);
  const storedInaktif = await fakeDb.sppTypes.get(inaktif.id);
  assert.equal(storedInaktif.isActive, false);

  // Mapping bill_month 'YYYY-MM-01' -> billMonth 'YYYY-MM'.
  const bill = snapshot.bills[0];
  assert.equal(bill.billMonth, '2026-10');
  assert.equal(bill.paidAmount, 20000);
  assert.equal(bill.status, 'partial');

  // Mapping flow_type -> type.
  const cashFlow = snapshot.cashFlows[0];
  assert.equal(cashFlow.type, 'masuk');
  assert.equal(cashFlow.transactionDate, '2026-10-05');

  // Payment: bill_id uuid -> id lokal bill (baris bill ikut ter-pull).
  const payment = snapshot.payments[0];
  assert.equal(payment.billId, bill.id, 'bill_id uuid dipetakan ke id lokal');
  assert.equal(payment.paidAt, '2026-10-05T03:00:00.000Z');

  // Re-pull idempoten: tidak menambah baris lokal ganda.
  const before = fakeDb.sppTypes.count();
  await pullSppSnapshot(LOCATION);
  assert.equal(fakeDb.sppTypes.count(), before, 're-pull tidak menduplikasi baris');
}

// ─── pullSppSnapshot: gagal jaringan -> { ok:false, error }, Dexie utuh ─────
{
  supabaseMock.failOnce('NETWORK_DOWN');
  const failed = await pullSppSnapshot(LOCATION);
  assert.equal(failed.ok, false);
  assert.equal(failed.error, 'NETWORK_DOWN');
  assert.equal(fakeDb.sppTypes.count(), 3, 'Dexie tetap utuh saat pull gagal');
}

// ─── pullSppSnapshot: validasi location ─────────────────────────────────────
{
  const invalid = await pullSppSnapshot('');
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error, 'LOCATION_REQUIRED');
}

// ─── pushSppType: insert baru + tulis balik remoteId ────────────────────────
{
  fakeDb.sppTypes.put({ id: 12, locationId: LOCATION, name: 'Seragam', amount: 75000, isRecurring: false, isActive: true });
  const result = await pushSppType({ id: 12, locationId: LOCATION, name: 'Seragam', amount: 75000, isRecurring: false, isActive: true });
  assert.equal(result.ok, true);
  assert.ok(typeof result.id === 'string' && result.id.startsWith('uuid-'), 'Supabase mengembalikan id uuid');
  const localRow = await fakeDb.sppTypes.get(12);
  assert.equal(localRow.remoteId, result.id, 'remoteId ditulis balik ke Dexie');
  const pushed = supabaseMock.rowsOf('tpa_spp_types').find(row => row.legacy_id === '12');
  assert.equal(pushed.name, 'Seragam');
  assert.equal(pushed.is_recurring, false);
  assert.equal(pushed.is_active, true);
}

// ─── pushSppType: update baris existing (match legacy_id) ───────────────────
{
  const result = await pushSppType({ id: 11, locationId: LOCATION, name: 'Syahriyah Naik', amount: 60000, isRecurring: true, isActive: true });
  assert.equal(result.ok, true);
  assert.equal(result.id, 'uuid-type-1', 'existing di-match legacy_id, tidak insert ganda');
  const row = supabaseMock.rowsOf('tpa_spp_types').find(item => item.legacy_id === '11');
  assert.equal(row.name, 'Syahriyah Naik');
  assert.equal(row.amount, 60000);
}

// ─── pushSppType: gagal jaringan -> { ok:false, error } ─────────────────────
{
  supabaseMock.failOnce('CONNECTION_REFUSED');
  const result = await pushSppType({ id: 12, locationId: LOCATION, name: 'Seragam', amount: 75000 });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'CONNECTION_REFUSED');
}

// ─── pushSppBill ────────────────────────────────────────────────────────────
{
  fakeDb.sppBills.put({ id: 22, locationId: LOCATION, studentId: 'stu-1', sppTypeId: 11, billMonth: '2026-11', amount: 60000, paidAmount: 0, status: 'pending', isActive: true });
  const result = await pushSppBill({ id: 22, locationId: LOCATION, studentId: 'stu-1', sppTypeId: 11, billMonth: '2026-11', amount: 60000, paidAmount: 0, status: 'pending', isActive: true });
  assert.equal(result.ok, true);
  const pushed = supabaseMock.rowsOf('tpa_spp_bills').find(row => row.legacy_id === '22');
  assert.equal(pushed.bill_month, '2026-11-01', 'billMonth lokal dikonversi ke tanggal remote');
  assert.equal(pushed.status, 'pending');
}

// ─── pushSppBillsBatch: campuran insert + update ────────────────────────────
{
  fakeDb.sppBills.put({ id: 23, locationId: LOCATION, studentId: 'stu-2', sppTypeId: 11, billMonth: '2026-11', amount: 60000, paidAmount: 0, status: 'pending', isActive: true });
  fakeDb.sppBills.put({ id: 24, locationId: LOCATION, studentId: 'stu-3', sppTypeId: 11, billMonth: '2026-11', amount: 60000, paidAmount: 0, status: 'pending', isActive: true });
  const result = await pushSppBillsBatch([
    { id: 21, locationId: LOCATION, studentId: 'stu-1', sppTypeId: 11, billMonth: '2026-10', amount: 50000, paidAmount: 20000, status: 'partial', isActive: true },
    { id: 23, locationId: LOCATION, studentId: 'stu-2', sppTypeId: 11, billMonth: '2026-11', amount: 60000, paidAmount: 0, status: 'pending', isActive: true },
    { id: 24, locationId: LOCATION, studentId: 'stu-3', sppTypeId: 11, billMonth: '2026-11', amount: 60000, paidAmount: 0, status: 'pending', isActive: true }
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.count, 3, 'semua bill ter-push (1 update existing + 2 insert)');
  const legacyIds = supabaseMock.rowsOf('tpa_spp_bills').map(row => row.legacy_id);
  assert.ok(legacyIds.includes('21') && legacyIds.includes('23') && legacyIds.includes('24'));
  const storedBill = await fakeDb.sppBills.get(23);
  assert.equal(storedBill.remoteId !== undefined, true, 'remoteId ditulis balik untuk baris baru');
}

// ─── pushSppBillsBatch: gagal jaringan ──────────────────────────────────────
{
  supabaseMock.failOnce('BATCH_DOWN');
  const result = await pushSppBillsBatch([{ id: 25, locationId: LOCATION, studentId: 'stu-4', sppTypeId: 11, billMonth: '2026-11', amount: 60000, paidAmount: 0, status: 'pending' }]);
  assert.equal(result.ok, false);
  assert.equal(result.error, 'BATCH_DOWN');
}

// ─── pushSppPayment: bill_id memakai remoteId bill lokal ────────────────────
{
  fakeDb.payments.put({ id: 32, billId: 21, studentId: 'stu-1', amount: 30000, method: 'cash', paidAt: '2026-10-06T10:00:00+07:00' });
  const result = await pushSppPayment({ id: 32, billId: 21, studentId: 'stu-1', amount: 30000, method: 'cash', paidAt: '2026-10-06T10:00:00+07:00' });
  assert.equal(result.ok, true);
  const pushed = supabaseMock.rowsOf('tpa_spp_payments').find(row => row.legacy_id === '32');
  assert.equal(pushed.bill_id, 'uuid-bill-1', 'bill_id = remoteId bill yang sudah sync');
  assert.equal(pushed.paid_at, '2026-10-06T03:00:00.000Z', 'paidAt lokal dikonversi ke ISO UTC');
}

// ─── pushSppCashFlow: type -> flow_type ─────────────────────────────────────
{
  fakeDb.cashFlows.put({ id: 42, locationId: LOCATION, type: 'keluar', category: 'operasional', amount: 15000, description: 'Listrik', transactionDate: '2026-10-06' });
  const result = await pushSppCashFlow({ id: 42, locationId: LOCATION, type: 'keluar', category: 'operasional', amount: 15000, description: 'Listrik', transactionDate: '2026-10-06' });
  assert.equal(result.ok, true);
  const pushed = supabaseMock.rowsOf('tpa_cash_flows').find(row => row.legacy_id === '42');
  assert.equal(pushed.flow_type, 'keluar');
  assert.equal(pushed.transaction_date, '2026-10-06');
}

// ─── softDeleteSppByStudent ─────────────────────────────────────────────────
{
  fakeDb.students.put({ id: 7, locationId: LOCATION, name: 'Santri Tujuh', remoteId: 'uuid-student-7' });
  const result = await softDeleteSppByStudent(7);
  assert.equal(result.ok, true);
  // Ambil call terakhir per tabel (call sebelumnya milik test push batch).
  const billUpdate = [...supabaseMock.calls].reverse().find(call => call.table === 'tpa_spp_bills' && call.op === 'update');
  const payUpdate = [...supabaseMock.calls].reverse().find(call => call.table === 'tpa_spp_payments' && call.op === 'update');
  assert.equal(billUpdate.filters[0].column, 'student_id');
  assert.equal(billUpdate.filters[0].value, 'uuid-student-7', 'pakai remoteId student lokal');
  assert.equal(billUpdate.payload.is_active, false);
  assert.equal(payUpdate.filters[0].value, 'uuid-student-7');
  assert.equal(payUpdate.payload.is_active, false);
}

// ─── SUPABASE_NOT_READY: tidak throw, return { ok:false } ───────────────────
{
  const savedClient = globalThis.__TPA_SUPABASE_CLIENT__;
  delete globalThis.__TPA_SUPABASE_CLIENT__;
  try {
    const pushResult = await pushSppType({ id: 12, locationId: LOCATION, name: 'Seragam', amount: 75000 });
    assert.equal(pushResult.ok, false);
    assert.equal(pushResult.error, 'SUPABASE_NOT_READY');
    const pullResult = await pullSppSnapshot(LOCATION);
    assert.equal(pullResult.ok, false);
    assert.equal(pullResult.error, 'SUPABASE_NOT_READY');
  } finally {
    globalThis.__TPA_SUPABASE_CLIENT__ = savedClient;
  }
}

// ─── Resolver FK: student/type lokal -> uuid remote ─────────────────────────
{
  // Student lokal id 5 punya remoteId; type lokal 11 di-match via legacy_id remote.
  await fakeDb.students.put({ id: 5, name: 'Ahmad', remoteId: 'uuid-student-5' });
  await fakeDb.sppBills.put({ id: 60, locationId: LOCATION, studentId: 5, sppTypeId: 11, billMonth: '2026-10', amount: 50000, paidAmount: 0, status: 'pending' });
  const pushResult = await pushSppBill({ id: 60, locationId: LOCATION, studentId: 5, sppTypeId: 11, billMonth: '2026-10', amount: 50000, paidAmount: 0, status: 'pending' });
  assert.equal(pushResult.ok, true);
  const billInsert = [...supabaseMock.calls].reverse().find(call => call.table === 'tpa_spp_bills' && call.op === 'insert');
  assert.equal(billInsert.payload.student_id, 'uuid-student-5', 'studentId lokal -> remoteId baris lokal');
  assert.equal(billInsert.payload.spp_type_id, 'uuid-type-1', 'sppTypeId lokal 11 -> legacy_id remote');
  const localBill = await fakeDb.sppBills.get(60);
  assert.equal(localBill.remoteId, pushResult.id, 'uuid remote ditulis balik ke baris lokal');

  // Student yang belum pernah sync -> { ok:false } + TIDAK ada insert remote.
  const failResult = await pushSppBill({ id: 61, locationId: LOCATION, studentId: 77, sppTypeId: 11, billMonth: '2026-10', amount: 50000, status: 'pending' });
  assert.equal(failResult.ok, false);
  assert.equal(failResult.error, 'SPP_STUDENT_NOT_SYNCED');
  assert.ok(!supabaseMock.rowsOf('tpa_spp_bills').some(row => String(row.legacy_id) === '61'), 'tidak ada insert dengan FK belum terpeta');
}

// ─── pushSppPayment: bill_id & student_id ter-resolve ke uuid remote ────────
{
  const payResult = await pushSppPayment({ id: 62, billId: 60, studentId: 5, locationId: LOCATION, amount: 25000, method: 'cash', paidAt: '2026-10-12T03:00:00.000Z' });
  assert.equal(payResult.ok, true);
  const payInsert = [...supabaseMock.calls].reverse().find(call => call.table === 'tpa_spp_payments' && call.op === 'insert');
  assert.equal(payInsert.payload.bill_id, (await fakeDb.sppBills.get(60)).remoteId, 'bill_id pakai uuid remote bill');
  assert.equal(payInsert.payload.student_id, 'uuid-student-5');
}

// ─── Bersih-bersih seam supaya spec lain tidak terpengaruh ──────────────────
delete globalThis.__TPA_SPP_LOCAL_DB__;
console.log('TPA SPP remote sync tests: PASS');
