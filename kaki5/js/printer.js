// ==================== BLUETOOTH PRINTER (ESM) ====================
// H1 (2026-08-19): Persistensi koneksi printer via localStorage
// H2 (2026-08-19): Guard race condition dengan _printingInFlight
// M1 (2026-08-19): testPrint() refactored to use buildReceiptText()
// M2 (2026-08-19): Validasi defensif di buildReceiptText()
// M3 (2026-08-19): Retry mechanism di sendToPrinter()
// L1 (2026-08-19): Parameterisasi chunk size & delay
// L2 (2026-08-19): Konfigurasi lebar print

import { DB, getSetting } from './db.js';
import { escapeHtml, formatRp, showToast } from './helpers.js';
import { selectedTrxId, lastSaleId } from './app-state.js';
import { normalizeToppingQtys } from './pos.logic.js';

// ── StatePrinter (H1: persistensi koneksi) ─────────────────────────────────
const BT_STATE_KEY = 'printer_bluetooth_state';

function savePrinterState(deviceName) {
  try {
    localStorage.setItem(BT_STATE_KEY, JSON.stringify({
      name: deviceName,
      connectedAt: Date.now()
    }));
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

// ── Konfigurasi (L1, L2) ───────────────────────────────────────────────────
const BLE_CHUNK_SIZE = 20;     // aman untuk大多数 thermal printers (MTU ~20-23)
const BLE_WRITE_DELAY_MS = 30; // delay antar chunk
const PRINT_WIDTH = 32;        // lebar karakter untuk printer 58mm

// ── State koneksi ──────────────────────────────────────────────────────────
let btDevice = null;
let btCharacteristic = null;
let _printingInFlight = false; // H2: guard race condition

// ── Helper: validasi & sanitasi ────────────────────────────────────────────
function safeStr(val, fallback) {
  return (val !== null && val !== undefined && val !== '') ? String(val) : fallback;
}

function safeNum(val, fallback) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

// ── Connect ────────────────────────────────────────────────────────────────
export async function connectBTPrinter() {
  try {
    if (!navigator.bluetooth) {
      showToast('Browser ini tidak mendukung Bluetooth. Gunakan Chrome di Android.', 'error');
      return;
    }

    showToast('Mencari printer Bluetooth...');

    btDevice = await navigator.bluetooth.requestDevice({
      // H1-info: filters bersifat OR — device dipilih jika memenuhi SATU kondisi
      filters: [
        { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
        { namePrefix: 'RPP' },
        { namePrefix: 'MPT' },
        // 'BlueTooth' dan 'Printer' terlalu luas, pertahankan sebagai fallback
        { namePrefix: 'BlueTooth' },
        { namePrefix: 'Printer' },
        { namePrefix: 'PT-' },
        { namePrefix: 'TP-' },
        { namePrefix: 'MTP' },
        { namePrefix: 'SPP' }
      ],
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455',
        '0000ff00-0000-1000-8000-00805f9b34fb',
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
      ]
    });

    showToast('Menghubungkan ke ' + btDevice.name + '...');

    const server = await btDevice.gatt.connect();

    // Try common thermal printer service UUIDs
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
          if (c.properties.write || c.properties.writeWithoutResponse) {
            btCharacteristic = c;
            break;
          }
        }
        if (btCharacteristic) break;
      } catch (e) { /* try next */ }
    }

    if (!btCharacteristic) {
      throw new Error('Tidak ditemukan karakteristik tulis pada printer');
    }

    // H1: simpan state setelah berhasil connect
    savePrinterState(btDevice.name);

    document.getElementById('btPrinterStatus').textContent = '✅ Terhubung: ' + btDevice.name;
    showToast('✅ Printer terhubung: ' + btDevice.name);

    btDevice.addEventListener('gattserverdisconnected', () => {
      btCharacteristic = null;
      // H1: bersihkan state saat disconnect
      clearPrinterState();
      document.getElementById('btPrinterStatus').textContent = 'Terputus';
      showToast('Printer terputus', 'error');
    });

  } catch (err) {
    if (err.name === 'NotFoundError') {
      showToast('Printer tidak ditemukan', 'error');
    } else {
      console.error('Gagal', err); showToast('Gagal', 'error');
    }
    clearPrinterState();
    console.error('BT Error:', err);
  }
}

