// ==================== BLUETOOTH PRINTER (ESM) ====================
import { DB, getSetting } from './db.js';
import { escapeHtml, formatRp, showToast } from './helpers.js';
import { selectedTrxId, lastSaleId } from './app-state.js';

let btDevice = null;
let btCharacteristic = null;

export async function connectBTPrinter() {
  try {
    if (!navigator.bluetooth) {
      showToast('Browser ini tidak mendukung Bluetooth. Gunakan Chrome di Android.', 'error');
      return;
    }

    showToast('Mencari printer Bluetooth...');

    btDevice = await navigator.bluetooth.requestDevice({
      filters: [
        { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
        { namePrefix: 'RPP' },
        { namePrefix: 'MPT' },
        { namePrefix: 'BlueTooth' },
        { namePrefix: 'Printer' },
        { namePrefix: 'PT-' },
        { namePrefix: 'TP-' },
        { namePrefix: 'MTP' },
        { namePrefix: 'SPP' }
      ],
      optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '49535343-fe7d-4ae5-8fa9-9fafd205e455', '0000ff00-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2']
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
      } catch(e) { /* try next */ }
    }

    if (!btCharacteristic) {
      throw new Error('Tidak ditemukan karakteristik tulis pada printer');
    }

    document.getElementById('btPrinterStatus').textContent = '✅ Terhubung: ' + btDevice.name;
    showToast('✅ Printer terhubung: ' + btDevice.name);

    btDevice.addEventListener('gattserverdisconnected', () => {
      btCharacteristic = null;
      document.getElementById('btPrinterStatus').textContent = 'Terputus';
      showToast('Printer terputus', 'error');
    });

  } catch(err) {
    if (err.name === 'NotFoundError') {
      showToast('Printer tidak ditemukan', 'error');
    } else {
      showToast('Gagal: ' + err.message, 'error');
    }
    console.error('BT Error:', err);
  }
}

export function disconnectBTPrinter() {
  if (btDevice && btDevice.gatt.connected) {
    btDevice.gatt.disconnect();
    btCharacteristic = null;
    btDevice = null;
    document.getElementById('btPrinterStatus').textContent = 'Belum terhubung';
    showToast('Printer diputus');
  } else {
    showToast('Tidak ada printer terhubung', 'error');
  }
}

async function sendToPrinter(data) {
  if (!btCharacteristic) {
    showToast('Printer belum terhubung! Hubungkan dulu di Pengaturan.', 'error');
    return false;
  }
  try {
    // Send in chunks of 100 bytes for BLE
    const encoder = new TextEncoder();
    const bytes = encoder.encode(data);
    const chunkSize = 100;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize);
      if (btCharacteristic.properties.writeWithoutResponse) {
        await btCharacteristic.writeValueWithoutResponse(chunk);
      } else {
        await btCharacteristic.writeValue(chunk);
      }
      await new Promise(r => setTimeout(r, 50));
    }
    // Feed paper
    const feed = new Uint8Array([10, 10, 10, 10]);
    try {
      if (btCharacteristic.properties.writeWithoutResponse) {
        await btCharacteristic.writeValueWithoutResponse(feed);
      } else {
        await btCharacteristic.writeValue(feed);
      }
    } catch(e) {}
    return true;
  } catch(err) {
    showToast('Gagal cetak: ' + err.message, 'error');
    return false;
  }
}

export function buildReceiptText(sale, warungName) {
  const ESC = String.fromCharCode(27);
  const GS = String.fromCharCode(29);
  const LF = String.fromCharCode(10);

  // Initialize printer
  let txt = ESC + '@'; // Reset

  // Center align
  txt += ESC + 'a' + String.fromCharCode(1);
  txt += warungName + LF;
  txt += 'Kasir Solo - Kaki Lima' + LF;
  txt += '================================' + LF;

  // Left align
  txt += ESC + 'a' + String.fromCharCode(0);

  const d = new Date(sale.waktu);
  const dateStr = String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
  const timeStr = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  txt += 'Tgl: ' + dateStr + '  ' + timeStr + LF;
  txt += '--------------------------------' + LF;

  if (sale.items) {
    sale.items.forEach(item => {
      const name = item.nama.substring(0, 16);
      const qty = String(item.qty);
      const price = formatRpPlain(item.qty * item.hargaJual);
      txt += name + LF;
      txt += '  ' + qty + ' x ' + formatRpPlain(item.hargaJual) + '  = ' + price + LF;
    });
  }

  txt += '--------------------------------' + LF;
  txt += padLine('TOTAL', formatRpPlain(sale.totalHarga)) + LF;
  txt += padLine('Bayar', formatRpPlain(sale.bayar)) + LF;
  txt += padLine('Kembali', formatRpPlain(sale.kembalian)) + LF;
  txt += '================================' + LF;

  // Center
  txt += ESC + 'a' + String.fromCharCode(1);
  txt += 'Terima kasih!' + LF;
  txt += 'Semoga berkah' + LF;
  txt += LF + LF + LF;

  // Cut (if supported)
  txt += GS + 'V' + String.fromCharCode(66) + String.fromCharCode(3);

  return txt;
}

