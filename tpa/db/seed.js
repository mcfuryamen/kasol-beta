/**
 * TPA Seed Data Module
 * Demo data untuk development dan demo mode
 * Aman di-run berkali-kali (cek existing data dulu)
 */
import { db } from './dexie.js';

// Tanggal lokal (hindari bug UTC toISOString)
function localDate() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function localDateTime(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') +
    'T' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
}

export async function seedDemoData() {
  // ─── Cegah double-seed ────────────────────────────────────────
  // Skip hanya jika sudah ada santri (data penuh). Lokasi/user saja
  // (state parsial dari ensureSeed lama) tetap di-seed ulang.
  if (await db.students.count() > 0) {
    console.log('[seed] Data already exists, skipping seed.');
    // DB lama (pra-tabel-users) mungkin belum punya akun user — migrasi
    await ensureUsersSeeded();
    return;
  }

  console.log('[seed] Seeding demo data...');

  // ─── 1. Lokasi TPA (reuse jika sudah ada) ─────────────────────
  let lid;
  const existingLocs = await db.locations.toArray();
  if (existingLocs.length) {
    lid = existingLocs[0].id;
  } else {
    lid = await db.locations.add({
      name: 'TPA Al-Hikmah',
      address: 'Jl. Masjid No. 1, Kampung Bahagia',
      phone: '08816566935',
      headName: 'Ustadz Ahmad',
      isActive: true
    });
  }

  // ─── 2. Tahun Ajaran ──────────────────────────────────────────
  await db.academicYears.add({
    locationId: lid,
    name: '2026/2027',
    semester: 'ganjil',
    startDate: '2026-07-01',
    endDate: '2026-12-31',
    isActive: true
  });

  // ─── 3. Kurikulum Kategori + Materi ──────────────────────────
  const cats = [
    'Iqro / Baca Tulis Al-Quran',
    'Hafalan Al-Quran',
    'Tajwid',
    'Fiqh Ibadah',
    'Akhlak & Adab',
    'Doa Harian',
    'Sirah Nabi'
  ];

  const mats = {
    0: ['Pengenalan Huruf Hijaiyah', 'Harakat Dasar', 'Huruf Bersambung', 'Tanwin', 'Sukun & Tasydid', "Mad Thobi'i"],
    1: ['Al-Fatihah', 'An-Nas', 'Al-Falaq', 'Al-Ikhlas', 'Al-Lahab', 'An-Nasr', 'Al-Kafirun', 'Al-Kausar'],
    2: ["Nun Mati & Tanwin", 'Mim Mati', "Mad Far'i", 'Waqaf & Ibtida', 'Idgham', 'Ikhfa'],
    3: ['Thaharah', 'Wudhu', 'Shalat 5 Waktu', 'Shalat Berjamaah', 'Puasa Ramadhan'],
    4: ['Adab Makan & Minum', 'Adab Tidur', 'Adab di Masjid', 'Adab kepada Orang Tua', 'Kejujuran'],
    5: ['Doa Sebelum Makan', 'Doa Masuk Masjid', 'Doa Sebelum Tidur', 'Doa Belajar', 'Doa untuk Orang Tua'],
    6: ['Kelahiran Nabi', 'Turunnya Wahyu', 'Dakwah di Mekkah', 'Hijrah ke Madinah', 'Fathu Makkah']
  };

  for (let i = 0; i < cats.length; i++) {
    const catId = await db.curriculumCategories.add({
      locationId: lid,
      name: cats[i],
      sortOrder: i + 1,
      isActive: true
    });
    const ml = mats[i] || [];
    for (let j = 0; j < ml.length; j++) {
      await db.curriculumMaterials.add({
        categoryId: catId,
        title: ml[j],
        sortOrder: j + 1,
        level: i <= 1 ? 'Dasar' : 'Menengah',
        durationMinutes: 30,
        isActive: true
      });
    }
  }

  // ─── 4. Tipe SPP ─────────────────────────────────────────────
  await db.sppTypes.bulkAdd([
    { locationId: lid, name: 'SPP Bulanan', amount: 50000, isRecurring: true, isActive: true },
    { locationId: lid, name: 'Infaq', amount: 10000, isRecurring: true, isActive: true }
  ]);

  // ─── 5. Guardian/Wali ─────────────────────────────────────────
  const g1 = await db.guardians.add({ locationId: lid, name: 'Bapak Ahmad', relation: 'ayah', phone: '081234567890', address: 'Kampung Bahagia', isActive: true });
  const g2 = await db.guardians.add({ locationId: lid, name: 'Ibu Fatimah', relation: 'ibu', phone: '081234567891', address: 'Kampung Makmur', isActive: true });
  const g3 = await db.guardians.add({ locationId: lid, name: 'Bapak Rahman', relation: 'ayah', phone: '081234567892', address: 'Kampung Jaya', isActive: true });
  const g4 = await db.guardians.add({ locationId: lid, name: 'Ibu Siti', relation: 'ibu', phone: '081234567893', address: 'Kampung Harmoni', isActive: true });

  // ─── 6. Ustadz ────────────────────────────────────────────────
  const t1 = await db.teachers.add({ locationId: lid, name: 'Ustadz Hasan', gender: 'L', phone: '081111222333', specialization: 'Hafalan', qualification: 'diniyah_atas', tartil: 'lancar', isActive: true });
    const t2 = await db.teachers.add({ locationId: lid, name: 'Ustadzah Maryam', gender: 'P', phone: '081444555666', specialization: 'Iqro', qualification: 'diniyah_atas', tartil: 'lancar', isActive: true });

  // ─── 7. User accounts ─────────────────────────────────────────
    if (await db.users.count() === 0) {
      await db.users.bulkAdd([
        { name: 'Admin TPA', role: 'admin', locationId: lid, isActive: true },
        { name: 'Ustadz Hasan', role: 'ustadz', locationId: lid, teacherId: t1, isActive: true },
        { name: 'Ustadzah Maryam', role: 'ustadz', locationId: lid, teacherId: t2, isActive: true },
        { name: 'Bapak Ahmad', role: 'wali', locationId: lid, guardianId: g1, isActive: true }
      ]);
    }

  // ─── 8. Kelas ─────────────────────────────────────────────────
  const c1 = await db.classes.add({ locationId: lid, name: 'Iqro 1-2', level: 'iqro_1', maxStudents: 20, room: 'Ruang 1', isActive: true });
  const c2 = await db.classes.add({ locationId: lid, name: 'Juz Amma', level: 'juz_amma', maxStudents: 15, room: 'Ruang 2', isActive: true });
  const c3 = await db.classes.add({ locationId: lid, name: 'Tahfidz 1', level: 'tahfidz', maxStudents: 10, room: 'Ruang 3', isActive: true });

  // ─── 9. Class-Teacher assignments ──────────────────────────────
  await db.classTeachers.bulkAdd([
    { classId: c1, teacherId: t2, isPrimary: true },
    { classId: c2, teacherId: t1, isPrimary: true },
    { classId: c3, teacherId: t1, isPrimary: false },
    { classId: c3, teacherId: t2, isPrimary: true }
  ]);

  // ─── 10. Santri ────────────────────────────────────────────────
  const ns = [
    ['Muhammad Rizki', 'L', g1],
    ['Aisyah Putri', 'P', g1],
    ['Abdullah', 'L', g2],
    ['Khadijah', 'P', g2],
    ['Umar Faruq', 'L', g3],
    ['Hafizah', 'P', g4],
    ['Bilal', 'L', g1],
    ['Fatimah', 'P', g3],
    ['Hasan', 'L', g2],
    ['Aminah', 'P', g4],
    ['Yusuf', 'L', g3],
    ['Zahra', 'P', g1]
  ];

  for (let i = 0; i < ns.length; i++) {
    const sid = await db.students.add({
      locationId: lid,
      guardianId: ns[i][2],
      nis: 'TPA-2026-' + String(i + 1).padStart(3, '0'),
      name: ns[i][0],
      gender: ns[i][1],
      joinDate: '2026-07-15',
      isActive: true
    });
    // Bagi ke kelas: 4 di Iqro, 4 di Juz Amma, 4 di Tahfidz
    if (i < 4) {
      await db.classStudents.add({ classId: c1, studentId: sid });
    } else if (i < 8) {
      await db.classStudents.add({ classId: c2, studentId: sid });
    } else {
      await db.classStudents.add({ classId: c3, studentId: sid });
    }
  }

  // ─── 11. Jadwal mingguan ────────────────────────────────────────
  await db.schedules.bulkAdd([
    { classId: c1, teacherId: t2, day: 'Senin', startTime: '15:30', endTime: '17:00', room: 'Ruang 1', isActive: true },
    { classId: c2, teacherId: t1, day: 'Senin', startTime: '17:00', endTime: '18:30', room: 'Ruang 2', isActive: true },
    { classId: c3, teacherId: t1, day: 'Rabu', startTime: '15:30', endTime: '17:00', room: 'Ruang 3', isActive: true },
    { classId: c1, teacherId: t2, day: 'Sabtu', startTime: '09:00', endTime: '11:00', room: 'Ruang 1', isActive: true }
  ]);

  // ─── 12. Sample hafalan progress ────────────────────────────────
  const students = await db.students.toArray();
  const surahs = [1, 36, 55, 67, 78, 87, 93, 94, 95, 96, 97, 103, 105, 108, 109, 110, 112, 113, 114];
  const grades = ['mumtaz', 'jayyid jiddan', 'jayyid', 'maqbul'];
  for (const s of students.slice(0, 6)) {
    for (let j = 0; j < 3; j++) {
      const surah = surahs[Math.floor(Math.random() * surahs.length)];
      await db.hafalanProgress.add({
              locationId: lid,
              studentId: s.id,
        teacherId: s.gender === 'L' ? t1 : t2,
        surahNumber: surah,
        surahName: getSurahName(surah),
        ayatFrom: 1,
        ayatTo: 5 + Math.floor(Math.random() * 10),
        type: 'hafalan',
        grade: grades[Math.floor(Math.random() * grades.length)],
        notes: '',
        recordedAt: localDateTime(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
      });
    }
  }

  // ─── 13. Sample class sessions & attendance ─────────────────────
  const today = localDate();
  const session1 = await db.classSessions.add({ locationId: lid, classId: c1, teacherId: t2, sessionDate: today, startTime: '15:30' });
    const session2 = await db.classSessions.add({ locationId: lid, classId: c2, teacherId: t1, sessionDate: today, startTime: '17:00' });

  const cs1Students = await db.classStudents.where('classId').equals(c1).toArray();
  const statuses = ['hadir', 'izin', 'sakit', 'alpha'];
  for (const cs of cs1Students) {
    await db.attendances.add({
      sessionId: session1,
      studentId: cs.studentId,
      status: 'hadir'
    });
  }
  const cs2Students = await db.classStudents.where('classId').equals(c2).toArray();
  for (const cs of cs2Students) {
    await db.attendances.add({
      sessionId: session2,
      studentId: cs.studentId,
      status: Math.random() > 0.2 ? 'hadir' : statuses[Math.floor(Math.random() * statuses.length)]
    });
  }

  // ─── 14. Sample spp bills ───────────────────────────────────────
  for (const s of students) {
    for (let m = 7; m <= 9; m++) {
      await db.sppBills.add({
              locationId: lid,
              studentId: s.id,
        sppTypeId: 1,
        billMonth: `2026-${String(m).padStart(2, '0')}`,
        status: m < 9 ? 'paid' : 'pending',
        amount: 50000,
        paidAmount: m < 9 ? 50000 : 0,
        dueDate: `2026-${String(m).padStart(2, '0')}-10`
      });
    }
  }

  // ─── 15. Sample cash flows ──────────────────────────────────────
  await db.cashFlows.bulkAdd([
    { locationId: lid, type: 'masuk', category: 'SPP', amount: 200000, transactionDate: today, description: 'Pembayaran SPP' },
    { locationId: lid, type: 'masuk', category: 'Infaq', amount: 50000, transactionDate: today, description: 'Infaq minggu ini' },
    { locationId: lid, type: 'keluar', category: 'Gaji Guru', amount: 500000, transactionDate: today, description: 'Gaji ustadz bulan ini' }
  ]);

    // ─── 16. Data uji live (demo) ──────────────────────────────────
    // Santri tambahan dengan persetujuan wali (UU 27/2022)
    const siti = await db.students.add({
      locationId: lid, guardianId: g1, nis: 'TPA-2026-013', name: 'Siti Nurhaliza',
      gender: 'P', birthDate: '2015-03-12', address: 'Jl. Melati No. 5 Solo', phone: '081234567890',
      joinDate: today, isActive: true,
      consentAt: localDateTime(Date.now()), consentBy: 'Bapak Ahmad', consentGuardianId: g1
    });
    await db.classStudents.add({ classId: c1, studentId: siti });

    // Ustadz tambahan (kompetensi tartil)
    const t3 = await db.teachers.add({ locationId: lid, name: 'Ustadz Baru', gender: 'L', phone: '081298765432', specialization: 'Tahfidz', qualification: 'diniyah_atas', tartil: 'lancar', isActive: true });

    // Hafalan setoran hari ini (Muhammad Rizki)
    const rizki = students[0];
    await db.hafalanProgress.add({
      locationId: lid, studentId: rizki.id, teacherId: t1,
      surahNumber: 112, surahName: 'Al-Ikhlas', ayatFrom: 1, ayatTo: 3,
      type: 'ziyadah', grade: 'mumtaz', notes: 'Setoran baru',
      recordedAt: localDateTime(Date.now())
    });

    // Bayar SPP Muhammad Rizki 2026-09
    const rizkiBill = await db.sppBills.where('studentId').equals(rizki.id).and(b => b.billMonth === '2026-09').first();
    if (rizkiBill) {
      await db.payments.add({ billId: rizkiBill.id, studentId: rizki.id, amount: 50000, method: 'tunai', paidAt: localDateTime(Date.now()) });
      await db.sppBills.update(rizkiBill.id, { paidAmount: 50000, status: 'paid' });
    }

    // Kas masuk donasi
    await db.cashFlows.add({ locationId: lid, type: 'masuk', category: 'Donasi', amount: 100000, transactionDate: today, description: 'Donasi pembangunan' });

    // Proyek
    await db.projects.add({ locationId: lid, title: 'Renovasi Masjid', description: 'Perbaikan atap dan cat', status: 'in_progress', priority: 'high', dueDate: '2026-12-31' });

    // Lokasi kedua
    await db.locations.add({ name: 'TPA An-Nur', address: 'Jl. Melati No. 2 Solo', phone: '081234567891', headName: 'Ustadz Hasan', isActive: true });

    // Laporan perlindungan anak
    await db.protectionReports.add({
      locationId: lid, studentId: rizki.id, studentName: 'Muhammad Rizki',
      type: 'perundungan', description: 'Diejek teman saat jam istirahat',
      status: 'reported', handlingNote: 'Dilaporkan ke wali kelas',
      reporterRole: 'admin', reporterName: 'Admin TPA',
      createdAt: localDateTime(Date.now()), updatedAt: localDateTime(Date.now())
    });

    // Progres Iqro (Muhammad Rizki)
    await db.iqroProgress.add({ locationId: lid, studentId: rizki.id, teacherId: t1, jilid: 2, page: 5, grade: 'lancar', notes: 'Lancar jilid 2', recordedAt: localDateTime(Date.now()) });

    console.log('[seed] Demo data seeded successfully.');
}

function getSurahName(n) {
  const names = {
    1: 'Al-Fatihah', 36: 'Yasin', 55: 'Ar-Rahman', 67: 'Al-Mulk',
    78: 'An-Naba', 87: 'Al-Ala', 93: 'Ad-Dhuha', 94: 'Al-Insyirah',
    95: 'At-Tin', 96: 'Al-Alaq', 97: 'Al-Qadr', 103: 'Al-Asr',
    105: 'Al-Fil', 108: 'Al-Kausar', 109: 'Al-Kafirun', 110: 'An-Nasr',
    112: 'Al-Ikhlas', 113: 'Al-Falaq', 114: 'An-Nas'
  };
  return names[n] || `Surah ${n}`;
}

/**
 * Pastikan akun user selalu ada, meskipun DB berisi data lama
 * (dibuat sebelum tabel users ditambahkan ke seed).
 * Membuat akun dari teacher/guardian yang sudah ada di DB.
 */
async function ensureUsersSeeded() {
  if (await db.users.count() > 0) return;
  const locs = await db.locations.toArray();
  if (!locs.length) return;
  const lid = locs[0].id;
  const teachers = await db.teachers.where('locationId').equals(lid).toArray();
  const guardians = await db.guardians.where('locationId').equals(lid).toArray();
  const t1 = teachers.find(t => t.name === 'Ustadz Hasan') || teachers[0];
  const t2 = teachers.find(t => t.name === 'Ustadzah Maryam') || teachers.find(t => t !== t1) || teachers[0];
  const g1 = guardians.find(g => g.name === 'Bapak Ahmad') || guardians[0];
  await db.users.bulkAdd([
    { name: 'Admin TPA', role: 'admin', locationId: lid, isActive: true },
    { name: t1 ? t1.name : 'Ustadz Hasan', role: 'ustadz', locationId: lid, teacherId: t1 ? t1.id : undefined, isActive: true },
    { name: t2 ? t2.name : 'Ustadzah Maryam', role: 'ustadz', locationId: lid, teacherId: t2 ? t2.id : undefined, isActive: true },
    { name: g1 ? g1.name : 'Bapak Ahmad', role: 'wali', locationId: lid, guardianId: g1 ? g1.id : undefined, isActive: true }
  ]);
  console.log('[seed] User accounts seeded (migrasi DB lama).');
}

export function clearAllData() {
  return db.delete();
}
