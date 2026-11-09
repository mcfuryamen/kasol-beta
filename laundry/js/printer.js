// ==================== PRINTER BLUETOOTH (laundry — port kaki5 printer.js) ====================
// Web Bluetooth thermal printer: connect/disconnect/test/cetak, chunk 20 byte,
// persistensi nama perangkat di localStorage. Modul berdiri sendiri — diakses
// lewat window.LDPrinter dari script inline.
const BT_STATE_KEY = 'ksldry_printer_state';
const BLE_CHUNK_SIZE = 20;
const BLE_WRITE_DELAY_MS = 30;

let btDevice = null;
let btCharacteristic = null;
let _printingInFlight = false;

function savePrinterState(name){
  try { localStorage.setItem(BT_STATE_KEY, JSON.stringify({ name, connectedAt: Date.now() })); } catch (_) {}
}
function getPrinterState(){
  try { const raw = localStorage.getItem(BT_STATE_KEY); return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
}
function clearPrinterState(){
  try { localStorage.removeItem(BT_STATE_KEY); } catch (_) {}
}
function toast(msg, type){
  if (typeof window.toast === 'function') window.toast(msg);
  else console.log('[PRINTER]', msg);
}
function setStatusEl(text){
  const el = document.getElementById('ldPrinterStatus');
  if (el) el.textContent = text;
}

export async function connectBTPrinter(){
  try {
    if (!navigator.bluetooth){ toast('Browser ini tidak mendukung Bluetooth. Gunakan Chrome di Android.'); return; }
    toast('Mencari printer Bluetooth...');
    btDevice = await navigator.bluetooth.requestDevice({
      filters: [
        { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
        { namePrefix: 'RPP' }, { namePrefix: 'MPT' }, { namePrefix: 'BlueTooth' },
        { namePrefix: 'Printer' }, { namePrefix: 'PT-' }, { namePrefix: 'TP-' },
        { namePrefix: 'MTP' }, { namePrefix: 'SPP' },
      ],
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455',
        '0000ff00-0000-1000-8000-00805f9b34fb',
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
      ],
    });
    toast('Menghubungkan ke ' + btDevice.name + '...');
    const server = await btDevice.gatt.connect();
    const serviceUUIDs = [
      '000018f0-0000-1000-8000-00805f9b34fb',
      '49535343-fe7d-4ae5-8fa9-9fafd205e455',
      '0000ff00-0000-1000-8000-00805f9b34fb',
      'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
    ];
    btCharacteristic = null;
    for (const svcUUID of serviceUUIDs){
      try {
        const service = await server.getPrimaryService(svcUUID);
        const chars = await service.getCharacteristics();
        for (const c of chars){
          if (c.properties.write || c.properties.writeWithoutResponse){ btCharacteristic = c; break; }
        }
        if (btCharacteristic) break;
      } catch (_) { /* coba UUID berikutnya */ }
    }
    if (!btCharacteristic) throw new Error('Tidak ditemukan karakteristik tulis pada printer');
    savePrinterState(btDevice.name);
    setStatusEl('✅ Terhubung: ' + btDevice.name);
    toast('✅ Printer terhubung: ' + btDevice.name);
    btDevice.addEventListener('gattserverdisconnected', () => {
      btCharacteristic = null; btDevice = null;
      clearPrinterState();
      setStatusEl('Terputus');
      toast('Printer terputus');
    });
  } catch (err){
    if (err && err.name === 'NotFoundError') toast('Printer tidak ditemukan');
    else { console.error('BT Error:', err); toast('❌ Gagal terhubung: ' + String((err && err.message) || err).slice(0, 80)); }
    clearPrinterState();
  }
}

export function disconnectBTPrinter(){
  if (btDevice && btDevice.gatt.connected){
    btDevice.gatt.disconnect();
    btCharacteristic = null; btDevice = null;
    clearPrinterState();
    setStatusEl('Belum terhubung');
    toast('Printer diputus');
  } else {
    toast('Tidak ada printer terhubung');
  }
}

// Kirim teks ESC/POS ke printer (retry 3x, guard race, deteksi putus di tengah).
export async function printText(data){
  if (!btCharacteristic || _printingInFlight){ toast('Printer belum terhubung!'); return false; }
  let attempts = 0;
  const MAX = 3;
  while (attempts < MAX){
    attempts++;
    try {
      _printingInFlight = true;
      const bytes = new TextEncoder().encode(data);
      let putusTengah = false;
      for (let i = 0; i < bytes.length; i += BLE_CHUNK_SIZE){
        if (!btCharacteristic){ putusTengah = true; break; }
        const chunk = bytes.slice(i, i + BLE_CHUNK_SIZE);
        if (btCharacteristic.properties.writeWithoutResponse) await btCharacteristic.writeValueWithoutResponse(chunk);
        else await btCharacteristic.writeValue(chunk);
        await new Promise(r => setTimeout(r, BLE_WRITE_DELAY_MS));
      }
      if (btCharacteristic){
        const feed = new Uint8Array([10, 10, 10, 10]);
        try {
          if (btCharacteristic.properties.writeWithoutResponse) await btCharacteristic.writeValueWithoutResponse(feed);
          else await btCharacteristic.writeValue(feed);
        } catch (_) {}
      }
      if (putusTengah){ toast('⚠️ Printer terputus saat mencetak — nota belum lengkap'); return false; }
      return true;
    } catch (err){
      if (attempts >= MAX){ console.error('Gagal cetak', err); toast('Gagal cetak'); return false; }
      await new Promise(r => setTimeout(r, 200));
    } finally {
      _printingInFlight = false;
    }
  }
  return false;
}

export async function testPrint(){
  const ESC = String.fromCharCode(27); const LF = '\n';
  const nama = (typeof getNamaUsaha === 'function') ? '' : '';
  let txt = ESC + '@';
  txt += ESC + 'a' + String.fromCharCode(1);
  txt += 'KASIR SOLO LAUNDRY' + LF + '=== TES PRINTER ===' + LF;
  txt += new Date().toLocaleString('id-ID') + LF;
  txt += 'Printer berfungsi dengan baik ✅' + LF;
  const ok = await printText(txt);
  if (ok) toast('✅ Tes cetak terkirim');
}

export function getSavedPrinterName(){
  const st = getPrinterState();
  return st && st.name ? st.name : null;
}
export function isConnected(){
  return !!(btCharacteristic && btDevice && btDevice.gatt.connected);
}

// Wire status awal saat modul dimuat
(function initStatus(){
  const saved = getSavedPrinterName();
  if (saved) setStatusEl('Menyambut: ' + saved + ' (ketuk untuk sambung ulang)');
})();

window.LDPrinter = { connect: connectBTPrinter, disconnect: disconnectBTPrinter, printText, test: testPrint, connected: isConnected, savedName: getSavedPrinterName };
