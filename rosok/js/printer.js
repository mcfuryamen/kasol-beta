/* =========================================================================
   KASIR SOLO - ROSOK
   printer.js — Printer thermal Bluetooth (adopsi kaki5).
   Mekanisme kaki5: BLE chunking 20 byte + delay 30ms, retry 3x, guard
   race condition, persistensi koneksi via localStorage, auto-restore
   status saat boot. Modul ini menyediakan koneksi + tes cetak + cetak nota
   DUAL-PATH ala kaki5 printNota: printer thermal BLE bila terhubung,
   fallback print browser (popup → iframe) bila tidak. Lebar nota = kertas
   thermal ukuran 38 (38 kolom — permintaan pemilik 2026-09-13).
   ========================================================================= */
import { toast } from './utils.js';
import { SETTINGS } from './app-state.js';

// ── Persistensi koneksi (pola H1 kaki5) ───────────────────────────────────
const BT_STATE_KEY = 'printer_bluetooth_state';

function savePrinterState(deviceName) {
  try {
    localStorage.setItem(BT_STATE_KEY, JSON.stringify({ name: deviceName, connectedAt: Date.now() }));
  } catch (_) {}
}
function getPrinterState() {
  try {
    const raw = localStorage.getItem(BT_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}
function clearPrinterState() {
  try { localStorage.removeItem(BT_STATE_KEY); } catch (_) {}
}

// ── Konfigurasi (L1/L2 kaki5) ─────────────────────────────────────────────
const BLE_CHUNK_SIZE = 20;     // MTU aman printer thermal
const BLE_WRITE_DELAY_MS = 30;
const PRINT_WIDTH = 38;        // karakter, kertas thermal ukuran 38

// ── State koneksi ─────────────────────────────────────────────────────────
let btDevice = null;
let btCharacteristic = null;
let _printingInFlight = false; // H2: guard race condition

function setStatus(txt) {
  const el = document.getElementById('btPrinterStatus');
  if(el) el.textContent = txt;
}

// ── Connect (filter layanan printer thermal umum, ala kaki5) ──────────────
export async function connectBTPrinter() {
  try {
    if (!navigator.bluetooth) {
      toast('Browser ini tidak mendukung Bluetooth. Gunakan Chrome di Android.');
      return;
    }
    toast('Mencari printer Bluetooth...');
    btDevice = await navigator.bluetooth.requestDevice({
      filters: [
        { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
        { namePrefix: 'RPP' }, { namePrefix: 'MPT' },
        { namePrefix: 'BlueTooth' }, { namePrefix: 'Printer' },
        { namePrefix: 'PT-' }, { namePrefix: 'TP-' },
        { namePrefix: 'MTP' }, { namePrefix: 'SPP' }
      ],
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455',
        '0000ff00-0000-1000-8000-00805f9b34fb',
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
      ]
    });
    toast('Menghubungkan ke ' + (btDevice.name || 'printer') + '...');
    const server = await btDevice.gatt.connect();

    const serviceUUIDs = [
      '000018f0-0000-1000-8000-00805f9b34fb',
      '49535343-fe7d-4ae5-8fa9-9fafd205e455',
      '0000ff00-0000-1000-8000-00805f9b34fb',
      'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
    ];
    for (const svcUUID of serviceUUIDs) {
      try {
        const service = await server.getPrimaryService(svcUUID);
        const chars = await service.getCharacteristics();
        for (const c of chars) {
          if (c.properties.write || c.properties.writeWithoutResponse) { btCharacteristic = c; break; }
        }
        if (btCharacteristic) break;
      } catch (e) { /* coba UUID berikutnya */ }
    }
    if (!btCharacteristic) throw new Error('Tidak ditemukan karakteristik tulis pada printer');

    savePrinterState(btDevice.name);
    setStatus('✅ Terhubung: ' + (btDevice.name || 'printer'));
    toast('✅ Printer terhubung: ' + (btDevice.name || 'printer'));

    btDevice.addEventListener('gattserverdisconnected', () => {
      btCharacteristic = null;
      clearPrinterState();
      setStatus('Terputus');
      toast('Printer terputus');
    });
  } catch (err) {
    if (err.name === 'NotFoundError') {
      toast('Printer tidak ditemukan');
    } else {
      console.error('BT Error:', err);
      toast('Gagal menghubungkan printer');
    }
    // JANGAN hapus state persisten di sini: printer bisa jadi masih terhubung
    // dari sesi/percobaan sebelumnya. clearPrinterState() hanya dilakukan saat
    // koneksi BARU benar-benar berhasil (lihat blok sukses — savePrinterState
    // menggantikan state lama) atau saat putus sungguhan (gattserverdisconnected).
  }
}

// ── Disconnect ────────────────────────────────────────────────────────────
export function disconnectBTPrinter() {
  if (btDevice && btDevice.gatt.connected) {
    btDevice.gatt.disconnect();
    btCharacteristic = null;
    btDevice = null;
    clearPrinterState();
    setStatus('Belum terhubung');
    toast('Printer diputus');
  } else {
    toast('Tidak ada printer terhubung');
  }
}

// ── Send (M3 retry 3x + L1 chunking, kaki5) ───────────────────────────────
async function sendToPrinter(data) {
  if (!btCharacteristic || _printingInFlight) {
    toast('Printer belum terhubung!');
    return false;
  }
  let attempts = 0;
  while (attempts < 3) {
    attempts++;
    try {
      _printingInFlight = true;
      const bytes = new TextEncoder().encode(data);
      for (let i = 0; i < bytes.length; i += BLE_CHUNK_SIZE) {
        if (!btCharacteristic) break;
        const chunk = bytes.slice(i, i + BLE_CHUNK_SIZE);
        if (btCharacteristic.properties.writeWithoutResponse) {
          await btCharacteristic.writeValueWithoutResponse(chunk);
        } else {
          await btCharacteristic.writeValue(chunk);
        }
        await new Promise(r => setTimeout(r, BLE_WRITE_DELAY_MS));
      }
      const feed = new Uint8Array([10, 10, 10, 10]); // feed kertas
      try {
        if (btCharacteristic.properties.writeWithoutResponse) {
          await btCharacteristic.writeValueWithoutResponse(feed);
        } else {
          await btCharacteristic.writeValue(feed);
        }
      } catch (_) { /* abaikan feed error */ }
      return true;
    } catch (err) {
      if (attempts >= 3) {
        console.error('Gagal cetak', err);
        toast('Gagal cetak');
        return false;
      }
      await new Promise(r => setTimeout(r, 200));
    } finally {
      _printingInFlight = false;
    }
  }
  return false;
}

// ── Cetak Tes (teks 38 kolom ala nota thermal) ────────────────────────────
export async function testPrint() {
  if (!btCharacteristic) {
    toast('Hubungkan printer dulu!');
    return;
  }
  const w = PRINT_WIDTH;
  const center = (s) => s.length >= w ? s : ' '.repeat(Math.floor((w - s.length) / 2)) + s;
  const line = '='.repeat(w);
  const biz = (SETTINGS && SETTINGS.bizName) || 'Kasir Rosok';
  const txt = [
    center(biz),
    center('=== TES CETAK ==='),
    line,
    'Tanggal : ' + new Date().toLocaleString('id-ID'),
    'Perangkat: ' + (btDevice && btDevice.name ? btDevice.name : '-'),
    line,
    center('Printer berfungsi!'),
    center('Terima kasih 🙏'),
    ''
  ].join('\n');
  const ok = await sendToPrinter(txt);
  if (ok) toast('✅ Tes cetak berhasil!');
}

// ── Cetak Nota dual-path (port kaki5 printNota, 2026-09-13) ───────────────
// Nota aktif di-set oleh renderNota (pos.js) — satu titik untuk jalur
// pasca-jual & jalur detail Riwayat.
let _currentNota = null;
export function setPrintNotaData(data) { _currentNota = data; }

const RP = (n) => Math.round(Number(n) || 0).toLocaleString('id-ID');
const KG = (v) => (Number(v) || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 });
const padLine = (l, r) => { const sp = PRINT_WIDTH - l.length - r.length; return l + ' '.repeat(Math.max(1, sp)) + r; };

// Rakit teks struk ESC/POS 38 kolom. Model data rosok: transaksi
// { tipe, tanggal, kontakNama, total, dibayarkan, sisa, metodeBayar, catatan?,
//   items: [{ nama|kategoriNama, berat, harga|hargaSatuan, subtotal }] }.
export function buildReceiptText(trx, bizName, alamat = '') {
  const ESC = String.fromCharCode(27);
  const GS = String.fromCharCode(29);
  const LF = String.fromCharCode(10);
  if (!trx || typeof trx !== 'object') return '[DATA TRANSAKSI TIDAK VALID]';
  const items = Array.isArray(trx.items) ? trx.items : [];
  const d = new Date(trx.tanggal);
  const t = isNaN(d.getTime()) ? new Date() : d;
  const p2 = (n) => String(n).padStart(2, '0');
  let txt = ESC + '@'; // reset printer
  // Header (center): nama usaha + alamat lengkap di bawahnya (printer
  // membungkus otomatis bila alamat lebih panjang dari lebar kertas).
  txt += ESC + 'a' + String.fromCharCode(1);
  txt += String(bizName || 'Kasir Solo - Rosok').substring(0, PRINT_WIDTH) + LF;
  const alamatTxt = String(alamat || '').trim();
  if (alamatTxt) {
    // Bungkus alamat sendiri per kata (center) — auto-wrap printer menumpuk
    // baris lanjutan di rata kiri dan merusak perataan tengah.
    let line = '';
    const flush = () => { if (line) { txt += ' '.repeat(Math.max(0, Math.floor((PRINT_WIDTH - line.length) / 2))) + line + LF; line = ''; } };
    for (const w of alamatTxt.split(/\s+/)) {
      const cand = line ? line + ' ' + w : w;
      if (cand.length > PRINT_WIDTH && line) { flush(); line = w; } else line = cand;
    }
    flush();
  }
  txt += '='.repeat(PRINT_WIDTH) + LF;
  // Isi (left)
  txt += ESC + 'a' + String.fromCharCode(0);
  txt += 'Tgl: ' + p2(t.getDate()) + '/' + p2(t.getMonth() + 1) + '/' + t.getFullYear() + ' ' + p2(t.getHours()) + ':' + p2(t.getMinutes()) + LF;
  const kontak = String(trx.kontakNama || trx.namaKontak || '').trim();
  const jenis = trx.tipe === 'beli' ? 'Pembelian' : 'Penjualan';
  txt += jenis + (kontak ? ' - ' + kontak.substring(0, PRINT_WIDTH - jenis.length - 3) : '') + LF;
  const cat = String(trx.catatan || '').trim();
  if (cat) txt += 'Catatan: ' + cat.substring(0, PRINT_WIDTH - 9) + LF;
  txt += '-'.repeat(PRINT_WIDTH) + LF;
  items.forEach((it) => {
    if (!it || typeof it !== 'object') return;
    const nama = String(it.nama || it.kategoriNama || 'Item').substring(0, PRINT_WIDTH);
    const harga = Number(it.harga) || Number(it.hargaSatuan) || 0;
    const lineTotal = Number(it.subtotal) || harga * (Number(it.berat) || 0);
    txt += nama + LF;
    txt += padLine('  ' + KG(it.berat) + ' kg x ' + RP(harga), '= ' + RP(lineTotal)) + LF;
  });
  txt += '-'.repeat(PRINT_WIDTH) + LF;
  txt += padLine('TOTAL', RP(trx.total)) + LF;
  const PAY = { tunai: 'Tunai', transfer: 'Transfer', tempo: 'Tempo' };
  txt += padLine('Bayar via', PAY[trx.metodeBayar] || 'Tunai') + LF;
  const total = Number(trx.total) || 0;
  const dib = Number(trx.dibayarkan) || 0;
  const sisa = Number(trx.sisa) || 0;
  if (sisa > 0) {
    txt += padLine('Dibayar', RP(dib)) + LF;
    txt += padLine(trx.tipe === 'beli' ? 'Sisa (Utang)' : 'Sisa (Piutang)', RP(sisa)) + LF;
  } else if (dib > total) {
    txt += padLine('Bayar', RP(dib)) + LF;
    txt += padLine('Kembali', RP(dib - total)) + LF;
  }
  txt += '='.repeat(PRINT_WIDTH) + LF;
  // Footer (center) + cut (diabaikan printer tanpa cutter)
  txt += ESC + 'a' + String.fromCharCode(1);
  txt += 'Terima kasih! Semoga berkah' + LF;
  txt += 'Kasir Solo - Rosok Edition' + LF;
  txt += 'https://rosok.kasirsolo.com' + LF;
  txt += LF + LF + LF;
  txt += GS + 'V' + String.fromCharCode(66) + String.fromCharCode(3);
  return txt;
}

export async function printNota() {
  const trx = _currentNota;
  if (!trx || !Array.isArray(trx.items)) { toast('Belum ada nota untuk dicetak'); return; }
  const biz = (SETTINGS && SETTINGS.bizName) || 'Kasir Solo - Rosok';
  const alamat = [SETTINGS.alamatDetail, SETTINGS.bizDesa, SETTINGS.bizKecamatan,
    SETTINGS.bizKabkota, SETTINGS.bizProvinsi].filter(Boolean).join(', ');
  if (btCharacteristic) {
    const okPrint = await sendToPrinter(buildReceiptText(trx, biz, alamat));
    if (okPrint) toast('✅ Nota berhasil dicetak!');
  } else {
    // Fallback: print browser (popup → iframe), pola kaki5 printNotaBrowser.
    printNotaBrowser(trx, biz, alamat);
  }
}

// ── Fallback print browser (port kaki5, lebar nota 38 kolom ≈ 333px) ─────
function printNotaBrowser(trx, bizName, alamat = '') {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const d = new Date(trx.tanggal);
  const t = isNaN(d.getTime()) ? new Date() : d;
  const p2 = (n) => String(n).padStart(2, '0');
  const tgl = p2(t.getDate()) + '/' + p2(t.getMonth() + 1) + '/' + t.getFullYear() + ' ' + p2(t.getHours()) + ':' + p2(t.getMinutes());
  const kontak = String(trx.kontakNama || trx.namaKontak || '').trim();
  const jenis = trx.tipe === 'beli' ? 'Pembelian' : 'Penjualan';
  const itemsHtml = (trx.items || []).map((it) => {
    if (!it || typeof it !== 'object') return '';
    const nama = esc(it.nama || it.kategoriNama || 'Item');
    const harga = Number(it.harga) || Number(it.hargaSatuan) || 0;
    const lineTotal = Number(it.subtotal) || harga * (Number(it.berat) || 0);
    return '<tr><td>' + nama + '<div style="font-size:10px;color:#444">' + KG(it.berat) + ' kg × ' + RP(harga) + '</div></td>' +
      '<td class="kr">' + RP(lineTotal) + '</td></tr>';
  }).join('');
  const total = Number(trx.total) || 0;
  const dib = Number(trx.dibayarkan) || 0;
  const sisa = Number(trx.sisa) || 0;
  const PAY = { tunai: 'Tunai', transfer: 'Transfer', tempo: 'Tempo' };
  let bayarHtml = '<tr><td>Bayar via</td><td class="kr">' + esc(PAY[trx.metodeBayar] || 'Tunai') + '</td></tr>';
  if (sisa > 0) bayarHtml += '<tr><td>Dibayar</td><td class="kr">' + RP(dib) + '</td></tr>' +
    '<tr><td>Sisa (' + (trx.tipe === 'beli' ? 'Utang' : 'Piutang') + ')</td><td class="kr">' + RP(sisa) + '</td></tr>';
  else if (dib > total) bayarHtml += '<tr><td>Bayar</td><td class="kr">' + RP(dib) + '</td></tr>' +
    '<tr><td>Kembali</td><td class="kr">' + RP(dib - total) + '</td></tr>';
  const cat = String(trx.catatan || '').trim();
  const html = '<html><head><title>Nota</title><style>' +
    'body{font-family:monospace;font-size:12px;width:333px;margin:0 auto;padding:8px}' +
    'h2{text-align:center;margin:0;font-size:14px}p.sub{text-align:center;margin:2px 0;font-size:11px;color:#666}' +
    'hr{border:none;border-top:1px dashed #000;margin:6px 0}table{width:100%;border-collapse:collapse}' +
    'td{padding:2px 0;font-size:11px;vertical-align:top}.tot{font-weight:bold;font-size:13px}' +
    '.kr{text-align:right}.footer{text-align:center;margin-top:8px;font-size:11px}' +
    '@media print{body{width:100%}}</style></head><body>' +
    '<h2>' + esc(bizName) + '</h2>' +
    (String(alamat || '').trim() ? '<p class="sub">' + esc(alamat) + '</p>' : '') + '<hr>' +
    '<p class="sub">' + tgl + ' · ' + esc(jenis) + (kontak ? ' — ' + esc(kontak) : '') + '</p>' +
    (cat ? '<p class="sub">Catatan: ' + esc(cat) + '</p>' : '') +
    '<hr><table>' + itemsHtml + '</table><hr>' +
    '<table><tr class="tot"><td>TOTAL</td><td class="kr">' + RP(trx.total) + '</td></tr>' + bayarHtml + '</table><hr>' +
    '<p class="footer">Terima kasih! Semoga berkah<br><span style="font-size:10px;color:#666">Kasir Solo - Rosok Edition</span><br><span style="font-size:10px;color:#666">https://rosok.kasirsolo.com</span></p>' +
    '</body></html>';

  browserPrintHtml(html, 'cetak-nota');
}

// ── Cetak HTML lewat browser: popup → fallback iframe (dipakai nota & shift) ─
// window.open bisa null (popup diblokir / PWA standalone — pelajaran kaki5 v145)
// → jatuh ke iframe tersembunyi yang tak kena popup blocker.
function browserPrintHtml(html, title = 'cetak') {
  const win = window.open('', '_blank', 'width=380,height=640');
  if (win && win.document) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => { try { win.focus(); win.print(); } catch (e) { console.warn('print popup gagal:', e); toast('❌ Gagal mencetak — coba lagi'); } }, 300);
    return;
  }
  try {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('title', title);
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    iframe.srcdoc = html;
    let removed = false;
    const cleanup = () => {
      if (removed) return;
      removed = true;
      setTimeout(() => { try { iframe.remove(); } catch (_) {} }, 100);
    };
    iframe.onload = () => {
      try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) { toast('❌ Gagal mencetak'); }
      setTimeout(cleanup, 500);
    };
    window.addEventListener('afterprint', cleanup);
    document.body.appendChild(iframe);
  } catch (e) {
    console.warn('print iframe gagal:', e);
    toast('❌ Gagal mencetak');
  }
}