// ── Disconnect ─────────────────────────────────────────────────────────────
export function disconnectBTPrinter() {
  if (btDevice && btDevice.gatt.connected) {
    btDevice.gatt.disconnect();
    btCharacteristic = null;
    btDevice = null;
    clearPrinterState(); // H1: bersihkan state
    document.getElementById('btPrinterStatus').textContent = 'Belum terhubung';
    showToast('Printer diputus');
  } else {
    showToast('Tidak ada printer terhubung', 'error');
  }
}

// ── Send to Printer (M3: retry, L1: parameter) ────────────────────────────
async function sendToPrinter(data) {
  // H2: cek flag race condition
  if (!btCharacteristic || _printingInFlight) {
    showToast('Printer belum terhubung!', 'error');
    return false;
  }

  let attempts = 0;
  const MAX_ATTEMPTS = 3;

  while (attempts < MAX_ATTEMPTS) {
    attempts++;
    try {
      _printingInFlight = true; // H2: set flag

      const encoder = new TextEncoder();
      const bytes = encoder.encode(data);
      // L1: gunakan konstanta BLE_CHUNK_SIZE
      const chunkSize = BLE_CHUNK_SIZE;

      for (let i = 0; i < bytes.length; i += chunkSize) {
        // H2: cek lagi saat looping (mungkin disconnect tengah jalan)
        if (!btCharacteristic) break;
        const chunk = bytes.slice(i, i + chunkSize);
        if (btCharacteristic.properties.writeWithoutResponse) {
          await btCharacteristic.writeValueWithoutResponse(chunk);
        } else {
          await btCharacteristic.writeValue(chunk);
        }
        // L1: gunakan konstanta BLE_WRITE_DELAY_MS
        await new Promise(r => setTimeout(r, BLE_WRITE_DELAY_MS));
      }

      // Feed paper
      if (btCharacteristic) {
        const feed = new Uint8Array([10, 10, 10, 10]);
        try {
          if (btCharacteristic.properties.writeWithoutResponse) {
            await btCharacteristic.writeValueWithoutResponse(feed);
          } else {
            await btCharacteristic.writeValue(feed);
          }
        } catch (_) { /* abaikan feed error */ }
      }

      return true;
    } catch (err) {
      if (attempts >= MAX_ATTEMPTS) {
        console.error('Gagal cetak', err); showToast('Gagal cetak', 'error');
        return false;
      }
      // Retry: tunggu sebentar sebelum coba lagi
      await new Promise(r => setTimeout(r, 200));
    } finally {
      _printingInFlight = false; // H2: reset flag
    }
  }
  return false;
}

