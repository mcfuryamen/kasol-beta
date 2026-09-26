/**
 * Dashboard Service
 * Statistik ringkasan untuk dashboard semua role
 */
import { db } from '../db/dexie.js';

/** Statistik utama untuk dashboard admin */
export async function getAdminDashboard(locationId) {
  const today = new Date().toISOString().split('T')[0];
  const [
    studentCount,
    teacherCount,
    classCount,
    guardianCount,
    todaySessions,
    recentAttendances,
    cashIn,
    cashOut,
    pendingSpp
  ] = await Promise.all([
    db.students.where('locationId').equals(locationId).and(s => s.isActive).count(),
    db.teachers.where('locationId').equals(locationId).and(t => t.isActive).count(),
    db.classes.where('locationId').equals(locationId).and(c => c.isActive).count(),
    db.guardians.where('locationId').equals(locationId).and(g => g.isActive).count(),
    db.classSessions.where('sessionDate').equals(today).count(),
    db.attendances.count(),
    db.cashFlows.where('locationId').equals(locationId).and(c => c.type === 'masuk' && c.transactionDate === today).toArray(),
    db.cashFlows.where('locationId').equals(locationId).and(c => c.type === 'keluar' && c.transactionDate === today).toArray(),
    db.sppBills.where('status').anyOf(['pending', 'partial']).count()
  ]);

  const todayIncome = cashIn.reduce((s, c) => s + c.amount, 0);
  const todayExpense = cashOut.reduce((s, c) => s + c.amount, 0);

  return {
    studentCount, teacherCount, classCount, guardianCount,
    todaySessions, recentAttendances, pendingSpp,
    todayIncome, todayExpense, todayBalance: todayIncome - todayExpense
  };
}

/** Dashboard untuk ustadz (guru) */
export async function getTeacherDashboard(teacherId) {
  const today = new Date().toISOString().split('T')[0];
  const [
    myClasses,
    todaySessions,
    recentHafalan,
    recentAttendances
  ] = await Promise.all([
    db.classTeachers.where('teacherId').equals(teacherId).toArray(),
    db.classSessions.where('teacherId').equals(teacherId).and(s => s.sessionDate === today).toArray(),
    db.hafalanProgress.where('teacherId').equals(teacherId).reverse().sortBy('recordedAt'),
    db.attendances.count()
  ]);

  const cids = [...new Set(myClasses.map(c => c.classId))];
  const classes = cids.length ? await db.classes.bulkGet(cids) : [];
  const activeClasses = classes.filter(Boolean);

  return {
    teacherId,
    totalClasses: activeClasses.length,
    todaySessions: todaySessions.length,
    recentHafalanCount: recentHafalan.slice(0, 10).length,
    recentAttendances,
    classes: activeClasses
  };
}

/** Dashboard untuk wali */
export async function getGuardianDashboard(guardianId) {
  const [
    students,
    recentHafalan
  ] = await Promise.all([
    db.students.where('guardianId').equals(guardianId).and(s => s.isActive).toArray(),
    db.hafalanProgress.toArray()
  ]);

  const sids = students.map(s => s.id);
  const allBills = await db.sppBills.where('studentId').anyOf(sids.length ? sids : [0]).toArray();
  const studentBills = allBills;
  const pendingBills = studentBills.filter(b => b.status !== 'paid');
  const totalPending = pendingBills.reduce((s, b) => s + (b.amount - b.paidAmount), 0);

  const myHafalan = recentHafalan
    .filter(h => sids.includes(h.studentId))
    .slice(0, 5);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const thisMonthBills = studentBills.filter(b => b.billMonth.startsWith(thisMonth));
  const thisMonthPaid = thisMonthBills.filter(b => b.status === 'paid').length;

  // Nama santri untuk tiap tagihan
  const pendingBillsWithNames = pendingBills.map(b => {
    const student = students.find(s => s.id === b.studentId);
    return { ...b, studentName: student ? student.name : '' };
  });

  // Kehadiran per anak (dari semua sesi yang sudah ada)
  const allSessions = await db.classSessions.toArray();
  const sessionIds = allSessions.map(s => s.id);
  const sessionAtts = sessionIds.length
    ? await db.attendances.where('sessionId').anyOf(sessionIds).toArray()
    : [];
  const attStats = {};
  for (const a of sessionAtts.filter(a => sids.includes(a.studentId))) {
    if (!attStats[a.studentId]) attStats[a.studentId] = { present: 0, total: 0 };
    attStats[a.studentId].total++;
    if (a.status === 'present' || a.status === 'hadir') attStats[a.studentId].present++;
  }
  const attendancePercentage = {};
  for (const sid of sids) {
    const st = attStats[sid];
    attendancePercentage[sid] = st && st.total > 0 ? Math.round(st.present / st.total * 100) : 0;
  }
  for (const s of students) {
    s.attendancePercentage = attendancePercentage[s.id] || 0;
  }

  return {
    students,
    totalStudents: students.length,
    pendingBillCount: pendingBills.length,
    totalPendingAmount: totalPending,
    thisMonthTotal: thisMonthBills.length,
    thisMonthPaid,
    recentHafalan: myHafalan,
    stats: {
      totalHafalan: myHafalan.filter(h => h.status === 'completed').length,
      tagihanTertunda: totalPending,
      rataKehadiran: students.length
        ? Math.round(students.reduce((sum, s) => sum + (s.attendancePercentage || 0), 0) / students.length)
        : 0
    },
    pendingBills: pendingBillsWithNames
  };
}