// ── Cetak Laporan Shift Kas (ringkasan + mutasi) — DUAL-PATH ala printNota ──
function kasLine(label, value) { // thermal 38 kolom: label kiri, angka rata kanan
  const l = String(label), r = String(value);
  const space = Math.max(1, 38 - l.length - r.length);
  return l + ' '.repeat(space) + r;
}
function buildKasReceiptText(ctx) {
  const W = 38, dash = '-'.repeat(W);
  const center = (s) => { const pad = Math.max(0, Math.floor((W - String(s).length) / 2)); return ' '.repeat(pad) + s; };
  let out = center(ctx.bizName || 'Kasir Solo - Rosok') + '\n';
  if (ctx.alamat) out += center(ctx.alamat) + '\n';
  out += dash + '\n' + center('LAPORAN SHIFT KAS') + '\n';
  out += ctx.tgl + (ctx.status ? '  ·  ' + ctx.status : '') + '\n' + dash + '\n';
  for (const s of ctx.summary) out += kasLine(s.label, s.value) + '\n';
  out += dash + '\nMUTASI KAS\n';
  if (!ctx.mutasi || !ctx.mutasi.length) out += '(tidak ada mutasi)\n';
  for (const m of ctx.mutasi) out += kasLine((m.tipe === 'masuk' ? '(+) ' : '(-) ') + m.keterangan, (m.tipe === 'masuk' ? '+' : '-') + RP(m.jumlah)) + '\n';
  out += dash + '\n' + center('Kasir Solo - Rosok') + '\n';
  return out;
}
function kasBrowserHtml(ctx) {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sumRows = ctx.summary.map(s => `<tr><td>${esc(s.label)}</td><td class="kr">${esc(s.value)}</td></tr>`).join('');
  const mutRows = (ctx.mutasi || []).map(m => `<tr><td>${m.tipe === 'masuk' ? '⬆️' : '⬇️'} ${esc(m.keterangan)}<div style="font-size:10px;color:#666">${esc(m.waktu || '')}</div></td><td class="kr" style="color:${m.tipe === 'masuk' ? '#178a3c' : '#c62828'}">${m.tipe === 'masuk' ? '+' : '-'}${RP(m.jumlah)}</td></tr>`).join('') || '<tr><td colspan="2" style="text-align:center;color:#666">(tidak ada mutasi)</td></tr>';
  return '<html><head><title>Laporan Shift Kas</title><style>' +
    'body{font-family:monospace;font-size:12px;width:333px;margin:0 auto;padding:8px}' +
    'h2{text-align:center;margin:0;font-size:14px}p.sub{text-align:center;margin:2px 0;font-size:11px;color:#666}' +
    'hr{border:none;border-top:1px dashed #000;margin:6px 0}table{width:100%;border-collapse:collapse}' +
    'td{padding:2px 0;font-size:11px;vertical-align:top}.kr{text-align:right}h3{font-size:12px;margin:6px 0 2px}' +
    '@media print{body{width:100%}}</style></head><body>' +
    '<h2>' + esc(ctx.bizName || 'Kasir Solo - Rosok') + '</h2>' +
    (ctx.alamat ? '<p class="sub">' + esc(ctx.alamat) + '</p>' : '') +
    '<hr><p class="sub"><b>LAPORAN SHIFT KAS</b><br>' + esc(ctx.tgl) + (ctx.status ? ' · ' + esc(ctx.status) : '') + '</p><hr>' +
    '<table>' + sumRows + '</table><hr><h3>Mutasi Kas</h3><table>' + mutRows + '</table><hr>' +
    '<p class="sub">Kasir Solo - Rosok · rosok.kasirsolo.com</p></body></html>';
}
export async function printKasShift(ctx) {
  if (!ctx || !Array.isArray(ctx.summary)) { toast('Tidak ada data shift untuk dicetak'); return; }
  if (btCharacteristic) {
    const ok = await sendToPrinter(buildKasReceiptText(ctx));
    if (ok) toast('✅ Laporan shift tercetak!');
  } else {
    browserPrintHtml(kasBrowserHtml(ctx), 'cetak-shift-kas');
  }
}

// ── Status saat boot (auto-restore ala kaki5) ─────────────────────────────
export function restorePrinterStatus(){
  const st = getPrinterState();
  if (st && st.name) {
    setStatus('Terakhir: ' + st.name + ' — hubungkan ulang bila perlu');
  }
}
