// Sisipkan blok dual-path printNota ke rosok/js/printer.js (sebelum blok status boot).
import { readFileSync, writeFileSync } from 'node:fs';

const p = 'rosok/js/printer.js';
let s = readFileSync(p, 'utf8');
const anchor = '// ── Status saat boot (auto-restore ala kaki5) ─────────────────────────────';

const block = `// ── Cetak Nota dual-path (port kaki5 printNota, 2026-09-13) ───────────────
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
export function buildReceiptText(trx, bizName) {
  const ESC = String.fromCharCode(27);
  const GS = String.fromCharCode(29);
  const LF = String.fromCharCode(10);
  if (!trx || typeof trx !== 'object') return '[DATA TRANSAKSI TIDAK VALID]';
  const items = Array.isArray(trx.items) ? trx.items : [];
  const d = new Date(trx.tanggal);
  const t = isNaN(d.getTime()) ? new Date() : d;
  const p2 = (n) => String(n).padStart(2, '0');
  let txt = ESC + '@'; // reset printer
  // Header (center)
  txt += ESC + 'a' + String.fromCharCode(1);
  txt += String(bizName || 'Kasir Solo - Rosok').substring(0, PRINT_WIDTH) + LF;
  txt += '='.repeat(PRINT_WIDTH) + LF;
  // Isi (left)
  txt += ESC + 'a' + String.fromCharCode(0);
  txt += 'Tgl: ' + p2(t.getDate()) + '/' + p2(t.getMonth() + 1) + '/' + t.getFullYear() + ' ' + p2(t.getHours()) + ':' + p2(t.getMinutes()) + LF;
  const jenis = trx.tipe === 'beli' ? 'Pembelian' : 'Penjualan';
  txt += jenis + (trx.kontakNama ? ' - ' + String(trx.kontakNama).substring(0, PRINT_WIDTH - jenis.length - 3) : '') + LF;
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
  txt += 'Kasir Solo - Rosok' + LF;
  txt += LF + LF + LF;
  txt += GS + 'V' + String.fromCharCode(66) + String.fromCharCode(3);
  return txt;
}

export async function printNota() {
  const trx = _currentNota;
  if (!trx || !Array.isArray(trx.items)) { toast('Belum ada nota untuk dicetak'); return; }
  const biz = (SETTINGS && SETTINGS.bizName) || 'Kasir Solo - Rosok';
  if (btCharacteristic) {
    const okPrint = await sendToPrinter(buildReceiptText(trx, biz));
    if (okPrint) toast('✅ Nota berhasil dicetak!');
  } else {
    // Fallback: print browser (popup → iframe), pola kaki5 printNotaBrowser.
    printNotaBrowser(trx, biz);
  }
}

// ── Fallback print browser (port kaki5, lebar nota 38 kolom ≈ 333px) ─────
function printNotaBrowser(trx, bizName) {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const d = new Date(trx.tanggal);
  const t = isNaN(d.getTime()) ? new Date() : d;
  const p2 = (n) => String(n).padStart(2, '0');
  const tgl = p2(t.getDate()) + '/' + p2(t.getMonth() + 1) + '/' + t.getFullYear() + ' ' + p2(t.getHours()) + ':' + p2(t.getMinutes());
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
    '<h2>' + esc(bizName) + '</h2>' + '<hr>' +
    '<p class="sub">' + tgl + ' · ' + esc(jenis) + (trx.kontakNama ? ' — ' + esc(trx.kontakNama) : '') + '</p>' +
    (cat ? '<p class="sub">Catatan: ' + esc(cat) + '</p>' : '') +
    '<hr><table>' + itemsHtml + '</table><hr>' +
    '<table><tr class="tot"><td>TOTAL</td><td class="kr">' + RP(trx.total) + '</td></tr>' + bayarHtml + '</table><hr>' +
    '<p class="footer">Terima kasih! Semoga berkah<br><span style="font-size:10px;color:#666">Kasir Solo - Rosok</span></p>' +
    '</body></html>';

  // Jalur 1: tab popup — window.open bisa null (popup diblokir / PWA standalone,
  // pelajaran kaki5 v145) → jatuh ke jalur 2.
  const win = window.open('', '_blank', 'width=380,height=640');
  if (win && win.document) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => { try { win.focus(); win.print(); } catch (e) { console.warn('print popup gagal:', e); toast('❌ Gagal mencetak nota — coba lagi'); } }, 300);
    return;
  }
  // Jalur 2: iframe tersembunyi — tidak kena popup blocker.
  try {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('title', 'cetak-nota');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    iframe.srcdoc = html;
    let removed = false;
    const cleanup = () => {
      if (removed) return;
      removed = true;
      setTimeout(() => { try { iframe.remove(); } catch (_) {} }, 100);
    };
    iframe.onload = () => {
      try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) { toast('❌ Gagal mencetak nota'); }
      setTimeout(cleanup, 500);
    };
    window.addEventListener('afterprint', cleanup);
    document.body.appendChild(iframe);
  } catch (e) {
    console.warn('print iframe gagal:', e);
    toast('❌ Gagal mencetak nota');
  }
}

`;
if (!s.includes(anchor)) { console.error('anchor tidak ketemu'); process.exit(1); }
s = s.replace(anchor, block + anchor);
writeFileSync(p, s);
console.log('dual-path block ditambahkan');
