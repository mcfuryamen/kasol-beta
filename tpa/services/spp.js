/**
 * SPP Service
 * Semua operasi tagihan dan pembayaran SPP/Infaq
 */
import { db } from '../db/dexie.js';

/** Ambil semua tipe SPP */
export async function getSppTypes(locationId) {
  return db.sppTypes.where('locationId').equals(locationId).and(s => s.isActive).toArray();
}

/** Tambah tipe SPP */
export async function addSppType(data) {
  return db.sppTypes.add({ ...data, isActive: true });
}

/** Update tipe SPP */
export async function updateSppType(id, data) {
  await db.sppTypes.update(id, data);
  return db.sppTypes.get(id);
}

/** Hapus tipe SPP */
export async function deleteSppType(id) {
  await db.sppTypes.update(id, { isActive: false });
}

/** Buat tagihan SPP untuk satu Santi */
export async function createSppBill(studentId, sppTypeId, billMonth, dueDate, amount) {
  const [student, type] = await Promise.all([db.students.get(studentId), db.sppTypes.get(sppTypeId)]);
  if (!student || !type || student.locationId !== type.locationId) throw new Error('Santri dan tipe SPP tidak valid');
  return db.sppBills.add({ locationId: student.locationId, studentId, sppTypeId, billMonth, dueDate, amount, paidAmount: 0, status: 'pending', isActive: true });
}

/** Bulk buat tagihan bulanan untuk semua Santi di satu kelas */
export async function bulkCreateMonthlyBills(classId, sppTypeId, billMonth, dueDate, amount) {
  const cls = await db.classes.get(classId);
  const type = await db.sppTypes.get(sppTypeId);
  if (!cls || !type || cls.locationId !== type.locationId) throw new Error('Kelas dan tipe SPP tidak valid');
  const links = await db.classStudents.where('classId').equals(classId).and(l => l.locationId == null || l.locationId === cls.locationId).toArray();
  const sids = [...new Set(links.map(l => l.studentId))];
  const existing = await db.sppBills
    .where('studentId').anyOf(sids)
    .and(b => b.billMonth === billMonth && b.sppTypeId === sppTypeId)
    .toArray();
  const existSids = new Set(existing.map(b => b.studentId));
  const newSids = sids.filter(sid => !existSids.has(sid));
  const ops = newSids.map(sid => ({
    locationId: cls.locationId, studentId: sid, sppTypeId, billMonth, dueDate,
    amount, paidAmount: 0, status: 'pending', isActive: true
  }));
  if (ops.length) await db.sppBills.bulkAdd(ops);
  return ops.length;
}

/** Ambil tagihan Santi */
export async function getStudentBills(studentId) {
  return db.sppBills.where('studentId').equals(studentId).reverse().sortBy('billMonth');
}

/** Ambil tagihan kelas */
export async function getClassBills(classId) {
  const links = await db.classStudents.where('classId').equals(classId).toArray();
  const sids = [...new Set(links.map(l => l.studentId))];
  if (!sids.length) return [];
  const bills = await db.sppBills.where('studentId').anyOf(sids).toArray();
  const students = await db.students.bulkGet(sids);
  const smap = {};
  students.forEach(s => { if (s) smap[s.id] = s.name; });
  const types = await db.sppTypes.toArray();
  const tmap = {};
  types.forEach(t => { tmap[t.id] = t.name; });
  return bills.map(b => ({
    ...b,
    studentName: smap[b.studentId] || '?',
    sppTypeName: tmap[b.sppTypeId] || '?'
  }));
}

/** Bayar tagihan */
export async function payBill(billId, amount, paymentDate, collectorId) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) throw new Error('Nominal pembayaran tidak valid');
  return db.transaction('rw', db.sppBills, db.payments, async () => {
    const bill = await db.sppBills.get(billId);
    if (!bill || bill.isActive === false) throw new Error('Tagihan tidak ditemukan');
    const student = await db.students.get(bill.studentId);
    if (!student || student.locationId !== bill.locationId) throw new Error('Tagihan tidak valid');
    const remaining = Math.max(0, Number(bill.amount) - Number(bill.paidAmount || 0));
    if (value > remaining) throw new Error('Pembayaran melebihi sisa tagihan');
    const newPaid = Number(bill.paidAmount || 0) + value;
    const newStatus = newPaid >= Number(bill.amount) ? 'paid' : 'partial';
    await db.sppBills.update(billId, { paidAmount: newPaid, status: newStatus });
    await db.payments.add({ billId, studentId: bill.studentId, locationId: bill.locationId, amount: value, paymentDate, collectorId, method: 'cash' });
    return db.sppBills.get(billId);
  });
}

/** Hapus tagihan */
export async function deleteBill(id) {
  await db.sppBills.update(id, { isActive: false });
}

/** Statistik SPP kelas */
export async function getClassSppStats(classId, billMonth) {
  const bills = await getClassBills(classId);
  const monthBills = bills.filter(b => b.billMonth === billMonth);
  const total = monthBills.reduce((s, b) => s + b.amount, 0);
  const paid = monthBills.reduce((s, b) => s + b.paidAmount, 0);
  const pending = monthBills.filter(b => b.status === 'pending').length;
  const partial = monthBills.filter(b => b.status === 'partial').length;
  const paidCount = monthBills.filter(b => b.status === 'paid').length;
  return { total, paid, unpaid: total - paid, pending, partial, paidCount, totalCount: monthBills.length };
}

/** Laporan arus kas */
export async function getCashFlows(locationId, startDate, endDate) {
  return db.cashFlows
    .where('locationId').equals(locationId)
    .and(c => c.transactionDate >= startDate && c.transactionDate <= endDate)
    .toArray();
}

export async function addCashFlow(data) {
  return db.cashFlows.add(data);
}