// ── Build Receipt (M2: validasi defensif, L2: configurable width) ──────────
export function buildReceiptText(sale, warungName, alamat = '') {
  const ESC = String.fromCharCode(27);
  const GS = String.fromCharCode(29);
  const LF = String.fromCharCode(10);

  // M2: validasi defensif
  if (!sale || typeof sale !== 'object') {
    console.error('[PRINTER] Invalid sale object');
    return '[DATA TRANSAKSI TIDAK VALID]';
  }

  const items = Array.isArray(sale.items) ? sale.items : [];
  const safeName = safeStr(warungName, 'Warung Saya').substring(0, 20);

  // Validasi waktu
  const d = new Date(sale.waktu);
  if (isNaN(d.getTime())) {
    console.warn('[PRINTER] Invalid sale.waktu, using current time');
    d.setTime(Date.now());
  }

  // Initialize printer
  let txt = ESC + '@'; // Reset

  // Center align
  txt += ESC + 'a' + String.fromCharCode(1);
  txt += safeName + LF;
  // Alamat usaha di header (jika diisi di Pengaturan)
  const alamatTxt = String(alamat || '').trim();
  if (alamatTxt) txt += alamatTxt + LF;
  txt += '================================' + LF;

  // Left align
  txt += ESC + 'a' + String.fromCharCode(0);

  const dateStr = String(d.getDate()).padStart(2, '0') + '/' +
                  String(d.getMonth() + 1).padStart(2, '0') + '/' +
                  d.getFullYear();
  const timeStr = String(d.getHours()).padStart(2, '0') + ':' +
                  String(d.getMinutes()).padStart(2, '0');
  txt += 'Tgl: ' + dateStr + '  ' + timeStr + LF;
  if (sale.nomor) txt += 'No: ' + safeStr(sale.nomor) + LF;
  // Tipe pesanan selalu tercetak (kiri), catatan pesanan di kanan
  const ORDER_TYPE_LABELS = { 'dine-in': 'Dine-in', 'takeaway': 'Take-away', 'ojol': 'Ojol' };
  const typeLabel = ORDER_TYPE_LABELS[sale.orderType] || 'Dine-in';
  const noteTxt = String(sale.orderNote || '').trim();
  const notePart = noteTxt ? 'Note: ' + noteTxt : '';
  const maxNoteLen = PRINT_WIDTH - typeLabel.length - 1;
  const notePartFit = notePart.length > maxNoteLen ? notePart.substring(0, Math.max(0, maxNoteLen)) : notePart;
  txt += (notePartFit ? padLine(typeLabel, notePartFit, PRINT_WIDTH) : typeLabel) + LF;
  txt += '--------------------------------' + LF;

  // Items
  items.forEach(item => {
    if (!item || typeof item !== 'object') return;
    const name = safeStr(item.nama, 'Item').substring(0, 16);
    const qty = safeNum(item.qty, 1);
    const hargaJual = safeNum(item.hargaJual, 0);
    const hargaOjol = safeNum(item.hargaOjol, 0);
    const isOjol = hargaOjol > 0;
    const effectiveHarga = isOjol ? hargaOjol : hargaJual;
    // Cetak nama + tandai ojol kalau hargaOjol diisi
    const label = isOjol ? name + ' [O]' : name;
    txt += label + LF;
    const baseLine = '  ' + qty + ' x ' + formatRpPlain(effectiveHarga);
    // Hitung total baris termasuk topping (qty per-topping via normalizeToppingQtys;
    // fallback: data lama tanpa field -> qty=1; legacy toppingQty Number -> qty itu)
    let lineTotal = effectiveHarga * qty;
    const qtys = normalizeToppingQtys(item);
    if (Array.isArray(item.selectedToppings)) {
      item.selectedToppings.forEach(t => {
        const th = safeNum(t.harga, 0);
        if (th > 0) {
          const tName = safeStr(t.nama, 'Topping').substring(0, 14);
          const tq = Math.max(1, parseInt(qtys[t.nama], 10) || 1);
          txt += '    + ' + tName + ' x' + tq + ' ' + formatRpPlain(th) + LF;
          lineTotal += th * tq;
        }
      });
    }
    txt += baseLine + '  = ' + formatRpPlain(lineTotal) + LF;
    // Catatan per menu terpilih (komentar browser #8) — dicetak di bawah item
    const itemNote = safeStr(item.catatanItem, '').trim();
    if (itemNote) txt += '  * ' + itemNote.substring(0, PRINT_WIDTH - 4) + LF;
  });

  // Totals
  const totalHarga = safeNum(sale.totalHarga, 0);
  const bayar = safeNum(sale.bayar, 0);
  const kembalian = safeNum(sale.kembalian, 0);
  // L2: gunakan konstanta PRINT_WIDTH
  txt += '--------------------------------' + LF;
  txt += padLine('TOTAL', formatRpPlain(totalHarga), PRINT_WIDTH) + LF;
  // Metode pembayaran (fitur 2026-08-31, komentar browser #5). Transaksi lama
  // tanpa field ini tetap terbaca benar sebagai Tunai.
  const PAY_SHORT = { tunai: 'Tunai', qris: 'QRIS', transfer: 'Transfer' };
  txt += padLine('Bayar via', PAY_SHORT[sale.metodeBayar] || 'Tunai', PRINT_WIDTH) + LF;
  const refBayar = safeStr(sale.refBayar, '').trim();
  if (refBayar) txt += padLine('Ref', refBayar.substring(0, 14), PRINT_WIDTH) + LF;
  // Catatan pembayaran non-tunai (thermal tidak bisa cetak foto — teks saja)
  const catBayar = safeStr(sale.catatanBayar, '').trim();
  if (catBayar) txt += 'Catatan: ' + catBayar.substring(0, 30) + LF;
  txt += padLine('Bayar', formatRpPlain(bayar), PRINT_WIDTH) + LF;
  txt += padLine('Kembali', formatRpPlain(kembalian), PRINT_WIDTH) + LF;
  txt += '================================' + LF;

  // Center
  txt += ESC + 'a' + String.fromCharCode(1);
  txt += 'Terima kasih! Semoga berkah' + LF;
  txt += 'Kasir Solo - Kaki Lima' + LF;
  txt += LF + LF + LF;

  // Cut (if supported)
  txt += GS + 'V' + String.fromCharCode(66) + String.fromCharCode(3);

  return txt;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatRpPlain(n) {
  if (!n && n !== 0) return '0';
  return Math.round(n).toLocaleString('id-ID');
}

function padLine(left, right, width) {
  width = width || PRINT_WIDTH;
  const spaces = width - left.length - right.length;
  return left + ' '.repeat(Math.max(1, spaces)) + right;
}

// ── Print Nota ─────────────────────────────────────────────────────────────
export async function printNota() {
  const id = selectedTrxId;
  if (!id) return;
  const sale = await DB.penjualan.get(id);
  if (!sale) { showToast('Transaksi tidak ditemukan', 'error'); return; }

  let warungName = await getSetting('namaUsaha', '');
  if (!warungName) warungName = await getSetting('namaWarung', 'Warung Saya');
  const alamatUsaha = await getSetting('alamat', '');

  if (btCharacteristic) {
    const receipt = buildReceiptText(sale, warungName, alamatUsaha);
    const ok = await sendToPrinter(receipt);
    if (ok) showToast('✅ Nota berhasil dicetak!');
  } else {
    // Fallback: browser print
    printNotaBrowser(sale, warungName, alamatUsaha);
  }
}

export async function printLastNota() {
  const id = lastSaleId;
  if (!id) { showToast('Tidak ada transaksi terakhir', 'error'); return; }
  const sale = await DB.penjualan.get(id);
  if (!sale) { showToast('Transaksi tidak ditemukan', 'error'); return; }

  let warungName = await getSetting('namaUsaha', '');
  if (!warungName) warungName = await getSetting('namaWarung', 'Warung Saya');
  const alamatUsaha = await getSetting('alamat', '');

  if (btCharacteristic) {
    const receipt = buildReceiptText(sale, warungName, alamatUsaha);
    const ok = await sendToPrinter(receipt);
    if (ok) showToast('✅ Nota berhasil dicetak!');
  } else {
    printNotaBrowser(sale, warungName, alamatUsaha);
  }
}

// ── Browser Print Fallback ─────────────────────────────────────────────────
function printNotaBrowser(sale, warungName, alamat = '') {
  // M2: validasi defensif
  if (!sale || typeof sale !== 'object') {
    showToast('Data transaksi tidak valid', 'error');
    return;
  }

  const items = Array.isArray(sale.items) ? sale.items : [];
  const itemsHtml = items.map(i => {
    const qty = safeNum(i.qty, 1);
    // Harga efektif: hargaOjol dipakai bila terisi, sama seperti jalur thermal
    const hargaOjol = safeNum(i.hargaOjol, 0);
    const base = hargaOjol > 0 ? hargaOjol : safeNum(i.hargaJual, 0);
    let lineTotal = base * qty;
    // Topping ikut tercetak di bawah nama item (qty per-topping via normalizeToppingQtys)
    let toppingsHtml = '';
    const qtys = normalizeToppingQtys(i);
    if (Array.isArray(i.selectedToppings)) {
      toppingsHtml = i.selectedToppings.map(t => {
        const th = safeNum(t.harga, 0);
        const tq = Math.max(1, parseInt(qtys[t.nama], 10) || 1);
        lineTotal += th * tq;
        return '<div style="font-size:10px;color:#444;padding-left:8px">+ ' +
          escapeHtml(safeStr(t.nama, 'Topping')) + ' ×' + tq + (th > 0 ? ' ' + formatRp(th) + ' = ' + formatRp(th * tq) : '') + '</div>';
      }).join('');
    }
    // Catatan per menu terpilih (komentar browser #8) — di bawah topping
    const itemNoteTxt = safeStr(i.catatanItem, '').trim();
    const itemNoteHtml = itemNoteTxt
      ? '<div style="font-size:10px;color:#444;padding-left:8px">* ' + escapeHtml(itemNoteTxt) + '</div>'
      : '';
    return '<tr><td>' + escapeHtml(safeStr(i.nama, 'Item')) + toppingsHtml + itemNoteHtml + '</td>' +
      '<td class="kcenter">' + qty + '</td>' +
      '<td class="kright">' + formatRp(lineTotal) + '</td></tr>';
  }).join('');

  const d = new Date(sale.waktu);
  if (isNaN(d.getTime())) d.setTime(Date.now());
  const dateStr = String(d.getDate()).padStart(2, '0') + '/' +
                  String(d.getMonth() + 1).padStart(2, '0') + '/' +
                  d.getFullYear() + ' ' +
                  String(d.getHours()).padStart(2, '0') + ':' +
                  String(d.getMinutes()).padStart(2, '0');

  // v145: nota dirakit jadi SATU string dulu.
  // Sebab window.open() bisa mengembalikan null (popup diblokir / PWA standalone /
  // user gesture sudah habis karena await di printNota) → akses .document crash (log beta).
  const htmlParts = [];
  htmlParts.push('<html><head><title>Nota</title><style>body{font-family:monospace;font-size:12px;width:280px;margin:0 auto;padding:8px}h2{text-align:center;margin:0;font-size:14px}p.sub{text-align:center;margin:2px 0;font-size:11px;color:#666}p.kfs11{margin:2px 0;font-size:11px}hr{border:none;border-top:1px dashed #000;margin:6px 0}table{width:100%;border-collapse:collapse}td{padding:2px 0;font-size:11px;vertical-align:top}.total{font-weight:bold;font-size:13px}.footer{text-align:center;margin-top:8px;font-size:11px}@media print{body{width:100%}}</style></head><body>');
  htmlParts.push('<h2>' + escapeHtml(safeStr(warungName, 'Warung Saya')) + '</h2>');
  const alamatTxt = String(alamat || '').trim();
  if (alamatTxt) htmlParts.push('<p class="sub">' + escapeHtml(alamatTxt) + '</p>');
  htmlParts.push('<hr>');
  htmlParts.push('<p class="kfs11">' + dateStr + '</p>');
  if (sale.nomor) htmlParts.push('<p class="kfs11" style="font-weight:bold">No: ' + escapeHtml(String(sale.nomor)) + '</p>');
  // Tipe pesanan selalu tampil (kiri), catatan pesanan di kanan
  const ORDER_TYPE_LABELS = { 'dine-in': 'Dine-in', 'takeaway': 'Take-away', 'ojol': 'Ojol' };
  const typeLabel = ORDER_TYPE_LABELS[sale.orderType] || 'Dine-in';
  const noteHtml = String(sale.orderNote || '').trim();
  htmlParts.push('<p class="kfs11" style="display:flex;justify-content:space-between;gap:8px"><span>' + escapeHtml(typeLabel) + '</span>' +
    (noteHtml ? '<span style="text-align:right"><b>Note:</b> ' + escapeHtml(noteHtml) + '</span>' : '') + '</p>');
  htmlParts.push('<hr>');
  htmlParts.push('<table>' + itemsHtml + '</table>');
  htmlParts.push('<hr>');
  const PAY_SHORT2 = { tunai: 'Tunai', qris: 'QRIS', transfer: 'Transfer' };
  const refPrint = String(sale.refBayar || '').trim();
  const catPrint = String(sale.catatanBayar || '').trim();
  htmlParts.push('<table><tr class="total"><td>TOTAL</td><td class="kright">' + formatRp(safeNum(sale.totalHarga, 0)) + '</td></tr>');
  htmlParts.push('<tr><td>Bayar via</td><td class="kright">' + escapeHtml(PAY_SHORT2[sale.metodeBayar] || 'Tunai') + '</td></tr>');
  if (refPrint) htmlParts.push('<tr><td>Ref</td><td class="kright">' + escapeHtml(refPrint) + '</td></tr>');
  if (catPrint) htmlParts.push('<tr><td>Catatan bayar</td><td class="kright">' + escapeHtml(catPrint) + '</td></tr>');
  htmlParts.push('<tr><td>Bayar</td><td class="kright">' + formatRp(safeNum(sale.bayar, 0)) + '</td></tr>');
  htmlParts.push('<tr><td>Kembali</td><td class="kright">' + formatRp(safeNum(sale.kembalian, 0)) + '</td></tr></table>');
  // v159 (permintaan pemilik): foto bukti pembayaran TIDAK dicetak di nota.
  // Bukti tetap tersimpan di record penjualan dan tetap tampil di detail transaksi.
  htmlParts.push('<hr>');
  htmlParts.push('<p class="footer">Terima kasih! Semoga berkah<br><span style="font-size:10px;color:#666">Kasir Solo - Kaki Lima</span></p>');
  htmlParts.push('</body></html>');
  const notaHtml = htmlParts.join('');

  // Jalur 1: tab popup (perilaku lama)
  const printWindow = window.open('', '_blank', 'width=320,height=600');
  if (printWindow && printWindow.document) {
    printWindow.document.write(notaHtml);
    printWindow.document.close();
    setTimeout(() => {
      try { printWindow.focus(); printWindow.print(); } catch (e) { console.warn('print popup gagal:', e); }
    }, 300);
    return;
  }

  // Jalur 2 (fallback): iframe tersembunyi di dokumen yang sama — tidak kena popup blocker
  try {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('title', 'cetak-nota');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    let removed = false;
    const cleanup = () => {
      if (removed) return;
      removed = true;
      try { window.removeEventListener('afterprint', cleanup); } catch (e) { /* noop */ }
      setTimeout(() => { try { iframe.remove(); } catch (e) { /* noop */ } }, 100);
    };
    window.addEventListener('afterprint', cleanup);
    document.body.appendChild(iframe);
    const idoc = iframe.contentWindow && iframe.contentWindow.document;
    if (!idoc) throw new Error('iframe dokumen tidak tersedia');
    idoc.open();
    idoc.write(notaHtml);
    idoc.close();
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        console.warn('print iframe gagal:', e);
        cleanup();
        showToast('Gagal membuka dialog cetak', 'error');
      }
    }, 300);
    // Safety net: dialog cetak tidak selalu memicu afterprint (mis. dibatalkan)
    setTimeout(cleanup, 60000);
  } catch (err) {
    console.error('printNotaBrowser fallback error:', err);
    showToast('Gagal membuka dialog cetak', 'error');
  }
}

// ── Test Print (M1: refactor pakai buildReceiptText) ──────────────────────
export async function testPrint() {
  if (!btCharacteristic) {
    showToast('Hubungkan printer dulu!', 'error');
    return;
  }

  // Header tes langsung via parameter nama usaha; footer tes diganti teks singkat
  const receipt = buildReceiptText(
    {
      waktu: Date.now(),
      items: [],
      totalHarga: 0,
      bayar: 0,
      kembalian: 0
    },
    '=== TES CETAK ===',
    ''
  );

  const testTxt = receipt.replace('Terima kasih! Semoga berkah', 'Printer berfungsi!');

  const ok = await sendToPrinter(testTxt);
  if (ok) showToast('✅ Tes cetak berhasil!');
}

// ── Restore State (H1: auto-restore saat boot) ────────────────────────────
// Dipanggil dari app.js boot() untuk menampilkan status printer sebelumnya
export function getSavedPrinterName() {
  const state = getPrinterState();
  return state ? state.name : null;
}