function formatRpPlain(n) {
  if (!n && n !== 0) return '0';
  return Math.round(n).toLocaleString('id-ID');
}

function padLine(left, right, width) {
  width = width || 32;
  const spaces = width - left.length - right.length;
  return left + ' '.repeat(Math.max(1, spaces)) + right;
}

export async function printNota() {
  const id = selectedTrxId;
  if (!id) return;
  const sale = await DB.penjualan.get(id);
  if (!sale) { showToast('Transaksi tidak ditemukan', 'error'); return; }

  const warungName = await getSetting('namaWarung', 'Warung Saya');

  if (btCharacteristic) {
    const receipt = buildReceiptText(sale, warungName);
    const ok = await sendToPrinter(receipt);
    if (ok) showToast('✅ Nota berhasil dicetak!');
  } else {
    // Fallback: browser print
    printNotaBrowser(sale, warungName);
  }
}

export async function printLastNota() {
  const id = lastSaleId;
  if (!id) { showToast('Tidak ada transaksi terakhir', 'error'); return; }
  const sale = await DB.penjualan.get(id);
  if (!sale) { showToast('Transaksi tidak ditemukan', 'error'); return; }

  const warungName = await getSetting('namaWarung', 'Warung Saya');

  if (btCharacteristic) {
    const receipt = buildReceiptText(sale, warungName);
    const ok = await sendToPrinter(receipt);
    if (ok) showToast('✅ Nota berhasil dicetak!');
  } else {
    printNotaBrowser(sale, warungName);
  }
}

function printNotaBrowser(sale, warungName) {
  const itemsHtml = sale.items ? sale.items.map(i =>
    '<tr><td>' + escapeHtml(i.nama) + '</td><td style="text-align:center">' + i.qty + '</td><td style="text-align:right">' + formatRp(i.qty * i.hargaJual) + '</td></tr>'
  ).join('') : '';

  const d = new Date(sale.waktu);
  const dateStr = String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear() + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');

  const printWindow = window.open('', '_blank', 'width=320,height=600');
  printWindow.document.write('<html><head><title>Nota</title><style>body{font-family:monospace;font-size:12px;width:280px;margin:0 auto;padding:8px}h2{text-align:center;margin:0;font-size:14px}p.sub{text-align:center;margin:2px 0;font-size:11px;color:#666}hr{border:none;border-top:1px dashed #000;margin:6px 0}table{width:100%;border-collapse:collapse}td{padding:2px 0;font-size:11px;vertical-align:top}.total{font-weight:bold;font-size:13px}.footer{text-align:center;margin-top:8px;font-size:11px}@media print{body{width:100%}}</style></head><body>');
  printWindow.document.write('<h2>' + escapeHtml(warungName) + '</h2>');
  printWindow.document.write('<p class="sub">Kasir Solo - Kaki Lima</p>');
  printWindow.document.write('<hr>');
  printWindow.document.write('<p style="font-size:11px">' + dateStr + '</p>');
  printWindow.document.write('<hr>');
  printWindow.document.write('<table>' + itemsHtml + '</table>');
  printWindow.document.write('<hr>');
  printWindow.document.write('<table><tr class="total"><td>TOTAL</td><td style="text-align:right">' + formatRp(sale.totalHarga) + '</td></tr>');
  printWindow.document.write('<tr><td>Bayar</td><td style="text-align:right">' + formatRp(sale.bayar) + '</td></tr>');
  printWindow.document.write('<tr><td>Kembali</td><td style="text-align:right">' + formatRp(sale.kembalian) + '</td></tr></table>');
  printWindow.document.write('<hr>');
  printWindow.document.write('<p class="footer">Terima kasih!<br>Semoga berkah</p>');
  printWindow.document.write('</body></html>');
  printWindow.document.close();
  setTimeout(() => { printWindow.print(); }, 300);
}

export async function testPrint() {
  if (!btCharacteristic) {
    showToast('Hubungkan printer dulu!', 'error');
    return;
  }
  const warungName = await getSetting('namaWarung', 'Warung Saya');
  const ESC = String.fromCharCode(27);
  const GS = String.fromCharCode(29);
  const LF = String.fromCharCode(10);

  let txt = ESC + '@';
  txt += ESC + 'a' + String.fromCharCode(1);
  txt += '=== TES CETAK ===' + LF;
  txt += warungName + LF;
  txt += 'Kasir Solo - Kaki Lima' + LF;
  txt += '================================' + LF;
  txt += 'Printer berfungsi!' + LF;
  txt += '================================' + LF;
  txt += LF + LF + LF;
  txt += GS + 'V' + String.fromCharCode(66) + String.fromCharCode(3);

  const ok = await sendToPrinter(txt);
  if (ok) showToast('✅ Tes cetak berhasil!');
}
