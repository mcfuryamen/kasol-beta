// ============================================================
// Print Utilities (Rapor, Sertifikat, Kwitansi, Kartu Santri)
// ============================================================

export interface PrintOptions {
  title?: string;
  paperSize?: 'A4' | 'A5' | 'letter' | 'receipt';
  orientation?: 'portrait' | 'landscape';
  margins?: string;
}

export function printHTML(html: string, options: PrintOptions = {}): void {
  const { title = 'Kasir Solo - TPA', paperSize = 'A4', orientation = 'portrait', margins = '10mm' } = options;

  const paperSizes: Record<string, string> = {
    A4: '210mm 297mm',
    A5: '148mm 210mm',
    letter: '216mm 279mm',
    receipt: '80mm auto',
  };

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    @page {
      size: ${paperSizes[paperSize]} ${orientation};
      margin: ${margins};
    }
    body {
      font-family: 'Segoe UI', Tahoma, sans-serif;
      font-size: 11pt;
      color: #1a1a1a;
      margin: 0;
      padding: 0;
    }
    .header { text-align: center; margin-bottom: 16px; }
    .header h1 { font-size: 16pt; margin: 0; color: #ea580c; }
    .header p { margin: 2px 0; font-size: 9pt; color: #666; }
    .divider { border-top: 2px solid #ea580c; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th, td { padding: 6px 8px; text-align: left; border: 1px solid #ddd; font-size: 10pt; }
    th { background: #fff7ed; font-weight: 600; color: #ea580c; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .signature { display: flex; justify-content: space-between; margin-top: 40px; }
    .signature div { text-align: center; min-width: 150px; }
    .signature .line { border-top: 1px solid #333; margin-top: 60px; padding-top: 4px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9pt; font-weight: 600; }
    .badge-green { background: #dcfce7; color: #16a34a; }
    .badge-red { background: #fef2f2; color: #dc2626; }
    .badge-blue { background: #dbeafe; color: #2563eb; }
    .footer { text-align: center; margin-top: 20px; font-size: 8pt; color: #999; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  ${html}
  <div class="footer">
    <p>Dicetak oleh Kasir Solo - TPA | PT Mesin Kasir Solo | kasirsolo.app</p>
  </div>
</body>
</html>`);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 500);
}

export function generateRaporHTML(data: {
  student: { name: string; nis: string; class: string };
  location: { name: string; address: string; head_name: string };
  academic_year: string;
  semester: string;
  attendance: { hadir: number; izin: number; sakit: number; alpha: number; total: number };
  hafalan: Array<{ surah: string; ayat: string; grade: string }>;
  iqro: { jilid: number; page: number; status: string };
  assessments: Array<{ category: string; score: number; grade: string }>;
  notes: string;
}): string {
  const { student, location, academic_year, semester, attendance, hafalan, iqro, assessments, notes } = data;

  return `
    <div class="header">
      <h1>📖 ${location.name}</h1>
      <p>${location.address}</p>
      <div class="divider"></div>
      <h2 style="font-size:14pt; margin:8px 0;">RAPOR SANTRI</h2>
      <p>Tahun Ajaran ${academic_year} - Semester ${semester}</p>
    </div>

    <table style="border:none; margin-bottom:16px;">
      <tr style="border:none;"><td style="border:none; width:120px;">Nama</td><td style="border:none;"><strong>${student.name}</strong></td></tr>
      <tr style="border:none;"><td style="border:none;">NIS</td><td style="border:none;">${student.nis}</td></tr>
      <tr style="border:none;"><td style="border:none;">Kelas</td><td style="border:none;">${student.class}</td></tr>
    </table>

    <h3 style="color:#ea580c;">A. Kehadiran</h3>
    <table>
      <tr><th>Hadir</th><th>Izin</th><th>Sakit</th><th>Alpha</th><th>Total</th><th>Persentase</th></tr>
      <tr class="text-center">
        <td>${attendance.hadir}</td><td>${attendance.izin}</td><td>${attendance.sakit}</td>
        <td>${attendance.alpha}</td><td>${attendance.total}</td>
        <td>${((attendance.hadir / attendance.total) * 100).toFixed(1)}%</td>
      </tr>
    </table>

    <h3 style="color:#ea580c;">B. Progres Hafalan</h3>
    <table>
      <tr><th>No</th><th>Surat</th><th>Ayat</th><th>Nilai</th></tr>
      ${hafalan.map((h, i) => `<tr><td class="text-center">${i + 1}</td><td>${h.surah}</td><td>${h.ayat}</td><td class="text-center">${h.grade}</td></tr>`).join('')}
    </table>

    <h3 style="color:#ea580c;">C. Progres Iqro</h3>
    <table>
      <tr><th>Jilid</th><th>Halaman</th><th>Status</th></tr>
      <tr class="text-center"><td>${iqro.jilid}</td><td>${iqro.page}</td><td>${iqro.status}</td></tr>
    </table>

    <h3 style="color:#ea580c;">D. Penilaian</h3>
    <table>
      <tr><th>Mata Pelajaran</th><th>Nilai</th><th>Grade</th></tr>
      ${assessments.map(a => `<tr><td>${a.category}</td><td class="text-center">${a.score}</td><td class="text-center">${a.grade}</td></tr>`).join('')}
    </table>

    <h3 style="color:#ea580c;">E. Catatan</h3>
    <p style="border:1px solid #ddd; padding:8px; min-height:40px;">${notes || '-'}</p>

    <div class="signature">
      <div><p>Wali Santri</p><div class="line">(.......................)</div></div>
      <div><p>Wali Kelas</p><div class="line">(.......................)</div></div>
      <div><p>Kepala TPA</p><div class="line">(${location.head_name})</div></div>
    </div>
  `;
}

export function generateKwitansiHTML(data: {
  receipt_number: string;
  student_name: string;
  guardian_name: string;
  items: Array<{ name: string; amount: number }>;
  total: number;
  method: string;
  location: { name: string; address: string };
  date: string;
  cashier: string;
}): string {
  return `
    <div class="header">
      <h1>📖 ${data.location.name}</h1>
      <p>${data.location.address}</p>
      <div class="divider"></div>
      <h2 style="font-size:13pt;">KWITANSI PEMBAYARAN</h2>
      <p>No: ${data.receipt_number} | Tanggal: ${data.date}</p>
    </div>
    <table style="border:none; margin-bottom:12px;">
      <tr style="border:none;"><td style="border:none; width:120px;">Santri</td><td style="border:none;"><strong>${data.student_name}</strong></td></tr>
      <tr style="border:none;"><td style="border:none;">Wali</td><td style="border:none;">${data.guardian_name}</td></tr>
    </table>
    <table>
      <tr><th>No</th><th>Keterangan</th><th class="text-right">Jumlah</th></tr>
      ${data.items.map((item, i) => `<tr><td class="text-center">${i + 1}</td><td>${item.name}</td><td class="text-right">Rp ${item.amount.toLocaleString('id-ID')}</td></tr>`).join('')}
      <tr><th colspan="2" class="text-right">TOTAL</th><th class="text-right">Rp ${data.total.toLocaleString('id-ID')}</th></tr>
    </table>
    <p>Metode: <strong>${data.method}</strong></p>
    <div class="signature">
      <div><p>Penerima</p><div class="line">(${data.cashier})</div></div>
      <div><p>Pembayar</p><div class="line">(.......................)</div></div>
    </div>
  `;
}

export function generateKartuSantriHTML(data: {
  student: { name: string; nis: string; gender: string; birth_date: string; address: string; photo_url?: string };
  guardian: { name: string; phone: string };
  location: { name: string; address: string };
  class_name: string;
}): string {
  return `
    <div style="width:85.6mm; height:53.98mm; border:2px solid #ea580c; border-radius:8px; padding:8px; position:relative; font-size:8pt;">
      <div style="background:#ea580c; color:white; padding:4px 8px; border-radius:4px; text-align:center; margin-bottom:6px;">
        <strong style="font-size:10pt;">📖 ${data.location.name}</strong><br/>
        <span style="font-size:7pt;">${data.location.address}</span>
      </div>
      <div style="display:flex; gap:8px;">
        <div style="width:60px; height:70px; border:1px solid #ddd; border-radius:4px; display:flex; align-items:center; justify-content:center; background:#f5f5f5;">
          ${data.student.photo_url ? `<img src="${data.student.photo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;"/>` : '<span style="font-size:20pt;">👤</span>'}
        </div>
        <div>
          <table style="border:none; font-size:8pt;">
            <tr style="border:none;"><td style="border:none; padding:1px 4px; color:#666;">Nama</td><td style="border:none; padding:1px 4px;"><strong>${data.student.name}</strong></td></tr>
            <tr style="border:none;"><td style="border:none; padding:1px 4px; color:#666;">NIS</td><td style="border:none; padding:1px 4px;">${data.student.nis}</td></tr>
            <tr style="border:none;"><td style="border:none; padding:1px 4px; color:#666;">Kelas</td><td style="border:none; padding:1px 4px;">${data.class_name}</td></tr>
            <tr style="border:none;"><td style="border:none; padding:1px 4px; color:#666;">Wali</td><td style="border:none; padding:1px 4px;">${data.guardian.name}</td></tr>
            <tr style="border:none;"><td style="border:none; padding:1px 4px; color:#666;">Telp</td><td style="border:none; padding:1px 4px;">${data.guardian.phone}</td></tr>
          </table>
        </div>
      </div>
    </div>
  `;
}

export function generateSertifikatHTML(data: {
  title: string;
  certificate_number: string;
  student_name: string;
  description: string;
  location: { name: string; head_name: string };
  issued_date: string;
}): string {
  return `
    <div style="border:3px double #ea580c; padding:40px; text-align:center; min-height:400px;">
      <p style="font-size:12pt; color:#ea580c; letter-spacing:4px;">SERTIFIKAT</p>
      <h1 style="font-size:20pt; color:#ea580c; margin:16px 0;">${data.title}</h1>
      <p style="font-size:9pt; color:#666;">No: ${data.certificate_number}</p>
      <div class="divider" style="max-width:200px; margin:16px auto;"></div>
      <p style="font-size:11pt;">Diberikan kepada:</p>
      <h2 style="font-size:24pt; margin:16px 0; color:#1a1a1a;">${data.student_name}</h2>
      <p style="font-size:11pt; max-width:400px; margin:0 auto;">${data.description}</p>
      <div style="margin-top:60px;">
        <p>${data.issued_date}</p>
        <p>Kepala ${data.location.name}</p>
        <div style="margin-top:50px; border-top:1px solid #333; display:inline-block; padding-top:4px; min-width:200px;">
          <strong>${data.location.head_name}</strong>
        </div>
      </div>
    </div>
  `;
}
