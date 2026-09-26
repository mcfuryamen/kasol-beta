/**
 * TPA Dexie Database Schema
 * Arsitektur: Offline-first dengan Dexie/IndexedDB
 * Semua halaman (landing, admin, guru, wali)共用这一个 database instance
 */
import Dexie from '../vendor/dexie.mjs';

const DB_NAME = 'KasirSoloTPADB';
const DB_VERSION = 6;

class TPADatabase extends Dexie {
  constructor() {
    super(DB_NAME);

    // ─── Schema Definition ────────────────────────────────────────────
    // Konvensi index:
    //   ++id  → auto-increment primary key
    //   ,idx  → indexed field (untuk .where().equals())
    //   ,[idx1+idx2] → compound index (Dexie 4+)
    // Skema ini HARUS identik dengan skema aktif di halaman HTML (v4).
    // Jangan ubah tanpa bump DB_VERSION (Dexie gotcha: file pertama yang
    // membuka DB menentukan skema; perubahan skema butuh bump versi).
    this.version(DB_VERSION).stores({
      // Pengaturan global (PK key) — konvensi ekosistem KasirSolo
      settings: 'key',

      // Lokasi TPA (biasanya cuma 1)
      locations: '++id,name',

      // User/login (admin, ustadz, wali)
      users: '++id,role,locationId,name',

      // Wali Santri
      guardians: '++id,locationId,name,phone',

      // Santri
      students: '++id,locationId,guardianId,nis,name,gender,isActive',

      // Ustadz/Guru
      teachers: '++id,locationId,name,gender,isActive',

      // Kelas
      classes: '++id,locationId,name,level,isActive',

      // Junction: Santri ↔ Kelas
      classStudents: '++id,classId,studentId',

      // Junction: Ustadz ↔ Kelas (teacher per class)
      classTeachers: '++id,classId,teacherId,isPrimary',

      // Jadwal mingguan
      schedules: '++id,classId,teacherId,day',

      // Tahun ajaran
      academicYears: '++id,locationId,name,isActive',

      // Kategori kurikulum (Iqro, Hafalan, dll)
      curriculumCategories: '++id,locationId,name,sortOrder',

      // Materi per kategori
      curriculumMaterials: '++id,categoryId,title',

      // Sesi absensi (1 sesi = 1 pertemuan)
      classSessions: '++id,locationId,classId,teacherId,sessionDate',

      // Absensi per siswa per sesi
      attendances: '++id,sessionId,studentId,status',

      // Progress hafalan
      hafalanProgress: '++id,locationId,studentId,teacherId,surahNumber,type,grade,recordedAt',

      // Progress Iqro
      iqroProgress: '++id,locationId,studentId,teacherId,jilid,page,grade,recordedAt',

      // Tipe SPP/Infaq
      sppTypes: '++id,locationId,name,amount',

      // Tagihan per siswa per bulan
      sppBills: '++id,locationId,studentId,sppTypeId,billMonth,status,amount,paidAmount',

      // Pembayaran
      payments: '++id,billId,studentId,amount,method,paidAt',

      // Arus kas
      cashFlows: '++id,locationId,type,category,amount,transactionDate',

      // Proyek
      projects: '++id,locationId,title,status,priority',

      // Task dalam proyek
      projectTasks: '++id,projectId,title,status',

      // Notifikasi
      notifications: '++id,locationId,userId,type,title,isRead,createdAt',

      // Pengaturan app
            appSettings: '++id,locationId,key,value',

            // Audit log pemrosesan data (UU 27/2022 Pasal 31)
                        auditLog: '++id,locationId,userId,userRole,action,entity,entityId,createdAt',

                        // Laporan perlindungan anak (UU 35/2014)
                        protectionReports: '++id,locationId,studentId,type,status,reporterRole,createdAt'
                      });

    // ─── Model Classes (opsional, untuk type-checking) ───────────────
    this.locations = this.table('locations');
    this.users = this.table('users');
    this.guardians = this.table('guardians');
    this.students = this.table('students');
    this.teachers = this.table('teachers');
    this.classes = this.table('classes');
    this.classStudents = this.table('classStudents');
    this.classTeachers = this.table('classTeachers');
    this.schedules = this.table('schedules');
    this.academicYears = this.table('academicYears');
    this.curriculumCategories = this.table('curriculumCategories');
    this.curriculumMaterials = this.table('curriculumMaterials');
    this.classSessions = this.table('classSessions');
    this.attendances = this.table('attendances');
    this.hafalanProgress = this.table('hafalanProgress');
    this.iqroProgress = this.table('iqroProgress');
    this.sppTypes = this.table('sppTypes');
    this.sppBills = this.table('sppBills');
    this.payments = this.table('payments');
    this.cashFlows = this.table('cashFlows');
    this.projects = this.table('projects');
    this.projectTasks = this.table('projectTasks');
    this.notifications = this.table('notifications');
        this.appSettings = this.table('appSettings');
        this.auditLog = this.table('auditLog');
                this.protectionReports = this.table('protectionReports');
                  }

  // ─── Version Migration (kalau ada schema change) ─────────────────
  // Contoh: jika DB_VERSION naik ke 2
  // this.version(2).stores({ ... }).migrate(async (tx) => { ... });
}

// Export singleton instance
const db = new TPADatabase();

/* =========================================================
   Helper: Query Helpers (bukan atomic component, pure data)
   ========================================================= */

// Convert Dexie compound index query
// Dexie doesn't support multiEntry compound indexes,
// jadi pakai .where().equals().and()
async function queryClassStudents(classId) {
  return db.classStudents
    .where('classId').equals(classId)
    .toArray();
}

async function queryClassTeachers(classId) {
  return db.classTeachers
    .where('classId').equals(classId)
    .toArray();
}

async function queryStudentClasses(studentId) {
  return db.classStudents
    .where('studentId').equals(studentId)
    .toArray();
}

async function queryTeacherClasses(teacherId) {
  return db.classTeachers
    .where('teacherId').equals(teacherId)
    .toArray();
}

async function queryStudentAttendances(studentId) {
  return db.attendances
    .where('studentId').equals(studentId)
    .toArray();
}

async function querySessionAttendances(sessionId) {
  return db.attendances
    .where('sessionId').equals(sessionId)
    .toArray();
}

async function queryStudentHafalan(studentId) {
  return db.hafalanProgress
    .where('studentId').equals(studentId)
    .toArray();
}

async function queryGuardianStudents(guardianId) {
  return db.students
    .where('guardianId').equals(guardianId)
    .toArray();
}

export {
  db,
  queryClassStudents,
  queryClassTeachers,
  queryStudentClasses,
  queryTeacherClasses,
  queryStudentAttendances,
  querySessionAttendances,
  queryStudentHafalan,
  queryGuardianStudents
};
