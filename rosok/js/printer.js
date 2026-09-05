/* =========================================================================
   KASIR SOLO - ROSOK
   printer.js — Printer thermal Bluetooth (adopsi kaki5).
   Mekanisme kaki5: BLE chunking 20 byte + delay 30ms, retry 3x, guard
   race condition, persistensi koneksi via localStorage, auto-restore
   status saat boot. Cetak nota rosok = window.print() yang sudah ada
   (tombol di sheet Nota); modul ini menyediakan koneksi + tes cetak.
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
const PRINT_WIDTH = 32;        // karakter, kertas 58mm

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

// ── Cetak Tes (teks 32 kolom ala nota thermal) ────────────────────────────
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

// ── Status saat boot (auto-restore ala kaki5) ─────────────────────────────
export function restorePrinterStatus(){
  const st = getPrinterState();
  if (st && st.name) {
    setStatus('Terakhir: ' + st.name + ' — hubungkan ulang bila perlu');
  }
}
