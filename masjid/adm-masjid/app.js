/* ===== Pelacak error global (P3-3, 20 Nov 2026) =====
   Dulu error runtime hilang tanpa jejak. Sekarang dicatat ke console dan disimpan
   di perangkat (10 error terakhir) supaya bisa dilihat saat penggunaAQERTA. */
(function () {
  var KEY = 'ks_errlog_masjid';
  function cat(msg) {
    try {
      var arr = JSON.parse(localStorage.getItem(KEY) || '[]');
      arr.push({ t: new Date().toISOString(), m: String(msg).slice(0, 300) });
      localStorage.setItem(KEY, JSON.stringify(arr.slice(-10)));
    } catch (e) { /* penyimpanan penuh — abaikan */ }
  }
  window.addEventListener('error', function (e) {
    cat((e.message || 'error') + ' @ ' + (e.filename || '') + ':' + (e.lineno || ''));
    try { console.error('[masjid]', e.message); } catch (_) {}
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    cat('promise: ' + (r && r.message ? r.message : r));
    try { console.error('[masjid]', r); } catch (_) {}
  });
})();


/* =========================================================
   KASIR SOLO PLATFORM — kuota gratis bulanan, lisensi per perangkat,
   buka/tutup kas, pengeluaran & pemasukan, nota & printer, diagnosa, PWA.
   Dipakai bersama oleh Konter HP, Laundry, dan Masjid.
   ========================================================= */
(function () {
'use strict';
/* quota: kuota gratis bulanan (catatan). quota <= 0 = TANPA kuota (mode gate fitur saja).
   proFeatures: daftar fitur yang TERKUNCI untuk akun tanpa lisensi. Lihat blok
   "gate fitur berlisensi" di bawah. SAMPEL v1.5.6: (a) Laporan — halaman tetap bisa dibuka,
   mode Mingguan (minggu ini) tetap bisa dipakai; yang TERKUNCI tab Bulanan, tab Custom, dan
   geser periode ‹ ›. (b) Kas — halaman tetap bisa dibuka; yang TERKUNCI tab Pinjaman dan
   tab 🤲 Zakat. */
const CFG = {"key": "masjid", "name": "Kasir Solo - Masjid", "prefix": "KSM", "salt": "KS-MASJID-LIC-2026-v2", "quota": 60, "unit": "catatan", "wa": "628816566935", "version": "1.5.8", "proFeatures": {
  "laporan.bulanan": { "label": "Laporan Bulanan" },
  "laporan.custom": { "label": "Laporan Custom (pilih tanggal)" },
  "laporan.mingguan.nav": { "label": "Geser periode minggu (minggu lalu/berikutnya)" },
  "kas.pinjaman": { "label": "Modul Pinjaman Kas" },
  "kas.zakat": { "label": "Modul Zakat" }
}};
window.APP_VERSION = CFG.version;
/* --- algoritma lisensi per perangkat (dipakai aplikasi & generator; harus identik) --- */
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa I, O, 0, 1 agar tidak salah baca
function h53(str, seed) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
function licenseCode(prefix, salt, dev) {
  let o = '';
  for (let i = 0; i < 12; i++) o += ALPHA[h53(salt + '|' + dev + '|' + i, i + 7) % 32];
  return prefix + '-' + o.slice(0, 4) + '-' + o.slice(4, 8) + '-' + o.slice(8, 12);
}

const A = {
  mode: 'masjid', hasKas: false, hasCashflow: false,
  storeName: () => DB.settings.namaMasjid || 'Masjid',
  grossLabel: '',
  expCats: [], incCats: [],
  SUMBER: ['Tunai', 'Rekening Bank', 'QRIS / Dompet Digital'],
  termsService: 'aplikasi manajemen masjid: mencatat kas pemasukan dan pengeluaran per sumber dana (tunai, rekening, QRIS), data jamaah, jadwal kegiatan dan kajian, inventaris, laporan transparansi, serta cetak bukti penerimaan/pengeluaran.',
  termsData: 'Data jamaah dan keuangan masjid tidak pernah dikirim ke server kami. Pengurus bertanggung jawab menjaga kerahasiaan data jamaah.',
  counts: () => DB.kas.length + ' catatan kas · ' + DB.jamaah.length + ' jamaah · ' + DB.kegiatan.length + ' kegiatan · ' + DB.inventaris.length + ' aset · ' + (DB.pinjam||[]).filter(p=>p.status==='dipinjam').length + ' dipinjam · ' + (DB.pinjamKas||[]).filter(p=>!pinjamKasLunas(p)).length + ' pinjaman kas',
  cashIn: () => ({ tunai: 0, nonTunai: 0, count: 0 }),
  gross: () => 0,
  receipt(kind, k, u) {
    const masuk = k.tipe === 'masuk';
    const rows = [{ t: 'c', s: masuk ? 'BUKTI PENERIMAAN' : 'BUKTI PENGELUARAN' }, { t: 'lr', l: 'Tanggal', r: u.fmtD(k.tanggal) }, { t: 'hr' },
      { t: 'lr', l: 'Kategori', r: k.kategori }, { t: 'lr', l: masuk ? 'Masuk ke' : 'Dari', r: k.sumber || 'Tunai' }, { t: 'lr', l: 'JUMLAH', r: u.rp(k.jumlah) }];
    if (k.keterangan) rows.push({ t: 'hr' }, { t: 'p', s: k.keterangan });
    rows.push({ t: 'n' }, { t: 'c', s: masuk ? 'Jazakumullahu khairan' : 'Tercatat oleh Bendahara' }, { t: 'n' });
    return rows;
  },
  help: [
    ['💰 Kas & Keuangan', 'Menu <b>Kas</b> untuk mencatat pemasukan (infaq Jumat, donasi, zakat, wakaf, kotak amal) dan pengeluaran (listrik, honor, perawatan, kegiatan). Pilih <b>sumber dana</b>: tunai, rekening bank, atau QRIS.'],
    ['🧮 Opname Kas', 'Dari Beranda atau <b>Lainnya → Opname Kas</b>: hitung uang tunai fisik di brankas, lalu bandingkan dengan catatan aplikasi. Selisih bisa dicatat sebagai penyesuaian.'],
    ['📅 Kegiatan & Kajian', 'Catat jadwal kajian dan kegiatan beserta pengisi dan tempat. Kalau kegiatannya rutin, pakai <b>Jadwal diulang?</b> supaya tanggalnya dibuat sekaligus banyak. Kegiatan yang tanggalnya sudah lewat otomatis pindah ke <b>Selesai</b>.'],
    ['🔁 Jadwal Berulang', 'Saat menambah kegiatan, buka <b>Jadwal diulang?</b> lalu pilih <b>Tiap hari</b>, <b>Tiap minggu</b>, <b>Tiap bulan</b>, atau <b>Tiap tahun</b>, dan tentukan <b>Dibuat berapa kali</b> (maks. 52). Contoh: <i>Tiap minggu</i> → centang hari Selasa dan Jumat; <i>Tiap bulan</i> → pakai <b>Tanggal tetap</b> (mis. tiap tanggal 10) atau <b>Hari tetap</b> (mis. hari Jumat yang <b>pertama</b> atau <b>terakhir</b>). Tanggal hasilnya bisa dilihat dulu sebelum disimpan, dan tiap tanggal bisa diubah atau dihapus sendiri-sendiri.'],
    ['🧑‍🤝‍🧑 Jamaah & Inventaris', 'Simpan data jamaah dan aset masjid (sound system, karpet, dll) beserta kondisinya.'],
    ['📊 Laporan', 'Laporan mingguan/bulanan/tahunan per kategori dan per sumber dana — cocok untuk dilaporkan ke jamaah secara transparan.'],
    ['🖨️ Bukti', 'Di detail transaksi kas tersedia <b>Cetak Bukti</b> (printer thermal Bluetooth atau browser).'],
    ['💾 Backup', 'Rutin tekan <b>Backup</b> di Pengaturan dan simpan filenya. Data hanya ada di perangkat ini.']
  ],
  hooks: [
    {
      fn: 'saveTransaksi', arr: 'kas', needKas: false,
      pre() { return { sumber: ($('txSumber') || {}).value || 'Tunai' }; },
      onNew(rec, ctx) { rec.sumber = ctx.sumber; saveDB(); renderView(navStack[navStack.length - 1]); }
    }
  ],
  install(P) {
    P.wrapGuard('openTransaksiForm', { needKas: false });
    /* Gate fitur (v1.5.6): saat CFG.proFeatures diisi, tombol-tombol tambah ini ikut terkunci. */
    P.wrapGuard('openJamaahForm', { feature: 'jamaah' });
    P.wrapGuard('openInventarisForm', { feature: 'inventaris' });
    P.wrapGuard('openKegiatanForm', { feature: 'kegiatan' });
    P.wrapGuard('openZakatMenu', { feature: 'kas.zakat' });
    P.printKas = id => P.printRecord('kas', DB.kas.find(x => x.id === id));

    // pilihan sumber dana di form transaksi
    P.helpers.after('openTransaksiForm', tipe => {
      const sel = $('txKategori'); if (!sel || $('txSumber')) return;
      sel.insertAdjacentHTML('afterend', `<label>${tipe === 'masuk' ? 'Masuk ke' : 'Dibayar dari'}</label><select id="txSumber">${A.SUMBER.map(s => `<option value="${s}">${s}</option>`).join('')}</select>`);
    });

    // baris kas menampilkan sumber dana
    window.kasRowHTML = function (k) {
      const isMasuk = k.tipe === 'masuk';
      return `<button type="button" class="list-item" style="cursor:pointer;" onclick="openTransaksiDetail('${k.id}')">
        <div class="avatar" style="background:${isMasuk ? 'var(--success-bg)' : 'var(--danger-bg)'};color:${isMasuk ? 'var(--success)' : 'var(--danger)'};">${kasEmoji(k)}</div>
        <div class="meta"><div class="t">${esc(k.kategori)}</div><div class="s">${[k.sub, k.bentuk && k.bentuk!=='Uang' ? k.bentuk+(k.banyak?(' '+k.banyak):'') : '', k.dari ? 'dari ' + k.dari : '', k.sumber === SUMBER_BARANG ? '🍚 Barang (bukan uang)' : (k.sumber || 'Tunai'), k.keterangan, k.foto ? '📷' : ''].filter(Boolean).map(esc).join(' · ')}</div></div>
        <div class="right"><div class="amt ${isMasuk ? 'plus' : 'minus'}">${isMasuk ? '+' : '-'}${rp(k.jumlah)}</div><div class="s">${fmtShort(k.tanggal)}</div></div>
      </button>`;
    };

    // detail transaksi: sumber dana + cetak bukti
    P.helpers.after('openTransaksiDetail', id => {
      const k = DB.kas.find(x => x.id === id), box = $('modalBox'); if (!k || !box) return;
      const rowsEl = box.querySelector('.total-row.big');
      if (rowsEl) rowsEl.insertAdjacentHTML('beforebegin', `<div class="total-row"><span>${k.tipe === 'masuk' && k.sumber === SUMBER_BARANG ? 'Bukan uang (barang)' : k.tipe === 'masuk' ? 'Masuk ke' : 'Dibayar dari'}</span><span>${esc(k.sumber || 'Tunai')}</span></div>`);
      // tombol cetak digabung ke baris aksi modal (dulu baris terpisah → 2 baris sticky).
      // Catatan pinjaman: tombol Cetak ditaruh di kiri. Kedua tombol berbagi lebar sama rata.
      const rowEl = box.querySelector('.btn-row');
      if (rowEl) {
        const btnCetak = `<button class="btn btn-secondary" onclick="Platform.printKas('${k.id}')">🖨️ Cetak</button>`;
        rowEl.insertAdjacentHTML((k.refPinjam || k.refSalur) ? 'afterbegin' : 'beforeend', btnCetak);
      }
    });
  }
};


const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rp = n => (n < 0 ? '-' : '') + 'Rp' + Math.round(Math.abs(n || 0)).toLocaleString('id-ID');
const pad2 = n => String(n).padStart(2, '0');
const dayOf = d => { d = d || new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
const ymNow = () => { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1); };
const fmtD = iso => new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtShort = iso => new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const inWin = (iso, f, t) => { const x = new Date(iso).getTime(); return x >= f && x <= t; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const uid = () => 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const toastMsg = m => { if (typeof toast === 'function') toast(m); };

const NET = A.netLabel || 'Laba Bersih', NETW = A.netShort || 'laba';
const P = {};
window.Platform = P;
P.cfg = CFG;
P._A = A;

/* ---------- penyimpanan khusus (tahan restore/backup) ---------- */
const LS = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) {
    try { localStorage.setItem(k, v); return true; }
    catch (e) {
      /* P3-4: sebelumnya kegagalan simpan ditelan diam-diam (hanya return false).
         Sekarang dicatat supaya jelas ini storage penuh, bukan bug lain. */
      if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
        try { console.warn('[masjid] penyimpanan perangkat penuh, gagal menyimpan: ' + k); } catch (_) {}
      }
      return false;
    }
  }
};
const K = { dev: 'ks_dev_' + CFG.key, lic: 'ks_lic_' + CFG.key, use: 'ks_use_' + CFG.key };

function deviceId() {
  let d = LS.get(K.dev);
  if (!d || !/^[A-HJ-NP-Z2-9]{8}$/.test(d)) {
    const a = new Uint8Array(8);
    try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < 8; i++) a[i] = Math.floor(Math.random() * 256); }
    d = ''; for (let i = 0; i < 8; i++) d += ALPHA[a[i] % 32];
    LS.set(K.dev, d);
  }
  return d;
}
// Diekspor untuk modul Akun (blok skrip kedua): app_my_license butuh device_code
// yang SAMA dengan yang selama ini dipakai lisensi per-perangkat.
P.deviceId = deviceId;
const devFmt = d => d.slice(0, 4) + '-' + d.slice(4);

/* state yang ikut backup (kas, keuangan) disimpan di DB.platform */
function st() {
  let p = DB.platform; if (!p) p = DB.platform = {};
  p.cashflow = p.cashflow || [];
  if (p.shift === undefined) p.shift = null;
  p.shiftLog = p.shiftLog || [];
  p.opnameLog = p.opnameLog || [];
  p.settings = p.settings || { kas: false };
  return p;
}

/* ---------- lisensi & kuota ----------
   Sejak v1.3.0 lisensi MENGIKUT AKUN (RPC app_my_license, sama dengan kaki5
   Fase B1) — bukan lagi kode device-bound. Kuota gratis bulanan tetap berlaku
   untuk akun yang BELUM punya lisensi. */
P.isLicensed = () => { try { return typeof Akun !== 'undefined' && Akun.licensed(); } catch (e) { return false; } };

/* ---------- gate fitur berlisensi (v1.5.6) ----------
   CFG.proFeatures = daftar fitur yang TERKUNCI untuk akun tanpa lisensi. Kunci bisa
   selevel halaman (mis. "jamaah") atau granular (mis. "laporan.bulanan" — kunci diawali
   nama halaman + '.'). Sampel aktif: lihat CFG.proFeatures (Laporan: Bulanan, Custom,
   dan geser periode minggu yang terkunci; halaman & mode Mingguan tetap bebas).
   Skema harga (lifetime ATAU langganan) TIDAK mengubah gate: gate cukup tanya
   "akun berlisensi?" — status selalu dari server (RPC app_my_license; lisensi
   kedaluwarsa otomatis ditolak server) plus cek lokal license_expires_at di cache,
   jadi skema langganan (lisensi ber-expires_at) langsung ikut terkendali.
   Offline: cache lisensi terakhir dipakai (grace, sama seperti sesi). */
P.proFeatures = CFG.proFeatures = (CFG.proFeatures || {});
/* ---------- saklar pengunci & penyembunyian fitur dari Control Center (server) ----------
   Control Center menyimpan saklar PER FITUR pada halaman detail katalog (kolom
   jsonb `gate` di tabel products), dibaca via RPC publik `app_feature_gate`:
     { "<fitur>": { "lock": true, "hide": false } }
       lock=true → fitur TERKUNCI (muncul gate 🔒, butuh lisensi)
       hide=true → menu/fitur DISEMBUNYIKAN sama sekali (semua akun)
     null / tidak ada → default bawaan (CFG.proFeatures; tidak ada yang hidden)
   Format lama (nilai boolean) tetap didukung: true = {lock:true, hide:false}.
   Cache lokal dipakai lebih dulu supaya gate tetap jalan saat offline. */
P.proFeaturesDefault = JSON.parse(JSON.stringify(CFG.proFeatures || {})); /* snapshot default bawaan */
P.hiddenFeatures = {}; /* fitur yang disembunyikan (hide=true) */
P.GATE_K = 'ks_masjid_gate';
P.bacaGateCache = function () { try { return JSON.parse(LS.get(P.GATE_K) || 'null'); } catch (e) { return null; } };
P.simpanGateCache = function (g) { try { if (g) LS.set(P.GATE_K, JSON.stringify(g)); else localStorage.removeItem(P.GATE_K); } catch (e) { /* abaikan */ } };
/* Terapkan konfigurasi gate dari server. return true bila ada perubahan. */
P.applyServerGate = function (g) {
  let pf = P.proFeaturesDefault, hf = {};
  if (g && typeof g === 'object' && !Array.isArray(g)) {
    pf = {};
    for (const k in g) {
      const v = g[k];
      const obj = (v && typeof v === 'object' && !Array.isArray(v)) ? v : null;
      const lock = obj ? (obj.lock === true) : (v === true);
      const hide = obj ? (obj.hide === true) : false;
      if (lock) pf[k] = P.proFeaturesDefault[k] || { label: k };
      if (hide) hf[k] = true;
    }
  }
  const sebelum = Object.keys(P.proFeatures).sort().join('|') + '#' + Object.keys(P.hiddenFeatures || {}).sort().join('|');
  P.proFeatures = pf; CFG.proFeatures = pf; P.hiddenFeatures = hf;
  P.simpanGateCache((g && typeof g === 'object' && !Array.isArray(g)) ? g : null);
  return sebelum !== Object.keys(pf).sort().join('|') + '#' + Object.keys(hf).sort().join('|');
};
P.isHidden = f => !!(P.hiddenFeatures && P.hiddenFeatures[f]);
/* Sembunyikan menu/tab/kontrol yang saklar hide-nya ON (class .f-hidden). */
P.renderHiddenFeatures = function () {
  const sembunyi = (el, f) => { if (el) el.classList.toggle('f-hidden', P.isHidden(f)); };
  document.querySelectorAll('.nav-item[data-view]').forEach(n => sembunyi(n, n.getAttribute('data-view')));
  document.querySelectorAll('#moreSheet .sheet-item[data-f]').forEach(n => sembunyi(n, n.getAttribute('data-f')));
  document.querySelectorAll('#view-kas .tab[data-k]').forEach(n => sembunyi(n, 'kas.' + n.getAttribute('data-k')));
  document.querySelectorAll('#view-laporan .tab[data-r]').forEach(n => sembunyi(n, 'laporan.' + n.getAttribute('data-r')));
  sembunyi(document.getElementById('lapDateNav'), 'laporan.mingguan.nav');
};
P.licenseAktif = function () {
  try {
    if (!P.isLicensed()) return false;
    const l = (typeof Akun !== 'undefined' && Akun.lisensi) ? Akun.lisensi() : null;
    const exp = l && l.license_expires_at ? Date.parse(l.license_expires_at) : 0;
    if (exp && Date.now() > exp) return false; /* langganan sudah kedaluwarsa → terkunci */
    return true;
  } catch (e) { return false; }
};
P.isPro = f => !!(P.proFeatures[f] && !P.licenseAktif());
/* true bila ada kunci apa pun untuk halaman/fitur bernama `f` (mis. "laporan" kena oleh
   "laporan.bulanan" juga) — dipakai untuk badge 🔒 pada tab/menu. */
P.isProAny = f => {
  if (!P.licenseAktif()) {
    for (const k in P.proFeatures) { if (k === f || k.indexOf(f + '.') === 0) return true; }
  }
  return false;
};
P.requireFeature = function (f, label) {
  if (!P.isPro(f)) return true;
  const meta = P.proFeatures[f] || {};
  P.featureLockModal(label || meta.label || f);
  return false;
};
P.featureLockModal = function (label) {
  openModal(`
    <div class="modal-head"><h2>🔒 Butuh Lisensi</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="pf-lock"><div class="big">🔒</div></div>
    <p class="muted" style="line-height:1.6">Fitur <b>${esc(label)}</b> ini termasuk <b>Lisensi</b>. Semua data kamu tetap bisa dilihat, dan fitur lain tetap bisa dipakai seperti biasa.</p>
    <div class="btn-row" style="margin-top:14px;">
      <button class="btn btn-secondary" onclick="closeModal()">Tutup</button>
      <button class="btn btn-primary" onclick="closeModal();Platform.openLicense()">Lihat Lisensi</button>
    </div>`);
};
/* Label kedaluwarsa untuk modal lisensi (berguna saat skema langganan dipakai). */
P.licenseExpiryLabel = function () {
  try {
    const l = (typeof Akun !== 'undefined' && Akun.lisensi) ? Akun.lisensi() : null;
    const exp = l && l.license_expires_at ? Date.parse(l.license_expires_at) : 0;
    return exp ? ' · aktif sampai ' + new Date(exp).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  } catch (e) { return ''; }
};
/* Teks status kuota; quota <= 0 berarti tanpa kuota (mode gate fitur). */
P.quotaInfo = () => CFG.quota > 0
  ? `${P.used()}/${CFG.quota} ${CFG.unit} terpakai bulan ini · reset tanggal 1`
  : 'tanpa batas kuota';
/* Badge 🔒 pada tab bawah & item sheet "Lainnya" yang fiturnya terkunci. */
P.renderGateBadges = function () {
  const pasang = (n, f) => {
    let b = n.querySelector('.gate-lock');
    if (P.isProAny(f)) { if (!b) { b = document.createElement('span'); b.className = 'gate-lock'; b.textContent = '🔒'; b.setAttribute('aria-hidden', 'true'); n.appendChild(b); } }
    else if (b) b.remove();
  };
  document.querySelectorAll('.nav-item[data-view]').forEach(n => pasang(n, n.getAttribute('data-view')));
  document.querySelectorAll('#moreSheet .sheet-item[data-f]').forEach(n => pasang(n, n.getAttribute('data-f')));
  /* Tab di dalam halaman Kas (Pinjaman / Zakat) — kunci bernama "kas.<tab>". */
  document.querySelectorAll('#view-kas .tab[data-k]').forEach(n => pasang(n, 'kas.' + n.getAttribute('data-k')));
  try { P.renderHiddenFeatures(); } catch (e) { /* abaikan */ }
};
function usage() {
  let u = null; try { u = JSON.parse(LS.get(K.use) || 'null'); } catch (e) { }
  if (!u || u.month !== ymNow()) u = { month: ymNow(), count: 0 };
  return u;
}
P.used = () => usage().count;
P.remaining = () => Math.max(0, CFG.quota - usage().count);
P.hit = function () {
  const u = usage(); u.count++; LS.set(K.use, JSON.stringify(u));
  P.refresh();
  if (!P.isLicensed()) {
    const r = P.remaining();
    if (r === 0) toastMsg('Kuota gratis bulan ini habis');
    else if (r <= 5) toastMsg('Sisa kuota gratis: ' + r + ' ' + CFG.unit);
  }
};
P.guard = function (o) {
  o = o || {};
  if (o.feature && !P.requireFeature(o.feature, o.featureLabel)) return false;
  if (!o.noQuota && CFG.quota > 0 && !P.licenseAktif() && usage().count >= CFG.quota) { quotaBlock(); return false; }
  if (o.needKas && kasOn() && !st().shift) { P.openKasOpen(true); return false; }
  return true;
};

/* ---------- tombol akun aktif di header (v1.5.4 → v1.5.5) ----------
   Chip kuota dihapus dari header; status lisensi & sisa kuota pindah ke
   modal "Akun Saya" (Platform.openAkun). v1.5.5: header hanya menampilkan
   foto profil (bulat). Kalau belum ada foto → siluet default. */
function renderAkunChip() {
  const chip = $('akunChip'); if (!chip) return;
  let akun = null;
  try { akun = (typeof Akun !== 'undefined' && Akun.info()) || null; } catch (e) { akun = null; }
  if (!akun) { chip.classList.add('hidden'); return; }
  chip.classList.remove('hidden');
  const nama = String(akun.nama || '').trim();
  const waLengkap = '0' + String(akun.wa || '').slice(2);
  /* Foto profil (bucket `avatars`) — URL disimpan di sesi lokal oleh Akun.muatProfil. */
  const foto = String(akun.avatar || '').trim();
  const av = $('akunAv'), img = $('akunAvImg');
  if (img) {
    if (foto) {
      if (img.getAttribute('src') !== foto) img.src = foto;
      img.hidden = false;
    } else {
      img.removeAttribute('src');
      img.hidden = true;
    }
  }
  if (av) av.classList.toggle('has-foto', !!foto);
  /* Nama & WA pindah ke label aksesibel (tombolnya sendiri cuma foto). */
  const label = 'Akun aktif: ' + (nama || 'Akun') + ' (' + waLengkap + ')';
  chip.setAttribute('aria-label', label);
  chip.setAttribute('title', label);
}
window.addEventListener('resize', () => { try { renderAkunChip(); } catch (e) { /* abaikan */ } });
P.refresh = function () { renderAkunChip(); try { P.renderGateBadges(); } catch (e) { /* abaikan */ } };

function quotaBlock() {
  openModal(`
    <div class="modal-head"><h2>🔒 Kuota Gratis Habis</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="pf-lock"><div class="big">🔒</div></div>
    <p class="muted" style="line-height:1.6">Kuota gratis <b>${CFG.quota} ${CFG.unit}</b> bulan ini sudah terpakai. Kamu tetap bisa membuka aplikasi dan melihat semua data. Pencatatan baru terbuka lagi <b>tanggal 1 bulan depan</b>, atau buka lebih awal dengan lisensi.</p>
    <div class="btn-row" style="margin-top:14px;">
      <button class="btn btn-secondary" onclick="closeModal()">Tutup</button>
      <button class="btn btn-primary" onclick="Platform.openLicense()">Lihat Lisensi</button>
    </div>`);
}

P.openLicense = function (reval = true) {
  const lic = P.isLicensed(), dev = devFmt(deviceId());
  const akun = (typeof Akun !== 'undefined' && Akun.info()) || null;
  openModal(`
    <div class="modal-head" data-lic><h2>💳 Lisensi</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    ${lic
      ? `<div class="pf-ok">✅ Lisensi akun aktif — pencatatan ${CFG.unit} tanpa batas kuota${P.licenseExpiryLabel()}.</div>`
      : `<div class="pf-warn">Versi gratis: ${P.quotaInfo()}.</div>`}
    <label>Akun</label>
    <div class="pf-device" style="letter-spacing:0;font-size:15px;">${akun ? esc((akun.nama ? akun.nama + ' · ' : '') + '+' + akun.wa) : 'Belum masuk'}</div>
    <button class="btn btn-secondary btn-sm" style="width:100%;margin-top:8px;" onclick="Platform.copyDev()">📋 Salin ID Perangkat</button>
    ${lic ? '' : `
    <hr class="sep">
    <p class="muted" style="line-height:1.6;text-align:left;">Lisensi mengikuti <b>akun</b>, bukan perangkat. Setelah pembayaran dikonfirmasi, lisensi langsung aktif di akun ini — cukup buka ulang aplikasi.</p>
    <div class="btn-row" style="margin-top:12px;"><button class="btn btn-primary" onclick="Platform.buyWA()">💬 Beli Lisensi via WhatsApp</button></div>`}
    <div class="pf-note">Masuk sebagai <b>${akun ? esc((akun.nama ? akun.nama + ' · ' : '') + '+' + akun.wa) : '—'}</b> · ID Perangkat: <b>${dev}</b> (dipakai server untuk membatasi jumlah perangkat aktif).</div>`);
  // Validasi ulang ke server (lisensi bisa saja baru terbit / dicabut).
  if (reval && typeof Akun !== 'undefined') {
    Akun.muatLisensi().then(() => {
      P.refresh();
      const box = $('modalBox');
      if ($('modalBackdrop').classList.contains('open') && box && box.innerHTML.indexOf('data-lic') >= 0) P.openLicense(false);
    });
  }
};

/* ---------- modal "Akun Saya" (v1.5.4) ---------- */
P.openAkun = function () {
  let akun = null;
  try { akun = (typeof Akun !== 'undefined' && Akun.info()) || null; } catch (e) { akun = null; }
  if (!akun) { if (window.Gerbang) window.Gerbang.tampilkan(); return; }
  const nama = String(akun.nama || '').trim();
  const waTampil = '0' + String(akun.wa || '').slice(2);
  const lic = P.isLicensed();
  openModal(`
    <div class="modal-head"><h2>👤 Akun Saya</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="pf-device" style="letter-spacing:0;font-size:15px;">${esc(nama || 'Akun')}</div>
    <p class="muted" style="margin:6px 0 0;text-align:left;">No. WhatsApp: ${esc(waTampil)}</p>
    ${lic
      ? `<div class="pf-ok" style="margin-top:12px;">✅ Lisensi akun aktif — pencatatan tanpa batas kuota${P.licenseExpiryLabel()}.</div>`
      : `<div class="pf-warn" style="margin-top:12px;">Mode gratis: ${P.quotaInfo()}.</div>`}
    <div class="btn-row" style="margin-top:14px;white-space:nowrap;">
      <button class="btn btn-secondary" onclick="closeModal();Platform.openLicense()">💳 Lihat Lisensi</button>
      <button class="btn btn-primary" onclick="Gerbang.keluarKonfirm()">🚪 Keluar</button>
    </div>`);
};
P.copyDev = function () {
  const d = devFmt(deviceId());
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(d).then(() => toastMsg('ID Perangkat disalin'), () => toastMsg(d));
  else toastMsg(d);
};
P.buyWA = function () {
  const nama = (DB.settings && (DB.settings.namaToko || DB.settings.namaMasjid || DB.settings.namaPondok)) || '';
  const akun = (typeof Akun !== 'undefined' && Akun.info()) || null;
  const msg = 'Halo Admin Kasir Solo, saya ingin membeli lisensi *' + CFG.name + '*.\nAkun: ' + (akun ? '+' + akun.wa : '-') + (nama ? '\nNama usaha: ' + nama : '') + '\nID Perangkat: ' + devFmt(deviceId()) + '\nMohon info pembayarannya.';
  window.open('https://wa.me/' + CFG.wa + '?text=' + encodeURIComponent(msg), '_blank');
};

/* stub kompatibilitas untuk kode lama */
window.isLicensed = () => P.isLicensed();
window.licenseInfoText = () => P.licenseAktif() ? 'Lisensi akun aktif — tanpa batas kuota' + P.licenseExpiryLabel() + '.'
  : 'Versi gratis: ' + P.quotaInfo() + '.';
window.openLicenseSheet = () => P.openLicense();
window.closeLicenseSheet = () => { };
window.updateTrialUI = () => P.refresh();

/* ---------- kas ---------- */
const kasOn = () => !!(A.hasKas && st().settings.kas);
function cashStats(from, to) {
  const ci = A.cashIn(from, to); let kT = 0, mT = 0;
  st().cashflow.forEach(c => { if (c.sumber === 'Tunai' && inWin(c.tanggal, from, to)) { if (c.tipe === 'keluar') kT += c.jumlah; else mT += c.jumlah; } });
  const modal = st().shift ? st().shift.modal : 0;
  return { ci, kT, mT, modal, sistem: modal + ci.tunai + mT - kT };
}
P.openKasOpen = function (blocked) {
  openModal(`
    <div class="modal-head"><h2>🔓 Buka Kas</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    ${blocked ? '<div class="pf-warn">Kas belum dibuka. Buka kas dulu sebelum mencatat transaksi.</div>' : ''}
    <label>Modal Awal di Laci (Rp)</label>
    <input type="number" id="pfModal" inputmode="numeric" placeholder="0">
    <p class="muted" style="margin-top:8px;">Hitung uang tunai yang ada di laci sekarang, lalu masukkan sebagai modal awal. Ketik <b>0</b> kalau laci memang kosong.</p>
    <div class="btn-row" style="margin-top:14px;"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="Platform.doKasOpen()">🔓 Buka Kas</button></div>`);
};
P.doKasOpen = function () {
  const raw = $('pfModal').value;
  if (raw === '' || Number(raw) < 0) { toastMsg('Isi modal awal (0 jika kosong)'); return; }
  st().shift = { start: new Date().toISOString(), modal: Number(raw) };
  saveDB(); closeModal(); toastMsg('Kas dibuka — silakan lanjutkan transaksi'); renderDashboard();
};
P.openKasClose = function () {
  const sh = st().shift; if (!sh) { P.openKasOpen(); return; }
  const s = cashStats(new Date(sh.start).getTime(), Date.now());
  openModal(`
    <div class="modal-head"><h2>🔒 Tutup Kas</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="total-row"><span>Kas dibuka</span><span>${fmtD(sh.start)}</span></div>
    <div class="total-row"><span>Jumlah transaksi</span><span>${s.ci.count}</span></div>
    <hr class="sep">
    <div class="total-row"><span>Modal awal di laci</span><span>${rp(s.modal)}</span></div>
    <div class="total-row"><span>${esc(A.cashInLabel || 'Penjualan tunai')}</span><span>${rp(s.ci.tunai)}</span></div>
    <div class="total-row"><span>Pemasukan tunai</span><span>${rp(s.mT)}</span></div>
    <div class="total-row"><span>Pengeluaran tunai</span><span>- ${rp(s.kT)}</span></div>
    <div class="total-row big"><span>Kas sistem (perkiraan)</span><span id="pfSis">${rp(s.sistem)}</span></div>
    <div class="pf-note">📱 Non-tunai (QRIS/Transfer/Debit) di luar laci: <b>${rp(s.ci.nonTunai)}</b>. Hanya <b>Kas sistem</b> yang dibandingkan dengan hitungan fisik.</div>
    <label>Uang tunai fisik di laci (hitung manual)</label>
    <input type="number" id="pfFis" inputmode="numeric" placeholder="0" oninput="Platform.kasDiff(${s.sistem})">
    <div class="total-row" style="margin-top:6px;"><span>Selisih (fisik − sistem)</span><b id="pfSel">—</b></div>
    <label>Catatan (opsional)</label><textarea id="pfCat" placeholder="cth: kembalian kurang Rp2.000"></textarea>
    <div class="btn-row" style="margin-top:14px;"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="Platform.doKasClose()">🔒 Tutup Kas</button></div>`);
};
P.kasDiff = function (sis) {
  const raw = $('pfFis').value, el = $('pfSel');
  if (raw === '') { el.textContent = '—'; el.style.color = ''; return; }
  const d = Number(raw) - sis;
  el.textContent = (d > 0 ? '+' : '') + rp(d) + (d === 0 ? ' ✓ pas' : '');
  el.style.color = d === 0 ? 'var(--success)' : 'var(--danger)';
};
P.doKasClose = function () {
  const sh = st().shift; if (!sh) return;
  const raw = $('pfFis').value;
  if (raw === '') { toastMsg('Isi uang fisik di laci'); return; }
  const s = cashStats(new Date(sh.start).getTime(), Date.now());
  st().shiftLog.push({
    start: sh.start, end: new Date().toISOString(), modal: s.modal, tunaiJual: s.ci.tunai, nonTunai: s.ci.nonTunai, count: s.ci.count,
    masuk: s.mT, keluar: s.kT, sistem: s.sistem, fisik: Number(raw), selisih: Number(raw) - s.sistem, catatan: $('pfCat').value.trim()
  });
  st().shift = null; saveDB(); closeModal();
  toastMsg('Kas ditutup. Selisih ' + rp(Number(raw) - s.sistem)); renderDashboard();
};

/* opname kas (untuk masjid: hitung uang tunai di brankas) */
function saldoTunai() {
  return DB.kas.reduce((a, k) => a + ((k.sumber || 'Tunai') === 'Tunai' ? (k.tipe === 'masuk' ? k.jumlah : -k.jumlah) : 0), 0);
}
P.openOpname = function () {
  const sis = saldoTunai(), last = st().opnameLog.slice(-1)[0];
  openModal(`
    <div class="modal-head"><h2>🧮 Opname Kas</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <p class="muted" style="line-height:1.55">Cocokkan uang tunai fisik di brankas/kotak dengan catatan aplikasi. Hanya transaksi bersumber <b>Tunai</b> yang dihitung.</p>
    <div class="total-row big"><span>Saldo tunai (catatan)</span><span>${rp(sis)}</span></div>
    ${last ? `<div class="muted" style="margin-top:6px;">Opname terakhir: ${fmtD(last.tanggal)} · selisih ${rp(last.selisih)}</div>` : ''}
    <label>Uang tunai fisik (hitung manual)</label>
    <input type="number" id="pfFis" inputmode="numeric" placeholder="0" oninput="Platform.kasDiff(${sis})">
    <div class="total-row" style="margin-top:6px;"><span>Selisih (fisik − catatan)</span><b id="pfSel">—</b></div>
    <label>Catatan (opsional)</label><textarea id="pfCat" placeholder="cth: dihitung bersama bendahara"></textarea>
    <label style="display:flex;gap:8px;align-items:center;font-weight:600;"><input type="checkbox" id="pfAdj" style="width:auto;"> Catat selisih sebagai penyesuaian kas</label>
    <div class="btn-row" style="margin-top:14px;"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="Platform.doOpname(${sis})">Simpan Opname</button></div>`);
};
P.doOpname = function (sis) {
  const raw = $('pfFis').value; if (raw === '') { toastMsg('Isi uang fisik'); return; }
  const fis = Number(raw), sel = fis - sis;
  st().opnameLog.push({ id: uid(), tanggal: new Date().toISOString(), sistem: sis, fisik: fis, selisih: sel, catatan: $('pfCat').value.trim() });
  if ($('pfAdj').checked && sel !== 0) {
    DB.kas.push({ id: uid(), tanggal: new Date().toISOString(), tipe: sel > 0 ? 'masuk' : 'keluar', kategori: 'Lainnya', jumlah: Math.abs(sel), keterangan: 'Penyesuaian opname kas', sumber: 'Tunai' });
  }
  saveDB(); closeModal(); toastMsg('Opname tersimpan. Selisih ' + rp(sel));
  if (typeof renderView === 'function') renderView(navStack[navStack.length - 1]);
};

/* ---------- pengeluaran & pemasukan ---------- */
let kfTab = 'semua';
const inc = () => st().cashflow;
function monthWin() { const n = new Date(); return [new Date(n.getFullYear(), n.getMonth(), 1).getTime(), Date.now()]; }
function cfSum(f, t) {
  let keluar = 0, masuk = 0, nlK = 0, nlM = 0;
  st().cashflow.forEach(c => { if (!inWin(c.tanggal, f, t)) return;
    if (c.tipe === 'keluar') { c.nonLaba ? nlK += c.jumlah : keluar += c.jumlah; } else { c.nonLaba ? nlM += c.jumlah : masuk += c.jumlah; } });
  return { keluar, masuk, nlK, nlM };
}
P.setKfTab = t => { kfTab = t; P.renderKeuangan(); };
P.renderKeuangan = function () {
  const v = $('view-keuangan'); if (!v) return;
  const [f, t] = monthWin(), s = cfSum(f, t);
  let list = st().cashflow.slice().sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  if (kfTab !== 'semua') list = list.filter(c => c.tipe === kfTab);
  v.innerHTML = `
    <div class="stat-grid" style="margin-bottom:12px;">
      <div class="stat-card red"><div class="lbl">Pengeluaran Bulan Ini</div><div class="val">${rp(s.keluar)}</div></div>
      <div class="stat-card green"><div class="lbl">Pemasukan Lain Bulan Ini</div><div class="val">${rp(s.masuk)}</div></div>
    </div>
    <div class="btn-row" style="margin-bottom:14px;">
      <button class="btn btn-secondary" style="background:var(--danger-bg);color:var(--danger);border-color:transparent;" onclick="Platform.openCfForm('keluar')">➖ Pengeluaran</button>
      <button class="btn btn-secondary" style="background:var(--success-bg);color:var(--success);border-color:transparent;" onclick="Platform.openCfForm('masuk')">➕ Pemasukan</button>
    </div>
    <div class="tabs" role="tablist">
      ${[['semua', 'Semua'], ['keluar', 'Pengeluaran'], ['masuk', 'Pemasukan']].map(x => `<button type="button" class="tab ${kfTab === x[0] ? 'active' : ''}" onclick="Platform.setKfTab('${x[0]}')">${x[1]}</button>`).join('')}
    </div>
    <div class="card">${list.length ? list.map(c => `
      <button type="button" class="list-item" style="cursor:pointer;" onclick="Platform.openCfDetail('${c.id}')">
        <div class="avatar" style="background:${c.tipe === 'masuk' ? 'var(--success-bg)' : 'var(--danger-bg)'};">${c.tipe === 'masuk' ? '💰' : '🧾'}</div>
        <div class="meta"><div class="t">${esc(c.kategori)}</div><div class="s">${esc(c.ket || '')}${c.ket ? ' · ' : ''}${esc(c.sumber)}${c.nonLaba ? ' · di luar ' + esc(NETW) : ''}</div></div>
        <div class="right"><div class="amt" style="color:${c.tipe === 'masuk' ? 'var(--success)' : 'var(--danger)'};">${c.tipe === 'masuk' ? '+' : '-'}${rp(c.jumlah)}</div><div class="s">${fmtShort(c.tanggal)}</div></div>
      </button>`).join('') : '<div class="empty"><div class="ic">🧾</div><div class="t">Belum ada catatan</div><div class="s">Catat biaya operasional & pemasukan di luar penjualan</div></div>'}</div>`;
};
P.openCfForm = function (tipe) {
  const cats = tipe === 'keluar' ? A.expCats : A.incCats;
  openModal(`
    <div class="modal-head"><h2>${tipe === 'keluar' ? '🧾 Catat Pengeluaran' : '💰 Catat Pemasukan'}</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="pf-seg"><button class="${tipe === 'keluar' ? 'on' : ''}" onclick="Platform.openCfForm('keluar')">Pengeluaran</button><button class="${tipe === 'masuk' ? 'on' : ''}" onclick="Platform.openCfForm('masuk')">Pemasukan</button></div>
    <input type="hidden" id="cfTipe" value="${tipe}">
    <label>${tipe === 'keluar' ? 'Jenis Pengeluaran' : 'Jenis Pemasukan'}</label>
    <select id="cfKat" onchange="Platform.cfKatChange()">${cats.map(c => `<option value="${esc(c[0])}" data-nl="${c[1]}">${esc(c[0])}</option>`).join('')}</select>
    <div id="cfNl" class="pf-note" style="display:none;margin-top:8px;">Kategori ini <b>tidak memengaruhi ${esc(NETW)}</b> — ini ${esc(A.nonNetNote || 'uang pemilik/stok, bukan biaya atau hasil jualan')}.</div>
    <label>Tanggal Catatan</label>
    <input type="date" id="cfTgl" value="${dayOf()}" max="${dayOf()}">
    <p class="muted" style="margin-top:4px;">Boleh mundur untuk mencatat yang ketinggalan. Tanggal menentukan laporan hari apa catatan ini masuk.</p>
    <label>Jumlah Uang (Rp)</label><input type="number" id="cfJml" inputmode="numeric" placeholder="0">
    <label>${tipe === 'keluar' ? 'Ambil dari?' : 'Masuk ke?'}</label>
    <div class="pay-methods" id="cfSrc">${[['Tunai', '💵 Tunai (laci)'], ['QRIS', '📱 QRIS'], ['Transfer', '🏦 Transfer']].map((x, i) => `<button type="button" class="pay-chip ${i === 0 ? 'active' : ''}" data-v="${x[0]}" onclick="Platform.pickSrc(this)">${x[1]}</button>`).join('')}</div>
    <p class="muted" style="margin-top:6px;">Hanya <b>Tunai</b> yang memengaruhi uang laci saat tutup kas.</p>
    <label>Keterangan (opsional)</label><textarea id="cfKet" placeholder="cth: bayar listrik bulan ini"></textarea>
    <div class="btn-row" style="margin-top:14px;"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="Platform.saveCf()">💾 Simpan</button></div>`);
  P.cfKatChange();
};
P.cfKatChange = function () {
  const sel = $('cfKat'); if (!sel) return;
  $('cfNl').style.display = sel.options[sel.selectedIndex].dataset.nl === '1' ? 'block' : 'none';
};
P.pickSrc = el => { document.querySelectorAll('#cfSrc .pay-chip').forEach(e => e.classList.remove('active')); el.classList.add('active'); };
P.saveCf = function () {
  const tipe = $('cfTipe').value, jml = Number($('cfJml').value) || 0;
  if (jml <= 0) { toastMsg('Jumlah harus lebih dari 0'); return; }
  const tgl = $('cfTgl').value || dayOf();
  if (tgl > dayOf()) { toastMsg('Tanggal tidak boleh di masa depan'); return; }
  const sel = $('cfKat'), opt = sel.options[sel.selectedIndex];
  const now = new Date();
  // hari ini → waktu persis (agar masuk shift kas yang sedang berjalan); tanggal mundur → jam sekarang di tanggal itu
  const at = tgl === dayOf() ? now.toISOString() : new Date(tgl + 'T' + pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds())).toISOString();
  st().cashflow.push({ id: uid(), tipe, kategori: sel.value, nonLaba: opt.dataset.nl === '1', jumlah: jml,
    sumber: document.querySelector('#cfSrc .pay-chip.active').dataset.v, tanggal: at, ket: $('cfKet').value.trim() });
  saveDB(); closeModal(); toastMsg('Catatan tersimpan');
  if (typeof renderView === 'function') renderView(navStack[navStack.length - 1]);
};
P.openCfDetail = function (id) {
  const c = st().cashflow.find(x => x.id === id); if (!c) return;
  openModal(`
    <div class="modal-head"><h2>Detail Catatan</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="total-row"><span>Tipe</span><span>${c.tipe === 'masuk' ? 'Pemasukan' : 'Pengeluaran'}</span></div>
    <div class="total-row"><span>Jenis</span><span>${esc(c.kategori)}</span></div>
    <div class="total-row"><span>Tanggal</span><span>${fmtD(c.tanggal)}</span></div>
    <div class="total-row"><span>${c.tipe === 'keluar' ? 'Diambil dari' : 'Masuk ke'}</span><span>${esc(c.sumber)}</span></div>
    ${c.nonLaba ? '<div class="total-row"><span>' + esc(NETW.charAt(0).toUpperCase() + NETW.slice(1)) + '</span><span>Tidak dihitung</span></div>' : ''}
    <div class="total-row big"><span>Jumlah</span><span>${rp(c.jumlah)}</span></div>
    ${c.ket ? `<hr class="sep"><p class="muted">${esc(c.ket)}</p>` : ''}
    <div class="btn-row" style="margin-top:14px;"><button class="btn btn-danger" onclick="Platform.askDelCf('${c.id}')">🗑️ Hapus</button></div>`);
};
P.askDelCf = function (id) {
  openModal(`<div class="pf-lock"><div class="big">⚠️</div><h2 style="margin:4px 0 6px;">Yakin?</h2><p class="muted">Catatan ini akan dihapus permanen.</p></div>
    <div class="btn-row" style="margin-top:14px;"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-danger" onclick="Platform.delCf('${id}')">Ya, Hapus</button></div>`);
};
P.delCf = function (id) {
  st().cashflow = st().cashflow.filter(x => x.id !== id); saveDB(); closeModal(); toastMsg('Catatan dihapus');
  if (typeof renderView === 'function') renderView(navStack[navStack.length - 1]);
};

/* ---------- ekstra dashboard / laporan ---------- */
function ensureBox(viewId, boxId, afterSel, where) {
  const v = $(viewId); if (!v) return null;
  let b = $(boxId);
  if (!b) { b = document.createElement('div'); b.id = boxId; const ref = afterSel ? v.querySelector(afterSel) : null;
    if (ref && where !== 'end') ref.insertAdjacentElement('afterend', b); else v.appendChild(b); }
  return b;
}
const startOfDay = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime(); };
P.dashExtras = function () {
  if (A.mode === 'masjid') {
    const b = ensureBox('view-dashboard', 'pfDash', '.quick-grid'); if (!b) return;
    const all = DB.kas, sum = s => all.reduce((a, k) => a + (kasDihitung(k) && (k.sumber || 'Tunai') === s ? (k.tipe === 'masuk' ? k.jumlah : -k.jumlah) : 0), 0);
    const tunai = sum('Tunai'), rek = sum('Rekening Bank'), qr = sum('QRIS / Dompet Digital');
    b.innerHTML = `<div class="card" style="margin-top:10px;">
      <div class="total-row"><span>💵 Tunai (brankas)</span><b>${rp(tunai)}</b></div>
      <div class="total-row"><span>🏦 Rekening bank</span><b>${rp(rek)}</b></div>
      <div class="total-row"><span>📱 QRIS / dompet digital</span><b>${rp(qr)}</b></div></div>`;
    return;
  }
  const b = ensureBox('view-dashboard', 'pfDash', '.quick-grid'); if (!b) return;
  const f = startOfDay(), t = Date.now(), s = cfSum(f, t), gp = A.gross(f, t), lb = gp - s.keluar + s.masuk;
  let kas = '';
  if (kasOn()) {
    const sh = st().shift;
    kas = sh
      ? `<div class="card pf-kas open" style="margin-top:10px;"><div class="st"><b>🔓 Kas Terbuka</b><span>Sejak ${fmtShort(sh.start)} · modal ${rp(sh.modal)}</span></div><button class="btn btn-secondary btn-sm" onclick="Platform.openKasClose()">Tutup Kas</button></div>`
      : `<div class="card pf-kas closed" style="margin-top:10px;"><div class="st"><b>🔒 Kas Belum Dibuka</b><span>Buka kas untuk mulai mencatat transaksi</span></div><button class="btn btn-primary btn-sm" onclick="Platform.openKasOpen()">Buka Kas</button></div>`;
  }
  b.innerHTML = kas + `
    <div class="stat-grid half" style="margin-top:10px;">
      <div class="stat-card red"><div class="lbl">🧾 Pengeluaran Hari Ini</div><div class="val">${rp(s.keluar)}</div></div>
      <div class="stat-card ${lb >= 0 ? 'green' : 'red'}"><div class="lbl">📈 ${esc(NET)} Hari Ini</div><div class="val">${rp(lb)}</div></div>
    </div>
    <div class="btn-row" style="margin-top:10px;">
      <button class="btn btn-secondary btn-sm" onclick="Platform.openCfForm('keluar')">➖ Catat Pengeluaran</button>
      <button class="btn btn-secondary btn-sm" onclick="Platform.openCfForm('masuk')">➕ Catat Pemasukan</button>
    </div>`;
};
P.lapExtras = function () {
  const b = ensureBox('view-laporan', 'pfLap', '.stat-grid'); if (!b) return;
  const [fs, ts] = lapBounds(), f = new Date(fs + 'T00:00:00').getTime(), t = new Date(ts + 'T23:59:59.999').getTime();
  if (A.mode === 'masjid') {
    const kas = DB.kas.filter(k => inWin(k.tanggal, f, t));
    const by = s => kas.reduce((a, k) => a + (kasDihitung(k) && (k.sumber || 'Tunai') === s ? (k.tipe === 'masuk' ? k.jumlah : -k.jumlah) : 0), 0);
    const last = st().opnameLog.slice(-1)[0];
    b.innerHTML = `<div class="section-title" style="margin-top:10px;">Perubahan Kas per Sumber Dana</div><div class="card">
      <div class="total-row"><span>💵 Tunai</span><span>${rp(by('Tunai'))}</span></div>
      <div class="total-row"><span>🏦 Rekening bank</span><span>${rp(by('Rekening Bank'))}</span></div>
      <div class="total-row"><span>📱 QRIS / dompet digital</span><span>${rp(by('QRIS / Dompet Digital'))}</span></div>
      ${last ? `<hr class="sep"><div class="muted">Opname terakhir ${fmtD(last.tanggal)}: fisik ${rp(last.fisik)}, selisih ${rp(last.selisih)}</div>` : ''}</div>`;
    return;
  }
  const s = cfSum(f, t), gp = A.gross(f, t), lb = gp - s.keluar + s.masuk;
  b.innerHTML = `<div class="section-title" style="margin-top:10px;">${esc(NET)}</div><div class="card">
    <div class="total-row"><span>${esc(A.grossLabel)}</span><span>${rp(gp)}</span></div>
    <div class="total-row"><span>Pengeluaran operasional</span><span>- ${rp(s.keluar)}</span></div>
    <div class="total-row"><span>Pemasukan lain</span><span>+ ${rp(s.masuk)}</span></div>
    <div class="total-row big"><span>${esc(NET)}</span><span style="color:${lb >= 0 ? 'var(--success)' : 'var(--danger)'};">${rp(lb)}</span></div>
    ${(s.nlK || s.nlM) ? `<div class="pf-note">Tidak dihitung ke ${esc(NETW)}: keluar ${rp(s.nlK)} (kulakan/setor/prive) · masuk ${rp(s.nlM)} (modal tambahan).</div>` : ''}</div>`;
  if (A.afterLaporan) A.afterLaporan(f, t);
};

/* ---------- nota & printer ---------- */
const clean = s => String(s == null ? '' : s).replace(/[—–]/g, '-').replace(/[·•]/g, '|').replace(/×/g, 'x').replace(/✓/g, '').normalize('NFKD').replace(/[^\x20-\x7E]/g, '');
function wrapTxt(s, w) { const out = []; s = clean(s); while (s.length > w) { let i = s.lastIndexOf(' ', w); if (i <= 0) i = w; out.push(s.slice(0, i)); s = s.slice(i).trim(); } out.push(s); return out; }
P.rowsToText = function (rows, W) {
  W = W || 32; const L = [];
  rows.forEach(r => {
    if (r.t === 'hr') L.push('-'.repeat(W));
    else if (r.t === 'c') wrapTxt(r.s, W).forEach(x => L.push(' '.repeat(Math.max(0, Math.floor((W - x.length) / 2))) + x));
    else if (r.t === 'lr') { const l = clean(r.l), rr = clean(r.r);
      if (l.length + rr.length + 1 <= W) L.push(l + ' '.repeat(W - l.length - rr.length) + rr);
      else { wrapTxt(l, W).forEach(x => L.push(x)); L.push(' '.repeat(Math.max(0, W - rr.length)) + rr); } }
    else if (r.t === 'p') wrapTxt(r.s, W).forEach(x => L.push(x));
    else if (r.t === 'n') L.push('');
  });
  return L.join('\n');
};
function head() {
  const nm = A.storeName(), rows = [{ t: 'c', s: nm.toUpperCase() }];
  const al = DB.settings && DB.settings.alamat, wa = DB.settings && DB.settings.wa;
  if (al) rows.push({ t: 'c', s: al }); if (wa) rows.push({ t: 'c', s: 'WA ' + wa });
  rows.push({ t: 'hr' }); return rows;
}
P.buildReceipt = (kind, rec) => P.rowsToText(head().concat(A.receipt(kind, rec, { rp, fmtD })).concat([{ t: 'hr' }, { t: 'c', s: 'Dicetak dengan Kasir Solo' }, { t: 'n' }]));
let bt = { dev: null, ch: null };
const BT_SERVICES = ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', '49535343-fe7d-4ae5-8fa9-9fafd205e455', '0000ff00-0000-1000-8000-00805f9b34fb'];
function browserPrint(text) {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(f);
  const d = f.contentWindow.document; d.open();
  d.write('<!doctype html><html><head><meta charset="utf-8"><style>@page{size:58mm auto;margin:2mm}body{margin:0;font:11px/1.35 "Courier New",monospace}pre{margin:0;white-space:pre-wrap}</style></head><body><pre>' + esc(text) + '</pre></body></html>');
  d.close();
  setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { toastMsg('Gagal membuka dialog cetak'); } setTimeout(() => f.remove(), 3000); }, 250);
}
async function btSend(text) {
  const data = new Uint8Array([0x1B, 0x40, ...new TextEncoder().encode(text + '\n\n\n\n')]);
  for (let i = 0; i < data.length; i += 20) {
    const c = data.slice(i, i + 20);
    if (bt.ch.writeValueWithoutResponse) await bt.ch.writeValueWithoutResponse(c); else await bt.ch.writeValue(c);
    await sleep(20);
  }
}
P.print = async function (text) {
  if (bt.ch) { try { await btSend(text); toastMsg('Nota dikirim ke printer'); return; } catch (e) { toastMsg('Printer gagal, memakai cetak browser'); } }
  browserPrint(text);
};
P.btConnect = async function () {
  if (!navigator.bluetooth) { openModal(`<div class="modal-head"><h2>📡 Printer Bluetooth</h2><button class="modal-close" onclick="closeModal()">✕</button></div><p class="muted" style="line-height:1.6">Browser ini belum mendukung Bluetooth. Pakai <b>Chrome di Android</b> (alamat harus https), atau cetak lewat browser dengan tombol <b>Cetak Nota</b>.</p>`); return; }
  try {
    const dev = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: BT_SERVICES });
    toastMsg('Menghubungkan…');
    const srv = await dev.gatt.connect(), svcs = await srv.getPrimaryServices(); let ch = null;
    for (const s of svcs) { for (const c of await s.getCharacteristics()) { if (c.properties.write || c.properties.writeWithoutResponse) { ch = c; break; } } if (ch) break; }
    if (!ch) throw new Error('no-write');
    bt = { dev, ch };
    dev.addEventListener('gattserverdisconnected', () => { bt = { dev: null, ch: null }; P.settingsExtras(); });
    toastMsg('Printer terhubung: ' + (dev.name || 'Bluetooth')); P.settingsExtras();
  } catch (e) { if (e && e.name === 'NotFoundError') return; toastMsg('Gagal menghubungkan printer'); }
};
P.btDisconnect = function () { try { if (bt.dev && bt.dev.gatt.connected) bt.dev.gatt.disconnect(); } catch (e) { } bt = { dev: null, ch: null }; toastMsg('Printer diputuskan'); P.settingsExtras(); };
P.testPrint = function () {
  P.print(P.rowsToText(head().concat([{ t: 'c', s: 'TES CETAK' }, { t: 'lr', l: 'Printer', r: bt.ch ? 'Bluetooth' : 'Browser' }, { t: 'lr', l: 'Waktu', r: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }, { t: 'hr' }, { t: 'c', s: 'Printer berfungsi' }, { t: 'n' }])));
};
let _rcpt = '';
P.offerReceipt = function (title, kind, rec) {
  _rcpt = P.buildReceipt(kind, rec);
  openModal(`
    <div class="modal-head"><h2>✅ ${esc(title)}</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="pf-receipt">${esc(_rcpt)}</div>
    <div class="btn-row"><button class="btn btn-secondary" onclick="closeModal()">Selesai</button><button class="btn btn-primary" onclick="Platform.printLast()">🖨️ Cetak Nota</button></div>`);
};
P.printLast = () => P.print(_rcpt);
P.printRecord = (kind, rec) => { _rcpt = P.buildReceipt(kind, rec); P.print(_rcpt); };

/* ---------- pengaturan tambahan ---------- */
const VERSIONS = [
  ['1.5.7', '20 November 2026', [
    'Baru: data masjid kini ikut tersimpan di awan (cloud), jadi aman kalau HP hilang, browser dibersihkan, atau dipakai lebih dari satu perangkat. Buka Pengaturan → ☁️ Data di Awan untuk melihat keadaan dan menekan "Sinkronkan Sekarang"',
    'Aplikasi tetap berjalan penuh tanpa internet — semua catatan tetap disimpan di HP ini lebih dulu, lalu dikirim sendiri begitu ada sinyal. Perubahan yang belum terkirim tidak hilang walau aplikasi ditutup',
    'Data yang sudah ada di HP sebelum pembaruan ini ikut dinaikkan ke awan sekali, sedikit-sedikit, jadi tidak memenuhi penyimpanan HP',
    'Kalau catatan yang sama sudah ada di perangkat lain yang lebih dulu tersambung, versi di awan yang dipakai — perubahan sesudahnya tetap saling menyusul dengan aman',
    'Keamanan: kunci-kunci data website masjid yang belum tayang tidak lagi bisa dibaca orang lain; pratinjau website (sebelum tayang) tetap bisa dilihat dari halaman Pengaturan → Website'
  ]],
  ['1.5.6', '19 November 2026', [
    'Siapan "kunci fitur" berlisensi: daftar fitur yang terkunci ada di pengaturan aplikasi (CFG.proFeatures), ditandai 🔒. Sampel aktif: di 📊 Laporan versi gratis tetap bisa membuka halaman & mode Mingguan (minggu ini), tetapi tab Bulanan, tab Custom, dan geser periode ‹ › terkunci; di 💰 Kas tab Pinjaman dan tab 🤲 Zakat terkunci (halaman Kas tetap bisa dibuka)',
    'Status lisensi kini juga memeriksa tanggal kedaluwarsa, jadi skema langganan (lisensi berjangka) langsung ikut terkendali; tanggal aktif lisensi muncul di modal Lisensi & Akun Saya',
    'Saat fitur dikunci: menu yang terkunci diberi tanda 🔒 dan saat diketuk muncul penjelasan "Butuh Lisensi" + tombol Lihat Lisensi — data tetap bisa dilihat, fitur lain tetap jalan'
  ]],
  ['1.5.5', '18 November 2026', [
    'Tombol akun di pojok kanan atas kini menampilkan foto profil saja (bulat). Belum ada foto? Tampil siluet orang. Nama & nomor WhatsApp tetap bisa dilihat lewat ketuk tombolnya (modal "Akun Saya")',
    'Baru: foto profil bisa dipasang di app Mitra — halaman Akun → Data Diri → Foto Profil (pilih/ganti/hapus). Foto otomatis ikut muncul di pojok kanan atas aplikasi ini',
    'Baris akun di halaman Pengaturan sekarang bisa diketuk untuk langsung membuka app Mitra — di sanalah identitas, foto profil, dan lisensi akun dikelola'
  ]],
  ['1.5.4', '17 November 2026', [
    'Header aplikasi sekarang menampilkan tombol "Akun" — nama akun yang sedang login dan nomor WhatsApp-nya, menggantikan chip kuota "GRATIS 0/60 catatan"',
    'Ketuk tombol akun untuk membuka "Akun Saya": nama akun, nomor WhatsApp, status lisensi (aktif atau mode gratis + sisa kuota bulan ini), tombol Lihat Lisensi, dan Keluar dari akun',
    'Nama akun diambil otomatis dari data pendaftaran, jadi pengurus langsung tahu aplikasi ini dipakai atas nama siapa'
  ]],
  ['1.5.3', '17 November 2026', [
    'Baru: modul zakat fitrah di tab 🤲 Zakat — catat fitrah yang diterima dari warga (nama, jumlah jiwa, uang atau beras, nilai per jiwa otomatis Rp50.000 atau 2,5 kg dan tetap bisa diubah), lalu terlihat sisa fitrah yang belum salurkan tiap musim (tahun hijriah)',
    'Zakat fitrah punya saluran sendiri: penerima wajib dari golongan Fakir & Miskin, ada pengingat paling lambat salurkan sebelum shalat Idul Fitri, dan uang fitrah dicatat terpisah dari kas — saldo kas serta laporan tidak ikut berubah',
    'Baru: tombol 🤲 di tab Zakat membuka dua pilihan — "Catat Pengumpulan Fitrah" dan "Catat Penyaluran" (zakat fitrah atau zakat lainnya)',
    'Jenis zakat mal kini lengkap 7 pilihan sesuai klasifikasi resmi: Uang & Tabungan, Emas & Perak, Perniagaan/Usaha, Penghasilan/Profesi, Pertanian & Hasil Bumi, Peternakan &-Perikanan, Lainnya — Zakat Fitrah dihapus dari sini karena sudah punya modul sendiri',
    'Baris panduan nisab & kadar zakat otomatis muncul di bawah dropdown "Jenis" (mis. nisab penghasilan Rp91.681.728 setahun, zakat 2,5%, pertanian 10%/5%) — bahasa sehari-hari supaya mudah dibaca pengurus'
  ]],
  ['1.5.2', '17 November 2026', [
    'Pemasukan kategori Donasi/Sedekah, Zakat, dan Wakaf kini bisa diisi "Jenis" (mis. Zakat Fitrah, Zakat Mal, Wakaf untuk pembangunan) dan "Dari / pihak" (mis. nama donatur) — muncul otomatis saat kategori itu dipilih, lalu tampil di daftar kas dan detail transaksi',
    'Jenis zakat diperbarui sesuai klasifikasi resmi (Fitrah, Mal/harta & uang, Emas & Perak, Perdagangan/Usaha, Penghasilan/Pekerjaan, Pertanian & Hasil Bumi) plus kolom "Bentuk zakat": zakat fitrah umumnya berupa beras/bahan makanan — kalau itu yang dipilih, muncul kolom "Banyaknya" (mis. 10 kg beras) dan kolom jumlah berubah jadi perkiraan harga dalam rupiah (dasar: PMA Kemenag No. 52/2014 & Fatwa MUI No. 65/2022)',
    'Zakat berupa beras/bahan makanan kini otomatis tidak masuk kas: kolom sumber berubah jadi "Barang (bukan uang)" dan catatan itu tidak dihitung ke saldo tunai/bank/QRIS, opname, grafik 7 hari, kartu angka, maupun laporan — tetap tercatat di daftar transaksi sebagai zakat terkumpul',
    'Baru: tab 🤲 Zakat di halaman Kas untuk manajemen penyaluran zakat — catat penerima (nama + golongan/asnaf), tanggal, dan bentuk yang disalurkan; penyaluran zakat UANG otomatis mengurangi kas lewat kategori "Penyaluran Zakat" (tidak bisa dobel dari form biasa), penyaluran zakat BERAS/BARANG tidak menyentuh kas; ringkasan sisa zakat uang & barang selalu tampil di atas daftar riwayat',
    'Baris tombol aksi di modal (Simpan, Hapus, dst.) kini menempel/sticky di bawah layar — tetap terlihat saat isi form digulir, termasuk di modal gabungan Catat Transaksi',
    'Baru: bukti foto pada transaksi pemasukan & pengeluaran — ambil foto saat mencatat (tab Pemasukan/Pengeluaran), bisa juga ditambah/dihapus dari halaman detail transaksi; baris kas yang punya foto ditandai 📷',
    'Modal Pemasukan, Pengeluaran, dan Pinjaman digabung jadi satu modal "Catat Transaksi" dengan 3 tab — tombol Pinjaman di Menu Cepat langsung membuka tab Pinjaman, dan form ubah pinjaman dari detail juga memakai modal yang sama',
    'Beranda dibuka dengan baris tanggal: tanggal Masehi lengkap + penanggalan hijriyah, tanpa kotak (rapi dan ringkas)',
    'Perbaikan: menu Website di loker Lainnya tidak lagi ikut hilang saat modul website dimatikan — yang disembunyikan hanya isi pengaturan website, halamannya tetap bisa dibuka untuk menyalakan kembali',
    'Kegiatan mendatang kini menampilkan hitung mundur: badge HARI INI, Besok, atau "N hari lagi"',
    'Baru: kartu ringkasan uang yang dipinjamkan (hanya tampil bila ada yang belum lunas) — sekali ketuk langsung ke tab Pinjaman',
    'Pengingat backup otomatis di Beranda: muncul bila belum pernah backup atau sudah lebih dari 30 hari, dengan tombol Backup Sekarang dan Nanti (menunda 30 hari)',
    'Menu Cepat (5 tombol satu baris: Masuk, Keluar, Pinjaman, Jamaah, Inventaris) dipindah langsung di bawah kartu angka tanpa judul seksi — Kegiatan, Laporan, dan Opname tetap ada di tab bawah / halaman Kas',
    'Kartu angka kini punya sub-angka (jumlah transaksi, perbandingan dengan bulan lalu, jumlah yang punya nomor HP) dan bisa diketuk langsung ke halamannya',
    'Jarak antar kartu di atas Beranda dirapikan supaya tidak ada kartu yang menempel dengan kartu di bawahnya',
    'Tautan "Lihat Semua" kini berada di ujung kanan judul Kegiatan Mendatang dan Transaksi Terakhir',
    'Baru: grafik batang mini 7 hari terakhir (hijau masuk · merah keluar) di Beranda, kini lengkap dengan ringkasan total masuk, keluar, dan selisih di atas grafik, tanggal tiap batang, serta keterangan periode di bawahnya'
  ]],
  ['1.5.1', '17 November 2026', [
    'Logo di layar masuk diganti memakai logo utama Kasir Solo (sama dengan logo di halaman Pengaturan)',
    'Narasi di bawah form menyesuaikan tab yang sedang terbuka: tab Daftar kini menyebut bahwa dengan membuat akun Anda menyetujui Syarat & Ketentuan dan aturan privasi dari PT Mesin Kasir Solo'
  ]],
  ['1.5.0', '17 November 2026', [
    'Halaman Laporan dirombak: uang pinjaman sekarang DIPISAH dari pemasukan dan pengeluaran, karena uang yang dipinjamkan bukan belanja masjid dan uang yang kembali bukan donasi baru — ada kartu 🤝 Uang Pinjaman sendiri',
    'Baru: tombol 🖨️ Cetak Laporan — mencetak laporan periode yang sedang dibuka (bisa juga Simpan PDF), lengkap dengan nama masjid, ringkasan, rincian kategori, dan daftar transaksi',
    'Saldo kini dibagi dua: Saldo Awal Periode dan Saldo Akhir Periode, jadi laporan bulan lalu tidak lagi menampilkan saldo hari ini',
    'Rincian kategori diberi persentase dan bar proporsi, jadi kelihatan porsi tiap kategori',
    'Tiap kartu angka menampilkan jumlah transaksi, rata-rata per hari, dan perbandingan dengan periode sebelumnya (naik/turun %)',
    'Baru: grafik tren pemasukan & pengeluaran (per hari untuk periode pendek, dibagi rata untuk periode panjang)',
    'Baru: daftar Transaksi Periode Ini di bawah rincian — tekan "Lihat semua" kalau catatannya banyak',
    'Baru: tombol 📤 Bagikan — ringkasan laporan siap tempel/kirim ke grup WA'
  ]],
  ['1.4.19', '17 November 2026', ['Pengeluaran jenis Pinjam Kas sekarang pakai ikon 🤝, beda dari pengeluaran biasa (🧾), jadi sekali lihat sudah kelihatan mana yang pinjaman', 'Ikon yang sama dipakai juga di daftar Transaksi Terakhir pada Beranda']],
  ['1.4.18', '17 November 2026', ['Kartu Total Saldo di halaman Kas dipindah ke paling atas, tepat di bawah judul halaman dan di atas tab Semua/Pemasukan/Pengeluaran/Pinjaman']],
  ['1.4.17', '17 November 2026', ['Tombol Cetak dan Buka Pinjaman di detail transaksi sekarang sama besar (berbagi rata), jadi barisnya terlihat seimbang', 'Ukuran tulisan tombol di baris itu disesuaikan sedikit supaya nama tombolnya tetap satu baris di layar HP kecil']],
  ['1.4.16', '17 November 2026', ['Di detail transaksi yang berasal dari pinjaman, tombol Cetak sekarang di sebelah kiri dan tombol Buka Pinjaman mengambil sisa lebar', 'Label tombol cetak dipersingkat jadi "Cetak" dan lebarnya mengikuti panjang tulisan, jadi tidak ada tombol yang kepanjangan']],
  ['1.4.15', '17 November 2026', ['Di detail pinjaman, tombol Hapus dan Ubah Data sekarang bulat tanpa tulisan (46px) dan duduk berdampingan, jadi baris tombolnya lebih rapi', 'Tombol 💵 Terima Bayar tetap berlabel karena itu tombol utama']],
  ['1.4.14', '17 November 2026', ['Peminjam uang kas kini wajib dipilih dari daftar jamaah — tidak bisa lagi mengetik nama bebas, jadi tidak ada pinjaman atas nama orang yang tidak terdaftar', 'Saat jamaah dipilih, kolom Kontak/WA langsung terisi otomatis dari profil jamaah (masih bisa diubah)', 'Kalau daftar jamaah masih kosong, aplikasi mengarahkan untuk menambah jamaah dulu', 'Baru: bukti foto pada pinjaman dan pada setiap pembayaran kembali — bisa diambil dari kamera, dikecilkan otomatis supaya tidak menghabiskan penyimpanan, dan bisa dibuka ukuran penuh']],
  ['1.4.13', '17 November 2026', ['Baru: pinjaman uang kas — ada tab Pinjaman di halaman Kas untuk mencatat orang/jamaah yang meminjam uang kas masjid', 'Uang yang dipinjam otomatis tercatat keluar dari kas, jadi saldo langsung berkurang; saat dikembalikan otomatis masuk lagi', 'Pembayaran boleh dicicil sampai lunas, dan status tiap pinjaman kelihatan (Belum lunas / Telat N hari / Lunas)', 'Ada ringkasan berapa total uang kas yang sedang dipinjam orang di atas daftarnya', 'Hapus pinjaman ikut membersihkan catatan kasnya, jadi saldo tidak tertinggal']],
  ['1.4.12', '17 November 2026', ['Daftar aset kini menampilkan jumlah barang yang benar-benar ada di tempat — barang yang sedang keluar ikut dikurangi', 'Angka kecil di kanan tetap menunjukkan jumlah yang dimiliki (mis. 9 dari 15), jadi tidak ada data yang hilang', 'Pengurangannya diambil dari kondisi terbaik dulu (baik → ringan → berat), karena yang dipinjam/dilaundry biasanya yang masih bagus', 'Di form aset ada keterangan “sedang keluar N, ada di tempat M” supaya jelas kenapa angka di daftar berbeda dengan isian']],
  ['1.4.11', '17 November 2026', ['Jumlah barang di Inventaris kini dicatat per kondisi — mis. 15 karpet: 13 baik, 2 rusak ringan, 1 rusak berat', 'Total barang dihitung otomatis saat mengisi, dan rinciannya tampil di daftar aset (angka tiap kondisi diberi warna)', 'Data aset lama tetap terbaca: yang dulu satu kondisi otomatis dianggap seluruh jumlahnya ada di kondisi itu', 'Jumlah tidak bisa dikecilkan sampai lebih kecil dari barang yang sedang keluar']],
  ['1.4.10', '17 November 2026', ['Tombol di form barang keluar dipakaikan ikon: 🗑️ untuk hapus dan 💾 untuk simpan, keduanya bulat ukuran sama (46px)', 'Tombol "Sudah Kembali" menyesuaikan sisa lebar, jadi satu baris rapi tanpa sisa ruang', 'Di detail barang keluar yang terkunci, tombolnya kini sama besar dan berlabel "🗑️ Hapus" serta "Tutup"']],
  ['1.4.9', '17 November 2026', ['Tampilan pemberitahuan "Ada Versi Baru" diganti seperti di Kaki5: layar penuh bergradasi dengan kartu putih, nomor versi, dan daftar perubahan versi terbaru langsung terlihat', 'Daftar perubahan bisa digulir sendiri, jadi judul dan tombol tetap kelihatan walau catatannya panjang', 'Tombol perbarui langsung memberi tanda "Memperbarui..." dan ada "Nanti dulu" kalau mau menunda']],
  ['1.4.8', '17 November 2026', ['Catatan barang keluar yang sudah kembali kini terkunci: tidak bisa diedit lagi, hanya bisa dilihat dan dihapus kalau memang salah catat', 'Tombol "Sudah Kembali" / "Sudah Selesai" minta konfirmasi dulu, karena setelah ditekan catatannya terkunci', 'Baris yang terkunci diberi tanda 🔒 di daftar Keluar']],
  ['1.4.7', '17 November 2026', ['Barang keluar di Inventaris kini punya alasan: Dipinjam, Dilaundry, Diperbaiki, dan Dibawa acara — tiap alasan punya ikon sendiri dan isian yang menyesuaikan', 'Label kolom ikut berubah sesuai alasan (mis. "Dipinjam oleh" atau "Dibawa ke"), jadi tidak lagi semua dianggap pinjaman', 'Catatan lama tetap terbaca: yang tersimpan sebelum pembaruan otomatis dianggap "Dipinjam"']],
  ['1.4.6', '17 November 2026', ['Ikon di daftar transaksi kas diganti supaya langsung kelihatan bedanya: uang masuk pakai ikon kantong uang, uang keluar pakai ikon nota']],
  ['1.4.5', '17 November 2026', ['Baru: jadwal kegiatan bisa diulang — Tiap hari, Tiap minggu (pilih harinya), Tiap bulan (tanggal tetap, atau hari tetap seperti "Jumat pertama/terakhir"), dan Tiap tahun; sekali isi langsung dibuat s.d. 52 tanggal', 'Tanggal hasilnya ditampilkan lebih dulu sebelum disimpan, jadi bisa dipastikan cocok', 'Tiap tanggal disimpan sendiri-sendiri: bisa diubah, ditandai selesai, atau dihapus satu per satu; ada juga tombol "Hapus Semua Jadwal Ini" untuk membatalkan seluruh rentetannya', 'Kegiatan yang tanggalnya sudah lewat otomatis pindah ke tab Selesai', 'Website masjid menampilkan 8 jadwal terdekat, dengan jumlah total kajian mendatang', 'Penyempurnaan tampilan: warna & label menu cepat beranda, tinggi tab lebih ringkas (36px), panel periode laporan bisa dibuka-tutup, ukuran teks tanggal diseragamkan, badge status kegiatan pindah ke kolom kiri']],
  ['1.4.4', '16 November 2026', ['Baru: modul Inventaris — pencatatan peminjaman barang (DB.pinjam) beserta riwayat barang keluar dan penandaan barang kembali']],
  ['1.4.3', '16 November 2026', ['Branding: logo kubah (icon.svg) dipakai konsisten di semua titik brand; ikon baru masuk cache PWA']],
  ['1.4.2', '15 November 2026', ['Deploy: satu project Vercel (root = masjid/) — admin di /adm/, website klien di /<slug> pada origin yang sama; webBaseUrl() mengikuti location.origin', 'web-masjid: slug langsung di path /<slug> (selain /m/<slug>); jika slug punya domain TLD aktif, otomatis redirect ke domain tersebut', 'RPC baru masjid_domain_for_slug (anon) untuk lookup slug ke domain aktif']],
  ['1.4.1', '15 November 2026', ['Keamanan: domain milik platform (mis. *.vercel.app) tidak lagi bisa diklaim — mencegah website masjid lain "membajak" host beta kami', 'Perbaikan: klaim ulang domain yang sudah AKTIF tidak lagi diam-diam menurunkan status (website mati tanpa pemberitahuan) — kini owner wajib konfirmasi, lalu verifikasi ulang', 'Keamanan: RPC sesi (klaim/verifikasi/re-klaim) ditutup untuk role anon; hanya website publik & publish token lama yang tetap terbuka']],
  ['1.4.0', '15 November 2026', ['Baru: adopsi multi-role HUB — outlet picker, Kelola Pegawai (tambah/ubah role/hapus), gating menu per role', 'Baru: publikasi & draft website via sesi login (tanpa token di perangkat) — RPC masjid_publish_by_account / masjid_draft_by_account', 'Baru: klaim & verifikasi domain TLD custom (DNS CNAME/TXT) agar website publik memakai domain sendiri', 'web-masjid: resolusi slug dari host domain (masjid_resolve_domain), fallback /m/<slug>, ?slug= untuk preview; aset path absolut root', 'Deploy: dua project Vercel terpisah (web-masjid & adm-masjid) dengan vercel.json masing-masing; preview admin via WEB_BASE_URL']],
  ['1.2.2', '6 November 2026', ['Keamanan: semua data kini di-escape saat ditampilkan (tahan skrip jahat dari file backup)', 'Perbaikan: konfirmasi sebelum hapus transaksi, validasi file backup, tolak tanggal masa depan', 'Baru: publikasi profil, jadwal kajian & laporan bulan berjalan ke website masjid', 'Perbaikan: data contoh tidak lagi otomatis masuk — kini tombol opsional di Pengaturan', 'Perbaikan: label saldo diperjelas (gabungan Tunai + Bank + QRIS)']],
  ['1.2.1', '6 November 2026', ['Perbaikan: pendaftaran PWA tidak lagi memunculkan error SyntaxError saat file sw.js tidak tersedia (mis. dibuka sebagai satu file di pratinjau)']],
  ['1.2.0', '6 November 2026', ['Aplikasi baru: Kasir Solo - Pesantren (santri, SPP & tabungan, tahfidz, absensi, perizinan, kesehatan, kedisiplinan)', 'Label laba bersih kini menyesuaikan jenis usaha']],
  ['1.1.0', '4 November 2026', ['Model baru: kuota transaksi gratis tiap bulan + lisensi per perangkat (menggantikan trial 7 hari)', 'Buka/Tutup Kas dengan hitung selisih uang laci (Konter HP & Laundry), Opname Kas (Masjid)', 'Catat pengeluaran & pemasukan lain, laba bersih di laporan', 'Cetak nota/bukti: printer Bluetooth atau lewat browser', 'Diagnosa data, Panduan, Syarat & Ketentuan, dialog versi baru, pemasangan PWA', 'Perbaikan: "hari ini" kini mengikuti tanggal lokal (sebelumnya berganti pukul 07.00 WIB)']],
  ['1.0.0', 'Rilis awal', ['Rilis pertama aplikasi']]
];
P.settingsExtras = function () {
  /* Kartu tambahan (Aktifkan Fitur/Perangkat/Bantuan) ikut mengalir di DALAM
     .settings-grid utama — bukan grid terpisah — supaya tidak ada kolom kosong. */
  let b = document.querySelector('#view-settings > .settings-grid');
  if (!b) { b = ensureBox('view-settings', 'pfSet', null, 'end'); if (!b) return; if (!b.classList.contains('settings-grid')) b.classList.add('settings-grid'); }
  b.querySelectorAll('.sg-extra').forEach(el => el.remove());
  const row = (ic, t, s, on) => `<button type="button" class="pf-row" onclick="${on}"><div class="ic">${ic}</div><div class="tx"><b>${t}</b><span>${s}</span></div><span class="go">›</span></button>`;
  b.insertAdjacentHTML('beforeend', `
    <div class="card sg-extra"><h3>☁️ Data di Awan</h3>
      <button type="button" class="pf-row" id="syncRowBtn" onclick="Platform.syncSekarang()">
        <div class="ic">☁️</div>
        <div class="tx"><b>Sinkronkan Sekarang</b><span id="syncStatusTeks">Belum tersinkron</span></div>
        <span class="go">›</span>
      </button>
      <div class="muted" style="font-size:12px;line-height:1.6;margin-top:8px;">Data tetap tersimpan di HP ini, jadi aplikasi tetap jalan walau tidak ada internet.</div></div>
    ${A.hasKas ? `<div class="card sg-extra"><h3>⚙️ Aktifkan Fitur</h3>
      <div class="pf-row static"><div class="ic">💰</div><div class="tx"><b>Buka / Tutup Kas</b><span>Laci punya modal awal; transaksi diblok kalau kas belum dibuka</span></div>
      <label class="pf-switch" style="margin:0;"><input type="checkbox" ${st().settings.kas ? 'checked' : ''} onchange="Platform.toggleKas(this.checked)"><i></i></label></div></div>` : ''}
    <div class="card sg-extra"><h3>📱 Perangkat</h3>
      ${row('📡', 'Hubungkan Printer', bt.dev ? 'Terhubung: ' + esc(bt.dev.name || 'Bluetooth') : 'Belum terhubung', 'Platform.btConnect()')}
      ${row('📄', 'Cetak Tes', 'Cek apakah printer berfungsi', 'Platform.testPrint()')}
      ${row('❌', 'Putuskan Printer', 'Lepas koneksi Bluetooth', 'Platform.btDisconnect()')}
      ${row('📲', 'Pasang Aplikasi', 'Buka kayak app native di HP', 'Platform.install()')}
      ${row('🩺', 'Diagnosa', 'Pastikan data usaha aman & tersimpan', 'Platform.openDiag()')}</div>
    <div class="card sg-extra sg-bantuan"><h3>📖 Bantuan & Informasi</h3>
      ${row('📖', 'Panduan Singkat', 'Cara memakai ' + esc(CFG.name), 'Platform.openHelp()')}
      ${row('📜', 'Syarat & Ketentuan', 'v1.0 · diperbarui 4 Nov 2026', 'Platform.openTerms()')}
      ${row('🕓', 'Riwayat Versi', 'Versi ' + CFG.version, 'Platform.openVersions()')}
      <div class="muted" style="text-align:center;margin-top:12px;line-height:1.7;">${esc(CFG.name)} · Versi ${CFG.version}<br>PT Mesin Kasir Solo · <a href="https://wa.me/${CFG.wa}" target="_blank" style="color:var(--brand-orange-dark);font-weight:700;">0881-6566-935</a></div></div>`);
  a11yRows(b);
  /* Kartu "Data di Awan" menampilkan keadaan terakhir (teks + pukul berapa). */
  try { if (window.Sync) window.Sync.renderStatus(); } catch (e) { /* abaikan */ }
};
/* Tombol "Sinkronkan Sekarang" di kartu Pengaturan.
   Tanpa sinyal, data tetap aman di perangkat — tombol hanya memberi tahu. */
P.syncSekarang = async function () {
  const tulis = txt => { const t = document.getElementById('syncStatusTeks'); if (t) t.textContent = txt; };
  if (P._syncSibuk) return;
  if (!window.Sync || typeof window.Sync.sekarang !== 'function') { toastMsg('Simpan ke awan belum siap di perangkat ini'); return; }
  if (navigator.onLine === false) { tulis('Menunggu sinyal · data aman di HP ini'); toastMsg('Belum ada internet. Data tetap aman di HP ini.'); return; }
  P._syncSibuk = true;
  tulis('Menyinkron...');
  let r = null;
  try { r = await window.Sync.sekarang(); } catch (e) { r = null; }
  P._syncSibuk = false;
  try { window.Sync.renderStatus(); } catch (e) { /* abaikan */ }
  const k = (r && r.kode) || 'gagal';
  if (k === 'siap') { toastMsg((r && r.sisa) ? 'Sebagian data masih menunggu dikirim' : 'Selesai. Data sudah tersimpan di awan.'); return; }
  if (k === 'belum-masuk') { toastMsg('Masuk akun dulu supaya data bisa disimpan ke awan.'); return; }
  if (k === 'ditolak') { toastMsg((r && r.pesan) || 'Akun ini belum berhak menyimpan ke awan.'); return; }
  toastMsg((r && r.pesan) || 'Gagal menyambung. Coba lagi sebentar lagi.');
};
/* Baris pengaturan dibuat dari <div onclick> — beri peran tombol + bisa diakses
   keyboard (pola sama seperti tab Laporan). Tanpa ini baris tidak bisa difokus
   Tab dan tidak bisa diaktifkan Enter/Spasi. */
function a11yRows(root) {
  if (!root) return;
  root.querySelectorAll('.setting-item[onclick],.pf-row[onclick]').forEach(el => {
    if (el.dataset.kb) return;
    el.dataset.kb = '1';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } });
  });
}
P.toggleKas = function (on) { st().settings.kas = !!on; saveDB(); renderDashboard(); toastMsg(on ? 'Buka/Tutup Kas diaktifkan' : 'Buka/Tutup Kas dimatikan'); };
let deferred = null;
P.install = function () {
  if (deferred) { deferred.prompt(); deferred = null; return; }
  if (window.matchMedia && matchMedia('(display-mode: standalone)').matches) { toastMsg('Aplikasi sudah terpasang'); return; }
  openModal(`<div class="modal-head"><h2>📲 Pasang Aplikasi</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <p class="muted" style="line-height:1.7"><b>Android (Chrome):</b> menu ⋮ → <i>Tambahkan ke layar utama</i>.<br><b>iPhone (Safari):</b> tombol Bagikan → <i>Tambah ke Layar Utama</i>.<br><br>Pemasangan butuh aplikasi dibuka lewat alamat web (https), bukan dari file lokal.</p>`);
};
P.openHelp = function () {
  openModal(`<div class="modal-head"><h2>📖 Panduan</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="pf-doc">${A.help.map(h => `<h4>${h[0]}</h4><p>${h[1]}</p>`).join('')}</div>`);
};
P.openVersions = function () {
  openModal(`<div class="modal-head"><h2>🕓 Riwayat Versi</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="pf-ver">${VERSIONS.map(v => `<b>v${v[0]}</b> <span class="muted">· ${v[1]}</span><ul>${v[2].map(x => `<li>${esc(x)}</li>`).join('')}</ul>`).join('')}</div>`);
};
P.openTerms = function () {
  const q = CFG.quota + ' ' + CFG.unit;
  openModal(`<div class="modal-head"><h2>📜 Syarat & Ketentuan</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <p class="muted">🕒 Terakhir diperbarui: <b>4 November 2026</b> · v1.0</p>
    <div class="pf-doc">
      <h4>1. Layanan</h4><p><b>${esc(CFG.name)}</b> adalah ${A.termsService} Aplikasi langsung bisa dipakai tanpa masa uji coba berhitung hari — yang dibatasi hanyalah kuota gratis bulanan sesuai pasal 2.</p>
      <h4>2. Kuota Gratis & Lisensi</h4><p>Versi gratis memberi kuota <b>${q}</b> setiap bulan tanpa batas waktu; kuota segar kembali di awal bulan. Saat kuota habis, aplikasi tetap bisa dibuka dan dilihat, namun pencatatan baru terkunci sampai bulan berikutnya — atau buka lebih awal dengan <b>membeli lisensi</b>. Lisensi berlaku <b>per perangkat</b> (terikat ID Perangkat); menyebarkan atau menggandakan kode lisensi tanpa izin dapat menyebabkan penonaktifan. Selain kuota, <b>beberapa fitur lanjutan dapat dikunci untuk versi gratis</b> dan terbuka dengan lisensi (ditandai 🔒 di aplikasi; versi gratis dengan kuota 0 berarti tanpa batas kuota).</p>
      <h4>3. Data Anda</h4><p>Seluruh data tersimpan <b>lokal di perangkat Anda</b> (mode offline penuh) dan tidak dikirim ke server kami. ${A.termsData} Gunakan <b>Backup</b> (ekspor JSON) untuk memindahkan atau mengamankan data.</p>
      <h4>4. Pencadangan</h4><p>Anda bertanggung jawab melakukan backup berkala. Menghapus data browser, memformat perangkat, atau berganti perangkat tanpa backup dapat menghilangkan data secara permanen.</p>
      <h4>5. Tanggung Jawab</h4><p>Anda bertanggung jawab atas penggunaan aplikasi pada perangkat Anda. Kami tidak bertanggung jawab atas kehilangan data akibat tindakan manual (hapus data, reset/pergantian perangkat) atau kerusakan perangkat.</p>
      <h4>6. Bantuan & Perubahan</h4><p>Butuh bantuan? Hubungi kami lewat WhatsApp <b>0881-6566-935</b> (sertakan ID Perangkat: ${devFmt(deviceId())}). Kami dapat memperbarui Syarat & Ketentuan sewaktu-waktu; penggunaan berkelanjutan berarti Anda menyetujui versi terbaru. — <b>PT Mesin Kasir Solo</b></p>
    </div>`);
};

/* ---------- diagnosa ---------- */
P.openDiag = async function () {
  const r = []; const add = (ok, t, d) => r.push([ok === true ? '✅' : ok === false ? '❌' : '⚠️', t, d]);
  const k = '__ks_test__'; add(LS.set(k, '1') && LS.get(k) === '1', 'Penyimpanan lokal', 'Browser bisa menyimpan data'); try { localStorage.removeItem(k); } catch (e) { }
  try { const raw = localStorage.getItem(DB_KEY); JSON.parse(raw || '{}'); add(true, 'Data aplikasi', (raw ? (raw.length / 1024).toFixed(1) + ' KB' : 'kosong') + ' · ' + A.counts()); } catch (e) { add(false, 'Data aplikasi', 'Data rusak — segera restore dari backup'); }
  add(true, 'ID Perangkat', devFmt(deviceId()));
  add(P.isLicensed() ? true : null, 'Lisensi', P.isLicensed() ? 'Aktif' : 'Versi gratis · ' + P.used() + '/' + CFG.quota + ' ' + CFG.unit + ' bulan ini');
  const lb = st().lastBackup; add(lb ? true : null, 'Backup terakhir', lb ? fmtD(lb) : 'Belum pernah — sebaiknya backup sekarang');
  try { if (navigator.storage && navigator.storage.persisted) { const ps = await navigator.storage.persisted(); add(ps ? true : null, 'Penyimpanan permanen', ps ? 'Dilindungi dari pembersihan otomatis' : 'Belum dilindungi — browser bisa menghapus data saat memori penuh'); } } catch (e) { }
  try { if ('serviceWorker' in navigator && location.protocol !== 'file:') { const g = await navigator.serviceWorker.getRegistration(); add(g ? true : null, 'Mode offline', g ? 'Siap (service worker aktif)' : 'Belum aktif — buka lewat alamat web (https)'); } else add(null, 'Mode offline', 'Tidak tersedia saat dibuka dari file lokal'); } catch (e) { }
  if (A.hasKas && kasOn()) add(true, 'Kas', st().shift ? 'Terbuka sejak ' + fmtShort(st().shift.start) : 'Tertutup');
  window.__pfDiag = r;
  openModal(`<div class="modal-head"><h2>🩺 Diagnosa</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    ${r.map(x => `<div class="pf-diag"><div class="s">${x[0]}</div><div><b>${esc(x[1])}</b><span>${esc(x[2])}</span></div></div>`).join('')}
    <div class="btn-row" style="margin-top:14px;"><button class="btn btn-secondary" onclick="Platform.openDiag()">🔄 Periksa Ulang</button><button class="btn btn-primary" onclick="Platform.diagWA()">📋 Kirim ke Admin</button></div>`);
};
P.diagWA = function () {
  const txt = 'Diagnosa ' + CFG.name + ' v' + CFG.version + '\n' + (window.__pfDiag || []).map(x => x[0] + ' ' + x[1] + ': ' + x[2]).join('\n');
  window.open('https://wa.me/' + CFG.wa + '?text=' + encodeURIComponent(txt), '_blank');
};

/* ---------- PWA & update ---------- */
let swReg = null, updateAsked = false;
/* Overlay versi baru — bentuknya mengikuti kaki5 (2026-11-17): layar penuh
   bergradasi brand + kartu putih. Isi "yang baru" diambil dari VERSIONS[0],
   jadi catatan rilis yang sudah ada di aplikasi ini ikut tampil (di kaki5
   asalnya dari version.json). Dibuat lepas dari #modalBox karena #modalBox
   bergaya bottom-sheet, sedangkan ini kartu tengah layar. */
function showUpdate() {
  const lama = document.getElementById('updateOverlay');
  if (lama) lama.remove();
  const notes = (VERSIONS[0] && Array.isArray(VERSIONS[0][2]) && VERSIONS[0][2].length)
    ? VERSIONS[0][2]
    : ['Perbaikan & penyempurnaan agar aplikasi makin lancar dipakai setiap hari'];
  const el = document.createElement('div');
  el.id = 'updateOverlay';
  el.className = 'show';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'updateTitle');
  el.dataset.prevOverflow = document.body.style.overflow || '';
  el.innerHTML = `
    <div class="update-card">
      <div class="update-head">
        <img class="update-logo" src="logo.png" alt="" onerror="this.style.display='none'">
        <div class="update-title" id="updateTitle">Ada Versi Baru! 🔄</div>
        <span class="update-version">Versi ${esc(CFG.version)}</span>
        <p class="update-sub">Data kamu tetap aman — tidak ada yang hilang.</p>
      </div>
      <div class="update-body"><ul class="update-notes">${notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>
      <div class="update-foot">
        <button class="btn btn-primary" id="updateOkBtn" style="width:100%;">🔄 Perbarui Sekarang</button>
        <button class="update-skip" onclick="Platform.dismissUpdate()">Nanti dulu</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  document.body.style.overflow = 'hidden';
  const btn = document.getElementById('updateOkBtn');
  btn.onclick = () => {
    btn.disabled = true;
    btn.textContent = 'Memperbarui...';
    Platform.applyUpdate();
    /* Jaring pengaman: kalau service worker baru gagal aktif (mis. koneksi
       putus), tombol jangan nyangkut di "Memperbarui..." selamanya. Kalau
       pembaruan berhasil, halaman keburu reload dan timer ini ikut hilang. */
    setTimeout(() => {
      const b = document.getElementById('updateOkBtn');
      if (!b) return;
      b.disabled = false;
      b.textContent = '🔄 Coba Lagi';
      toast('Pembaruan belum selesai — tekan Coba Lagi');
    }, 10000);
  };
  btn.focus();
}
P.showUpdate = showUpdate;
P.dismissUpdate = function () {
  const el = document.getElementById('updateOverlay');
  if (!el) return;
  document.body.style.overflow = el.dataset.prevOverflow || '';
  el.remove();
};
P.applyUpdate = function () {
  updateAsked = true;
  if (swReg && swReg.waiting) swReg.waiting.postMessage('SKIP_WAITING'); else location.reload();
};
function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  // daftar hanya jika sw.js benar-benar berisi JavaScript (pratinjau/hosting yang tidak menyertakan sw.js tidak memicu SyntaxError)
  fetch('sw.js', { cache: 'no-store' }).then(r => { if (!r.ok || !/javascript/i.test(r.headers.get('content-type') || '')) throw new Error('no-sw'); return navigator.serviceWorker.register('sw.js'); }).then(reg => {
    swReg = reg;
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate();
    reg.addEventListener('updatefound', () => { const nw = reg.installing; if (nw) nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdate(); }); });
  }).catch(() => { });
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading || !updateAsked) return; reloading = true; location.reload(); });
}

/* ---------- pemasangan hook ---------- */
function after(name, fn) {
  const o = window[name]; if (typeof o !== 'function') { console.warn('Platform: fungsi tidak ada', name); return; }
  window[name] = function () { const r = o.apply(this, arguments); try { fn.apply(this, arguments); } catch (e) { console.error(e); } return r; };
}
function hook(h) {
  const o = window[h.fn]; if (typeof o !== 'function') { console.warn('Platform: hook gagal', h.fn); return; }
  window[h.fn] = function () {
    if (!P.guard({ needKas: !!h.needKas })) return;
    const ctx = h.pre ? h.pre() : {}, before = DB[h.arr].length;
    const r = o.apply(this, arguments);
    if (DB[h.arr].length > before) { const rec = DB[h.arr][DB[h.arr].length - 1]; try { h.onNew && h.onNew(rec, ctx); } catch (e) { console.error(e); } P.hit(); }
    return r;
  };
}
P.wrapGuard = function (name, o) {
  const f = window[name]; if (typeof f !== 'function') { console.warn('Platform: wrapGuard gagal', name); return; }
  window[name] = function () { if (!P.guard(o)) return; return f.apply(this, arguments); };
};
P.helpers = { esc, rp, fmtD, inWin, uid, st, saveRef: () => saveDB(), after, ensureBox };

P.start = function () {
  st(); deviceId();
  VIEW_TITLES.keuangan = '💸 Pengeluaran & Pemasukan';
  if (A.hasCashflow) { const s = document.createElement('section'); s.className = 'view'; s.id = 'view-keuangan'; $('appMain').appendChild(s); }
  const grid = document.querySelector('#moreSheet .sheet-grid');
  if (grid && A.hasCashflow) grid.insertAdjacentHTML('beforeend', `<button type="button" class="sheet-item" onclick="closeMoreSheet();go('keuangan')"><span class="ic" style="background:var(--success-bg);color:var(--success);">💸</span><span>Keuangan</span></button>`);
  A.hooks.forEach(hook);
  if (A.install) A.install(P);
  const rv = window.renderView;
  window.renderView = function (view) { rv.apply(this, arguments); if (view === 'keuangan') P.renderKeuangan(); };
  after('renderDashboard', () => P.dashExtras());
  after('renderLaporan', () => P.lapExtras());
  after('fillSettingsForm', () => P.settingsExtras());
  after('backupData', () => { st().lastBackup = new Date().toISOString(); saveDB(); });
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; });
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { }
  registerSW();
  P.refresh();
  // Gerbang login v1.3.0: tanpa sesi, jangan render isi aplikasi sama sekali.
  try { if (typeof Akun !== 'undefined' && Akun.sesiLokal()) renderView(navStack[navStack.length - 1]); } catch (e) { /* Akun belum siap → biarkan gerbang yang menentukan */ }
};
})();


;

/* =========================================================
   KASIR SOLO — MASJID
   Single-file offline app. Data disimpan di localStorage.
   ========================================================= */
const DB_KEY = 'ksmasjid_db_v1';
const nowISO = () => new Date().toISOString();
const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };
const localDay = iso => { const d = new Date(iso); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };
const fmtRp = n => (n<0?'-':'') + 'Rp' + Math.round(Math.abs(n||0)).toLocaleString('id-ID');
const uid = (p='') => p + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let DB = loadDB();
function defaultDB(){
  return {
    settings:{ namaMasjid:'Masjid Saya', alamat:'', takmir:'', wa:'' },
    kas:[], jamaah:[], kegiatan:[], inventaris:[], pinjam:[], pinjamKas:[], salurZakat:[], fitrah:[],
    license:{ status:'trial', trialStart: nowISO(), shareCount:0, code:null }
  };
}
function loadDB(){
  try{
    const raw = localStorage.getItem(DB_KEY);
    if(!raw) return defaultDB();
    const d = JSON.parse(raw);
    return Object.assign(defaultDB(), d, {
      settings:Object.assign(defaultDB().settings, d.settings||{}),
      license:Object.assign(defaultDB().license, d.license||{})
    });
  }catch(e){ return defaultDB(); }
}
function saveDB(){
  /* Setiap penyimpanan ke perangkat sekaligus jadi pemicu sinkron ke cloud.
     Satu titik hook di sini = tidak perlu menyentuh ratusan tempat mutasi.
     Modul Sync dipasang di blok skrip ini juga (window.Sync), dan TIDAK
     pernah menggagalkan penyimpanan lokal kalau sedang offline. */
  try{ window.Sync && window.Sync.setelahSimpan && window.Sync.setelahSimpan(); }catch(e){ /* abaikan */ }
  try{ localStorage.setItem(DB_KEY, JSON.stringify(DB)); return true; }
  catch(e){
    console.warn('saveDB: penyimpanan perangkat penuh', e);
    try{ toast('Penyimpanan perangkat penuh — hapus sebagian foto atau kurangi jumlah gambar.'); }catch(_){}
    return false;
  }
}

const KATEGORI_MASUK = ['Infaq Jumat','Donasi/Sedekah','Zakat','Wakaf','Kotak Amal Harian','Lainnya'];
const KATEGORI_KELUAR = ['Listrik & Air','Kebersihan','Honor Marbot/Imam','Perbaikan & Perawatan','Kegiatan/Konsumsi','Sosial/Bantuan','Lainnya'];
/* Dua kategori ini TIDAK ada di pilihan form transaksi biasa — sengaja,
   supaya pinjaman hanya dicatat lewat tab Pinjaman dan tidak dobel. */
const KAS_KAT_PINJAM = 'Pinjam Kas';
const KAS_KAT_BAYAR = 'Bayar Pinjaman';
/* Penyaluran zakat: kategori kas OTOMATIS saat zakat uang disalurkan ke
   penerima — sengaja tidak masuk pilihan form transaksi biasa (anti dobel),
   sama seperti Pinjam Kas. */
const KAS_KAT_SALUR = 'Penyaluran Zakat';
/* Golongan penerima zakat (8 asnaf) untuk dropdown penyaluran. */
const ASNAF = ['Fakir','Miskin','Amil (panitia zakat)','Muallaf','Riqab','Gharim','Fisabilillah','Ibnu Sabil','Lainnya'];
/* Sub-jenis untuk kategori pemasukan tertentu (donasi, zakat, wakaf) —
   dropdown "Jenis" muncul otomatis kalau kategori itu dipilih; disimpan
   di field `sub` pada record kas dan tampil di daftar + detail. */
const SUB_KATEGORI_MASUK = {
  'Donasi/Sedekah': ['Donasi umum','Sedekah','Donasi untuk kegiatan','Lainnya'],
  /* Sub-jenis zakat mal (harta) sesuai klasifikasi BAZNAS/PMA 52/2014.
     "Zakat Fitrah" TIDAK ada di sini lagi — fitrah dicatat lewat tab 🤲 Zakat
     (modul sendiri, di luar kas), bukan lewat form transaksi biasa. */
  'Zakat': ['Uang & Tabungan','Emas & Perak','Perniagaan/Usaha','Penghasilan/Profesi','Pertanian & Hasil Bumi','Peternakan & Perikanan','Lainnya'],
  'Wakaf': ['Wakaf umum','Wakaf untuk pembangunan','Wakaf untuk pendidikan','Lainnya'],
};
/* Bentuk zakat (khusus kategori Zakat). Zakat fitrah pada dasarnya berupa
   beras / bahan makanan pokok (±2,5 kg atau 3,5 liter per jiwa) dan boleh
   diganti uang senilainya — PMA Kemenag No. 52/2014 & Fatwa MUI No. 65/2022.
   Kalau berupa barang: kolom "Banyaknya" (mis. 10 kg beras) muncul, dan
   kolom jumlah diisi perkiraan harganya dalam rupiah supaya tetap masuk
   laporan kas. Disimpan di field `bentuk` + `banyak`. */
const BENTUK_ZAKAT = ['Uang','Beras / bahan makanan'];
/* Panduan singkat nisab & kadar zakat per jenis — tampil otomatis di bawah
   dropdown "Jenis" saat kategori Zakat dipilih. Bahasa sehari-hari, angka dari
   SK Ketua BAZNAS No. 15/2026 (nisab penghasilan 2026) & klasifikasi umum. */
const PANDUAN_ZAKAT = {
  '': 'Rumus umum zakat harta: 2,5% dari harta yang disimpan selama setahun, minimal setara 85 gram emas.',
  'Uang & Tabungan': 'Simpanan yang sudah disimpan setahun dan nilainya setara 85 gram emas (±Rp91,7 juta) → zakatnya 2,5%.',
  'Emas & Perak': 'Emas/perak yang ditabung setahun, minimal 85 gram emas atau 595 gram perak → zakatnya 2,5%.',
  'Perniagaan/Usaha': 'Stok + kas usaha yang berputar setahun → zakatnya 2,5% (minimal setara 85 gram emas).',
  'Penghasilan/Profesi': 'Gaji/honor: nisab Rp91.681.728 setahun (atau Rp7.640.144 per bulan), zakat 2,5%. Angka nisab ikut harga emas, cek tiap tahun — SK BAZNAS 2026.',
  'Pertanian & Hasil Bumi': 'Hasil panen: potong 10% kalau pakai air hujan, 5% kalau pakai irigasi berbayar — langsung saat panen, tanpa nunggu setahun.',
  'Peternakan & Perikanan': 'Ternak yang diternakkan: minimal 30 kambing (atau 5 unta / 30 sapi), disimpan setahun → zakatnya 2,5%.',
  'Lainnya': 'Untuk jenis zakat lain (misalnya harta temuan), tanyakan dulu ke pengurus masjid atau lembaga zakat.'
};
/* Nilai otomatis zakat fitrah per jiwa (1447 H/2026): Rp50.000 atau 2,5 kg
   beras — SK Ketua BAZNAS No. 14/2026. Boleh disesuaikan ketetapan daerah. */
const FITRAH_TARIF = { uang: 50000, beras: 2.5 };
/* ---------- Zakat fitrah (modul sendiri, FASE 1) ----------
   Zakat fitrah dicatat TERPISAH dari kas: uang fitrah yang dikumpulkan maupun
   yang bersumber dari warga tidak pernah menyentuh DB.kas, jadi saldo kas,
   opname, dan laporan keuangan tidak ikut berubah.
   (Keputusan user: uang fitrah keluar total dari kas — bukan pengeluaran kas biasa.) */
const FITRAH_UANG = 'Uang';
const FITRAH_BERAS = 'Beras / bahan makanan';
const FITRAH_BENTUK = [FITRAH_UANG, FITRAH_BERAS];
/* Zakat fitrah hanya boleh diberikan kepada fakir dan miskin. */
const FITRAH_ASNAF = ['Fakir','Miskin'];
/* Angka bebas desimal: 2,5 kg → "2,5". */
const fmtNum = n => (Number(n)||0).toLocaleString('id-ID',{maximumFractionDigits:1});
const fmtBerat = n => fmtNum(n)+' kg';
/* Musim zakat fitrah = tahun hijriah, mis. "1447 H". */
function musimHijri(iso){
  try{
    const d = iso ? new Date(iso) : new Date();
    const s = new Intl.DateTimeFormat('id-u-ca-islamic-umalqura',{year:'numeric'}).format(d);
    const m = String(s).match(/(\d{3,4})/);
    return m ? m[1]+' H' : '';
  }catch(e){ return ''; }
}
/* Kategori pemasukan yang boleh diisi "Dari / pihak" (donatur) —
   disimpan di field `dari`. */
const KATEGORI_DENGAN_DARI = ['Donasi/Sedekah','Zakat','Wakaf'];
/* Sumber dana (sama dengan A.SUMBER di blok platform — di sini dipakai
   langsung oleh form transaksi di modal gabungan). */
const SUMBER_DANA = ['Tunai', 'Rekening Bank', 'QRIS / Dompet Digital'];
/* Zakat/donasi berupa barang (mis. beras) dicatat sebagai "Barang (bukan uang)":
   TIDAK dihitung ke saldo kas mana pun (tunai/bank/QRIS, opname, grafik,
   dashboard, laporan), tapi tetap muncul di daftar transaksi sebagai catatan
   zakat terkumpul. */
const SUMBER_BARANG = 'Barang (bukan uang)';
function kasDihitung(k){ return (k.sumber || 'Tunai') !== SUMBER_BARANG; }

/* ---------- SEED DATA (contoh awal, hanya jika kosong) ---------- */
function seedIfEmpty(){
  if(DB.kas.length || DB.jamaah.length) return false;
  const d = new Date();
  DB.kas = [
    {id:uid('k'), tanggal: nowISO(), tipe:'masuk', kategori:'Infaq Jumat', jumlah:1250000, keterangan:'Infaq shalat Jumat'},
    {id:uid('k'), tanggal: nowISO(), tipe:'keluar', kategori:'Listrik & Air', jumlah:350000, keterangan:'Tagihan listrik bulan ini'},
  ];
  DB.jamaah = [
    {id:uid('j'), nama:'Bpk. Suherman', telp:'0812xxxxxxx', alamat:'RT 02/RW 05', statusKeluarga:'Kepala Keluarga', catatan:''},
    {id:uid('j'), nama:'Pak RT 02', telp:'0813xxxxxxx', alamat:'RT 02/RW 05', statusKeluarga:'Pengurus/Takmir', catatan:''},
    {id:uid('j'), nama:'Bu Sri', telp:'0857xxxxxxx', alamat:'RT 01/RW 05', statusKeluarga:'Anggota Keluarga', catatan:''},
  ];
  DB.kegiatan = [
    {id:uid('e'), nama:'Kajian Rutin Ba\'da Maghrib', tanggal: new Date(d.getTime()+3*86400000).toISOString().slice(0,10), waktu:'18:15', pengisi:'Ust. Ahmad', tempat:'Aula Utama', catatan:'Tema: Adab Bertetangga', status:'akandatang'},
  ];
  DB.inventaris = [
    {id:uid('i'), nama:'Sound System Toa', kategori:'Elektronik', jumlah:2, kondisi:'ringan', kondisiRinci:{baik:1, ringan:1, berat:0}, lokasi:'Ruang Sound', catatan:''},
    {id:uid('i'), nama:'Karpet Sajadah', kategori:'Perlengkapan', jumlah:15, kondisi:'ringan', kondisiRinci:{baik:13, ringan:2, berat:0}, lokasi:'Gudang', catatan:'2 lembar mulai usang'},
  ];
  DB.pinjam = [
    {id:uid('p'), asetId:DB.inventaris[0].id, namaAset:'Sound System Toa', jenis:'pinjam', peminjam:'Pak Budi', kontak:'', jumlah:1, tglPinjam:todayStr(), tglRencana:'', status:'dipinjam', tglKembali:'', catatan:'Dipakai kajian RT'},
    {id:uid('p'), asetId:DB.inventaris[1].id, namaAset:'Karpet Sajadah', jenis:'laundry', peminjam:'Bu Sri', kontak:'', jumlah:5, tglPinjam:todayStr(), tglRencana:'', status:'dipinjam', tglKembali:'', catatan:'Dicuci jelang Jumat bersih'},
  ];
  /* Contoh pinjaman uang kas: uangnya ikut dicatat sebagai kas keluar,
     jadi saldo & laporan langsung benar tanpa dicatat dua kali. */
  const pkDemo = {
    id:uid('pk'), jamaahId:DB.jamaah[1].id, peminjam:DB.jamaah[1].nama, kontak:DB.jamaah[1].telp, jumlah:300000,
    tglPinjam:todayStr(), tglRencana:new Date(d.getTime()+7*86400000).toISOString().slice(0,10),
    keterangan:'Pinjam untuk kebersihan RT, dikembalikan minggu depan', bayar:[],
  };
  DB.pinjamKas = [pkDemo];
  DB.kas.push({id:uid('k'), tanggal: nowISO(), tipe:'keluar', kategori:KAS_KAT_PINJAM, jumlah:pkDemo.jumlah, keterangan:`Pinjaman kas oleh ${pkDemo.peminjam}`, refPinjam:pkDemo.id});
  saveDB();
  return true;
}

/* ---------- NAVIGASI ---------- */
const VIEW_TITLES = {
  dashboard:'Beranda', kas:'💰 Kas & Keuangan', kegiatan:'📅 Kegiatan & Kajian',
  jamaah:'🧑‍🤝‍🧑 Data Jamaah', inventaris:'📦 Inventaris', laporan:'📊 Laporan', settings:'⚙️ Pengaturan',
  website:'🌐 Website Masjid', bantuan:'📖 Bantuan'
};
let navStack = ['dashboard'];
function go(view){
  /* Gate fitur berlisensi (v1.5.6): view yang masuk CFG.proFeatures terkunci untuk akun tanpa lisensi.
     CATATAN: blok script ini di luar IIFE — pakai `Platform` (window.Platform), bukan `P`. */
  if (!Platform.requireFeature(view, (typeof VIEW_TITLES !== 'undefined' && VIEW_TITLES[view]) || view)) return;
  if(navStack[navStack.length-1] !== view) navStack.push(view);
  renderView(view);
  try { Platform.renderGateBadges(); } catch (e) { /* abaikan */ }
}
function renderView(view){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  const el = document.getElementById('view-'+view);
  if(el) el.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  /* View yang tidak punya tab sendiri (website, pengaturan, jamaah, inventaris,
     bantuan, keuangan — semuanya dibuka lewat sheet "Lainnya") menyalakan tab
     Lainnya, supaya posisi pengguna selalu terlihat. */
  const navBtn = document.querySelector(`.nav-item[data-view="${view}"]`)
    || document.querySelector('.nav-item[data-view="more"]');
  if(navBtn) navBtn.classList.add('active');
  if(el && view!=='dashboard'){
    let t = el.querySelector('.view-title');
    if(!t){ t = document.createElement('h2'); t.className = 'view-title'; el.prepend(t); }
    if(view === 'website'){
      /* Saklar modul website menempel di kanan JUDUL HALAMAN (bukan di dalam kartu) */
      t.classList.add('view-title-row');
      t.innerHTML = '';
      const kiri = document.createElement('span');
      kiri.textContent = VIEW_TITLES[view] || '';
      const kanan = document.createElement('span');
      kanan.className = 'view-title-act';
      kanan.innerHTML = '<span class="muted" id="websiteOnState" style="font-size:13px;"></span>'
        + '<label class="pf-switch" style="margin:0;"><input type="checkbox" id="setWebsiteOn" onchange="toggleWebsiteModule(this.checked)" aria-label="Aktifkan modul website"><i></i></label>';
      t.appendChild(kiri); t.appendChild(kanan);
    } else {
      t.classList.remove('view-title-row');
      t.textContent = VIEW_TITLES[view] || '';
    }
  }
  document.getElementById('appMain').scrollTop = 0;
  window.scrollTo(0,0);

  if(view==='dashboard') renderDashboard();
  if(view==='kas'){
    /* Gate (v1.5.6): kalau tab aktif saat ini terkunci (mis. Pinjaman pada versi gratis),
       halaman Kas mendarat di tab Semua yang tetap bisa diakses. Saklar "hide"
       juga memaksa mendarat di Semua (tabnya disembunyikan). */
    const fk = kasTabKey(kasTab);
    if (fk && (Platform.isPro(fk) || Platform.isHidden(fk))) kasTab = 'semua';
    setKasTab(kasTab);
  }
  if(view==='kegiatan') renderKegiatanList();
  if(view==='jamaah') renderJamaahList();
  if(view==='inventaris') setInvTab(invTab);
  if(view==='laporan'){
    /* Gate (v1.5.6): kalau range yang sedang aktif terkunci (mis. bulanan pada versi gratis),
       halaman mendarat di mode mingguan yang tetap bisa diakses. */
    const fk = lapRangeKey(lapRange);
    if (fk && Platform.isPro(fk)) { lapRange = 'mingguan'; lapNavOpen = false; }
    renderLaporan();
  }
  if(view==='website') renderWebsiteView();
  if(view==='settings') fillSettingsForm();
  if(view==='bantuan') renderBantuan();
}

/* ---------- BANTUAN (selaras kaki5: Tutorial | Video | S & K) ---------- */
const TUTORIALS = [
  {
    icon: '🚀',
    title: 'Memulai Pakai Aplikasi',
    content: `
      <p><b>Langkah Pertama:</b></p>
      <ol>
        <li>Buka aplikasinya — <b>masuk dengan No. WhatsApp + PIN</b> (belum punya akun? tab <b>Daftar</b> di layar yang sama); baca <b>Syarat & Ketentuan</b> kapan saja lewat tab <b>"📜 S & K"</b> di halaman Bantuan ini</li>
        <li>Isi <b>Nama Masjid</b>, <b>Alamat</b>, <b>Nama Ketua Takmir</b>, dan <b>No. WhatsApp Pengurus</b> di <b>Pengaturan → kartu 🕌 Data Masjid</b></li>
      </ol>
      <p><b>Isi Halaman Beranda:</b></p>
      <ul>
        <li>Kartu ringkasan kas: <b>💵 Tunai (brankas)</b>, <b>🏦 Rekening bank</b>, <b>📱 QRIS / dompet digital</b></li>
        <li>Kartu statistik hari ini & ringkasan kegiatan terdekat</li>
      </ul>
      <p><b>💡 Tips:</b> Menu bawah: <b>🏠 Beranda · 💰 Kas · 📅 Kegiatan · 📊 Laporan · ☰ Lainnya</b>.
      Halaman Bantuan ini dibuka dari tombol <b>📖</b> di pojok kanan atas.</p>`
  },
  {
    icon: '💰',
    title: 'Kas & Catat Transaksi',
    content: `
      <p><b>Halaman Kas</b> (tab <b>💰 Kas</b> di menu bawah) berisi tab <b>Semua / Pemasukan / Pengeluaran / Pinjaman</b>, kartu <b>Saldo Semua Sumber</b>, dan daftar transaksi.</p>
      <p><b>Mencatat transaksi:</b></p>
      <ol>
        <li>Tekan tombol <b>"+ Catat Transaksi"</b> di bar bawah halaman Kas</li>
        <li>Pilih jenis: <b>💰 Pemasukan</b> atau <b>🧾 Pengeluaran</b></li>
        <li>Isi <b>Kategori</b> (Infaq Jumat, Donasi/Sedekah, Listrik & Air, Honor Marbot/Imam, dll.), <b>Jumlah</b>, <b>Tanggal</b>, dan <b>Keterangan</b> (opsional)</li>
        <li>Tekan <b>Simpan</b> — saldo & laporan langsung terbarui</li>
      </ol>
      <p><b>Melihat / menghapus:</b> ketuk salah satu baris transaksi untuk membuka <b>Detail Transaksi</b> (tipe, kategori, tanggal, jumlah) — dari sana ada tombol <b>Hapus Transaksi</b>.</p>`
  },
  {
    icon: '🤝',
    title: 'Pinjaman Uang Kas',
    content: `
      <p>Kalau ada orang atau jamaah yang <b>meminjam uang kas masjid</b>, catat di tab <b>Pinjaman</b> pada halaman Kas — jangan lewat Catat Transaksi biasa supaya tidak dobel.</p>
      <ol>
        <li>Buka halaman <b>💰 Kas</b>, ketuk tab <b>Pinjaman</b></li>
        <li>Tekan tombol <b>🤝</b> di kanan bawah</li>
        <li><b>Pilih orangnya dari daftar jamaah</b> — jadi yang boleh meminjam hanya jamaah yang sudah terdaftar. Nomor HP/WA-nya langsung terisi otomatis dari profil jamaah (masih bisa diubah kalau nomornya beda)</li>
        <li>Isi <b>jumlah uang</b>, tanggal pinjam, dan rencana kembali (kalau ada)</li>
        <li>Kalau perlu, ambil <b>bukti foto</b> (mis. foto saat uang diserahkan atau foto KTP) lewat tombol 📷 — opsional</li>
        <li>Tekan <b>💾 Simpan</b> — uangnya otomatis tercatat keluar dari kas, jadi saldo langsung berkurang</li>
      </ol>
      <p><b>Saat uangnya dikembalikan:</b> buka baris pinjamannya, tekan <b>💵 Terima Bayar</b>, isi jumlah yang dibayar (boleh sebagian / dicicil) dan bisa lampirkan <b>bukti foto</b> pembayaran, lalu Simpan. Uangnya otomatis masuk lagi ke kas. Kalau sudah dibayar penuh, statusnya berubah jadi <b>Lunas</b>.</p>
      <p><b>Melihat bukti foto:</b> foto yang dilampirkan tampil di halaman detail pinjaman — ketuk fotonya untuk melihat ukuran penuh.</p>
      <p><b>Kalau salah catat:</b> buka pinjamannya lalu tekan <b>🗑️ Hapus</b>. Catatan kas yang ikut dibuat (uang keluar & pembayarannya) juga ikut terhapus, jadi saldo kembali seperti sebelumnya.</p>`
  },
  {
    icon: '🧮',
    title: 'Opname Kas',
    content: `
      <p><b>Opname Kas</b> = mencocokkan uang tunai fisik di brankas/kotak amal dengan catatan aplikasi. Hanya transaksi bersumber <b>Tunai</b> yang dihitung.</p>
      <ol>
        <li>Buka halaman <b>💰 Kas</b>, tekan tombol <b>"🧮 Opname Kas"</b> di bar bawah (berdampingan dengan Catat Transaksi)</li>
        <li>Bandingkan <b>Saldo tunai (catatan)</b> dengan hasil hitung manual</li>
        <li>Isi <b>Uang tunai fisik (hitung manual)</b> — baris <b>Selisih (fisik − catatan)</b> terisi otomatis</li>
        <li>Boleh isi <b>Catatan</b> (misal: dihitung bersama bendahara)</li>
        <li>Centang <b>"Catat selisih sebagai penyesuaian kas"</b> bila ingin selisih otomatis masuk sebagai transaksi penyesuaian, lalu tekan <b>Simpan Opname</b></li>
      </ol>
      <p>Riwayat opname terakhir (tanggal & selisih) tampil di bagian atas modal.</p>`
  },
  {
    icon: '📅',
    title: 'Kegiatan & Kajian',
    content: `
      <p>Halaman <b>📅 Kegiatan</b> punya tab <b>Akan Datang / Selesai / Semua</b>.</p>
      <ol>
        <li>Tekan tombol tambah kegiatan, isi <b>nama kegiatan</b>, <b>tanggal</b>, dan keterangan</li>
        <li>Kegiatannya rutin (mis. kajian tiap Jumat)? Buka <b>Jadwal diulang?</b> lalu pilih:
          <ul>
            <li><b>Tiap hari</b> — mis. pengajian setiap pagi</li>
            <li><b>Tiap minggu</b> — harinya boleh dicentang lebih dari satu (mis. Selasa dan Jumat)</li>
            <li><b>Tiap bulan</b> — dua pilihan: <b>Tanggal tetap</b> (mis. tiap tanggal 10) atau <b>Hari tetap</b> (mis. hari Jumat yang pertama, atau yang terakhir)</li>
            <li><b>Tiap tahun</b> — mis. peringatan tahunan</li>
          </ul>
          Lalu tentukan <b>Dibuat berapa kali</b> (maks. 52). Aplikasi langsung menunjukkan contoh tanggalnya sebelum kamu menekan Simpan.
        </li>
        <li>Setiap tanggal disimpan sendiri-sendiri, jadi bisa diubah, ditandai selesai, atau dihapus satu per satu</li>
        <li>Mau membatalkan seluruh rentetannya? Buka salah satu tanggal, lalu tekan <b>🔁 Hapus Semua Jadwal Ini</b></li>
        <li>Kegiatan yang tanggalnya sudah lewat otomatis pindah ke tab <b>Selesai</b></li>
      </ol>
      <p>Kegiatan yang dipublikasikan ikut tampil di <b>website masjid</b> (lihat tutorial 🌐) — website menampilkan <b>8 jadwal terdekat</b>.</p>`
  },
  {
    icon: '🧑‍🤝‍🧑',
    title: 'Data Jamaah & Inventaris',
    content: `
      <p><b>Jamaah</b> dan <b>Inventaris</b> dibuka dari menu <b>☰ Lainnya</b> di pojok kanan bawah.</p>
      <p><b>🧑‍🤝‍🧑 Data Jamaah:</b> simpan data jamaah/takmir; gunakan kotak <b>🔎 Cari jamaah...</b> di atas untuk mencari cepat berdasarkan nama.</p>
      <p><b>📦 Inventaris:</b> catat aset masjid (sound system, karpet, dll.) beserta jumlah & kondisinya. <b>Jumlahnya diisi per kondisi</b> — mis. 15 karpet: 13 baik, 2 rusak ringan, 1 rusak berat — totalnya dihitung otomatis. <b>Barang yang sedang keluar tidak ikut dihitung</b>: daftar aset menunjukkan sisa yang ada di tempat (mis. 9 dari 15), dan di form ada keterangan “sedang keluar N, ada di tempat M”. Ketuk item untuk mengubah, atau tambah lewat tombol tambah. Halaman ini punya 2 tab: <b>📦 Aset</b> (daftar barang) dan <b>🚪 Keluar</b> (riwayat barang keluar). Di tab Keluar, pakai tombol <b>+</b> untuk mencatat barang yang keluar, lalu pilih alasannya: <b>🤝 Dipinjam</b> (dipinjam orang), <b>🧺 Dilaundry</b> (dicuci dulu, mis. karpet & mukena), <b>🔧 Diperbaiki</b> (diservis, mis. sound system), atau <b>🚚 Dibawa acara</b> (dibawa untuk kegiatan). Isi nama orang/ tempatnya, lalu tekan Simpan. Kalau barangnya sudah balik, buka catatannya dan tekan <b>Sudah Kembali</b>. Setelah ditandai kembali, catatan itu <b>terkunci 🔒</b> — datanya tidak bisa diubah lagi, hanya bisa dilihat atau dihapus kalau memang salah catat.</p>`
  },
  {
    icon: '📊',
    title: 'Laporan',
    content: `
      <p>Halaman <b>📊 Laporan</b> merangkum uang masuk, uang keluar, dan saldo untuk periode yang dipilih.</p>
      <ul>
        <li>Pilih <b>Mingguan</b>, <b>Bulanan</b>, atau <b>Custom</b>. Ketuk tab yang sedang aktif untuk membuka pilihan tanggal/periode, ketuk lagi untuk menutupnya.</li>
        <li>Tiap kartu angka menyebut <b>jumlah transaksi</b>, <b>rata-rata per hari</b>, dan perbandingan dengan periode sebelumnya (naik/turun).</li>
        <li>Saldo dipisah jadi <b>Saldo Awal</b> dan <b>Saldo Akhir</b> periode, jadi laporan bulan lalu tidak memakai saldo hari ini.</li>
        <li><b>Uang pinjaman dipisah</b> dari pemasukan/pengeluaran: uang kas yang dipinjamkan orang bukan belanja masjid, dan uang yang kembali bukan donasi baru. Rinciannya ada di kartu <b>🤝 Uang Pinjaman</b>.</li>
        <li>Rincian <b>kategori</b> diberi persentase dan bar, ditambah <b>grafik tren</b> serta daftar transaksi periode itu (tekan <b>Lihat semua</b> kalau catatannya banyak).</li>
        <li>Tekan <b>🖨️ Cetak Laporan</b> untuk mencetak atau menyimpan PDF, dan <b>📤 Bagikan</b> untuk mengirim ringkasan ke grup WA.</li>
        <li>Laporan bulan berjalan juga bisa dikirim ke <b>website masjid</b> lewat modul Website</li>
      </ul>`
  },
  {
    icon: '⚙️',
    title: 'Pengaturan & Website Masjid',
    content: `
      <p><b>Pengaturan</b> dibuka dari menu <b>☰ Lainnya → ⚙️ Pengaturan</b>.</p>
      <ul>
        <li><b>🕌 Data Masjid</b> — nama, alamat, ketua takmir, WhatsApp pengurus</li>
        <li><b>🌐 Website Masjid</b> — aktifkan modul, isi <b>ID Website</b> & <b>Token Publikasi</b> dari pengelola website, lalu tekan <b>"🚀 Publikasikan"</b> untuk mengirim profil, jadwal kajian & laporan ke website publik. Bisa juga <b>"⬇️ Unduh JSON"</b> untuk arsip manual</li>
        <li><b>🔐 Lisensi</b> — status kuota gratis & aktivasi lisensi per perangkat</li>
      </ul>
      <p>💬 <b>Butuh bantuan lain?</b> Hubungi kami di <b>0881-6566-935</b> (WhatsApp).</p>`
  }
];
const BANTUAN_VIDEOS = [];
function renderBantuan(){
  const box = document.getElementById('bantuanContent');
  if(box && !box.dataset.done){
    box.innerHTML = TUTORIALS.map((t,i)=>`
      <div class="card">
        <button type="button" class="tut-head" onclick="toggleTutorial(${i})">
          <span class="tut-ic">${t.icon}</span>
          <div style="flex:1;font-weight:700;font-size:15px;">${t.title}</div>
          <span id="tut-${i}-arrow" class="tut-arrow">›</span>
        </button>
        <div id="tut-${i}" class="tut-body" style="display:none;">${t.content}</div>
      </div>`).join('');
    box.dataset.done = '1';
  }
  renderBantuanVideos();
}
function toggleTutorial(i){
  const body = document.getElementById('tut-'+i), arrow = document.getElementById('tut-'+i+'-arrow');
  const open = body.style.display !== 'none';
  document.querySelectorAll('#bantuanContent .tut-body').forEach(el=>el.style.display='none');
  document.querySelectorAll('#bantuanContent .tut-arrow').forEach(el=>el.classList.remove('open'));
  if(!open){ body.style.display='block'; arrow.classList.add('open'); }
}
function setBantuanTab(t){
  document.querySelectorAll('#view-bantuan .tab').forEach(el=>el.classList.toggle('active', el.dataset.b===t));
  document.getElementById('bantuanPanelTutorial').style.display = t==='tutorial'?'block':'none';
  document.getElementById('bantuanPanelVideo').style.display = t==='video'?'block':'none';
  document.getElementById('bantuanPanelTc').style.display = t==='tc'?'block':'none';
}
function renderBantuanVideos(){
  const box = document.getElementById('bantuanVideoList');
  if(!box) return;
  box.innerHTML = BANTUAN_VIDEOS.length ? BANTUAN_VIDEOS.map(v=>{
    const judul = esc(v.judul||'Video Tutorial');
    return `<div class="card"><div style="font-weight:700;margin-bottom:8px;">🎬 ${judul}</div><div class="vid-wrap"><iframe src="https://www.youtube-nocookie.com/embed/${v.id}" title="${judul}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div></div>`;
  }).join('') : `<div class="card"><p class="muted">🎬 Video tutorial akan segera hadir. Sementara ini, panduan lengkap tersedia di tab <b>📖 Tutorial</b>.</p></div>`;
}

/* ---------- SHEETS / MODAL ---------- */
/* ---------- Kunci gulir + kunci fokus saat lapisan penutup terbuka ----------
   Dua kebocoran yang diperbaiki (audit T2 & T3):
   1. Tab dari kontrol TERAKHIR di dalam modal melompat ke ".skip-link" yang
      tersembunyi di belakang tirai — pengguna keyboard/pembaca layar "keluar"
      dari modal tanpa sadar. Penanganannya ada di handler keydown di bawah.
   2. Halaman di belakang modal/menu ☰ masih bisa digulir, sehingga isi modal
      terasa "bergerak sendiri" saat tirai disentuh. */
/* Sengaja pakai var (bukan let): openModal bisa dipanggil saat inisialisasi
   sebelum baris deklarasi ini tereksekusi — dengan let itu TDZ error. */
var __overlayLocked = false, __overlayScrollTop = 0;
function syncOverlayState(){
  const bd = document.getElementById('modalBackdrop');
  const sh = document.getElementById('moreSheet');
  const mainEl = document.getElementById('appMain');
  const on = !!((bd && bd.classList.contains('open')) || (sh && sh.classList.contains('open')));
  if(on && !__overlayLocked){
    /* PENTING: posisi gulir HARUS dibaca SEBELUM class dipasang. `overflow:hidden`
       pada <html> langsung menghapus posisi gulir (terukur: 420 → 0), jadi kalau
       dibaca setelahnya hasilnya selalu 0 dan halaman balik ke atas. */
    __overlayScrollTop = window.scrollY || window.pageYOffset || (mainEl ? mainEl.scrollTop : 0);
    document.documentElement.classList.add('scroll-locked');
    document.body.style.top = (-__overlayScrollTop) + 'px';   // tampilan tidak melompat
    __overlayLocked = true;
  } else if(!on && __overlayLocked){
    document.documentElement.classList.remove('scroll-locked');
    document.body.style.top = '';
    window.scrollTo(0, __overlayScrollTop);   // posisi baca tidak hilang
    __overlayLocked = false;
  }
  /* Header / isi halaman / tab bawah tidak boleh difokus atau dibacakan
     pembaca layar selama tirai terbuka. Modal & menu ☰ sendiri tetap aktif
     karena berada di luar ketiga bagian itu. */
  ['appHeader','appMain','bottomNav'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.inert = on;
  });
}
/* Daftar elemen yang bisa difokus DI DALAM menu ☰, urut sesuai tampilan. */
function moreSheetFocusables(){
  const sh = document.getElementById('moreSheet');
  if(!sh) return [];
  const sel = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  return Array.prototype.filter.call(sh.querySelectorAll(sel), el => el.getClientRects().length > 0);
}
function openMoreSheet(){
  const bd = document.getElementById('moreBackdrop');
  bd._lastFocus = document.activeElement;      // ingat tombol ☰ untuk dipulangkan
  bd.classList.add('open');
  document.getElementById('moreSheet').classList.add('open');
  syncOverlayState();
  // pindahkan fokus ke item pertama (dulu fokus tetap di luar, di tombol ☰ yang inert)
  requestAnimationFrame(()=>{ const f = moreSheetFocusables()[0]; if(f) f.focus(); });
}
function closeMoreSheet(){
  const bd = document.getElementById('moreBackdrop');
  bd.classList.remove('open');
  document.getElementById('moreSheet').classList.remove('open');
  syncOverlayState();
  /* Pulangkan fokus ke tombol pembuka; kalau pembukanya bukan elemen yang bisa
     difokus (mis. dibuka lewat kode), jatuhkan ke tombol ☰ "Lainnya" supaya
     keyboard/pembaca layar tidak nyangkut di item yang sudah tertutup. */
  const buka = bd._lastFocus;
  bd._lastFocus = null;
  const target = (buka && document.contains(buka) && buka !== document.body && buka.focus) ? buka
    : document.querySelector('.nav-item[data-view="more"]');
  if(target && target.focus) target.focus();
}
/* Daftar elemen yang bisa difokus DI DALAM modal, urut sesuai tampilan. */
function modalFocusables(){
  const box = document.getElementById('modalBox');
  if(!box) return [];
  const sel = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  return Array.prototype.filter.call(box.querySelectorAll(sel), el => el.getClientRects().length > 0);
}
function openModal(html){
  const bd = document.getElementById('modalBackdrop');
  document.getElementById('modalBox').innerHTML = html;
  /* Tombol ✕ dibuat dari HTML inline tanpa teks — beri nama aksesibel supaya
     pembaca layar tidak hanya membacakan "✕" (dulu tanpa aria-label). */
  bd.querySelectorAll('.modal-close').forEach(el=>{
    if(!el.getAttribute('aria-label')) el.setAttribute('aria-label','Tutup');
    if(!el.getAttribute('title')) el.setAttribute('title','Tutup');
  });
  bd._lastFocus = document.activeElement;      // ingat elemen asal untuk dipulangkan
  bd.classList.add('open');
  syncOverlayState();
  // kembali ke atas setiap modal baru (isi modal berganti, posisi scroll lama jangan diwarisi)
  const box = document.getElementById('modalBox'); if (box) box.scrollTop = 0;
  // pindahkan fokus ke dalam modal (dulu fokus tetap di body)
  requestAnimationFrame(()=>{
    const f = modalFocusables()[0];
    if(f) f.focus();
  });
}
function closeModal(){
  const bd = document.getElementById('modalBackdrop');
  bd.classList.remove('open');
  syncOverlayState();
  if(bd._lastFocus && document.contains(bd._lastFocus)){ bd._lastFocus.focus(); bd._lastFocus = null; }
}
/* Escape menutup lapisan teratas; Tab berputar DI DALAM lapisan teratas
   (modal ATAU menu ☰) supaya fokus tidak bocor ke halaman yang inert. */
document.addEventListener('keydown', e=>{
  const bd = document.getElementById('modalBackdrop');
  const modalOpen = !!(bd && bd.classList.contains('open'));
  const sh = document.getElementById('moreSheet');
  const sheetOpen = !!(sh && sh.classList.contains('open'));
  if(e.key === 'Tab'){
    const box = modalOpen ? bd : (sheetOpen ? sh : null);
    if(!box) return;
    const f = modalOpen ? modalFocusables() : moreSheetFocusables();
    if(!f.length){ e.preventDefault(); return; }
    const first = f[0], last = f[f.length-1];
    const act = document.activeElement;
    if(e.shiftKey){
      if(act === first || !box.contains(act)){ e.preventDefault(); last.focus(); }
    }else{
      if(act === last || !box.contains(act)){ e.preventDefault(); first.focus(); }
    }
    return;
  }
  if(e.key !== 'Escape') return;
  if(modalOpen){ closeModal(); return; }
  if(sheetOpen) closeMoreSheet();
});
function toast(msg){
  const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=>t.classList.remove('show'), 2200);
}

/* =========================================================
   HELPERS
   ========================================================= */
function saldoKas(){ return DB.kas.reduce((a,k)=> !kasDihitung(k) ? a : a + (k.tipe==='masuk'?k.jumlah:-k.jumlah), 0); }
function fmtDateTime(iso){
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID',{day:'2-digit',month:'short'}) + ' ' + d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
}
function fmtDateOnly(str){
  if(!str) return '-';
  const d = new Date(str+'T00:00:00');
  return d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});
}

/* =========================================================
   DASHBOARD
   ========================================================= */
function renderDashboard(){
  sweepKegiatanSelesai();
  const now = new Date();

  /* (1) Baris "Hari Ini": tanggal Masehi + penanggalan hijriyah (tanpa info
         kegiatan — jumlah kegiatan hari ini tidak ditampilkan di sini) */
  const namaHari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][now.getDay()];
  const namaBulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][now.getMonth()];
  let hijri = '';
  try{ hijri = new Intl.DateTimeFormat('id-u-ca-islamic-umalqura',
    {day:'numeric',month:'long',year:'numeric'}).format(now); }catch(e){ hijri = ''; }
  document.getElementById('dashToday').innerHTML =
    `<span class="dt-date">${namaHari}, ${now.getDate()} ${namaBulan} ${now.getFullYear()}</span>` +
    (hijri ? `<span class="dt-hijri">${hijri}</span>` : '');

  /* (4) Pengingat backup: muncul bila belum pernah backup atau sudah >30 hari */
  renderDashBackup();

  const monthKas = DB.kas.filter(k=>{ if(!kasDihitung(k)) return false; const d=new Date(k.tanggal); return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear(); });
  const masuk = monthKas.filter(k=>k.tipe==='masuk').reduce((a,k)=>a+k.jumlah,0);
  const keluar = monthKas.filter(k=>k.tipe==='keluar').reduce((a,k)=>a+k.jumlah,0);
  document.getElementById('statSaldo').textContent = fmtRp(saldoKas());
  document.getElementById('statMasuk').textContent = fmtRp(masuk);
  document.getElementById('statKeluar').textContent = fmtRp(keluar);
  document.getElementById('statJamaah').textContent = DB.jamaah.length;

  /* (6) Sub-angka kartu: jumlah transaksi + perbandingan dengan bulan lalu
     (periode sama — dihitung sampai tanggal yang sama supaya adil) */
  const nMasuk = monthKas.filter(k=>k.tipe==='masuk').length;
  const nKeluar = monthKas.filter(k=>k.tipe==='keluar').length;
  const tglSama = now.getDate();
  const laluKas = DB.kas.filter(k=>{ if(!kasDihitung(k)) return false; const d=new Date(k.tanggal);
    return d.getMonth()===now.getMonth()-1 && d.getFullYear()===now.getFullYear() && d.getDate()<=tglSama; });
  const nilaiLalu = jn => laluKas.filter(k=>k.tipe===jn).reduce((a,k)=>a+k.jumlah,0);
  /* naikBagus=true → kenaikan ditandai hijau (pemasukan); false → kenaikan merah (pengeluaran) */
  const deltaTxt = (kini, lalu, naikBagus) => {
    if(!lalu) return '';
    const p = Math.round((kini-lalu)/lalu*100);
    if(!p) return ' · sama dengan bulan lalu';
    const bagus = naikBagus ? p>0 : p<0;
    return ` · <span class="${bagus?'up':'down'}">${p>0?'▲':'▼'}${Math.abs(p)}%</span> dari bulan lalu`;
  };
  document.getElementById('statSaldoSub').textContent = DB.kas.length ? `${DB.kas.length} transaksi tercatat` : 'Belum ada transaksi';
  document.getElementById('statMasukSub').innerHTML = `${nMasuk} transaksi${deltaTxt(masuk, nilaiLalu('masuk'), true)}`;
  document.getElementById('statKeluarSub').innerHTML = `${nKeluar} transaksi${deltaTxt(keluar, nilaiLalu('keluar'), false)}`;
  const nTelp = DB.jamaah.filter(j=>j.telp && String(j.telp).trim()).length;
  document.getElementById('statJamaahSub').textContent = nTelp ? `${nTelp} punya nomor HP` : 'Lengkapi data jamaah';

  /* (3) Ringkasan uang dipinjamkan: hanya tampil bila ada yang belum lunas */
  const utang = (DB.pinjamKas||[]).filter(p=>!pinjamKasLunas(p));
  document.getElementById('dashPinjWrap').innerHTML = utang.length ? `
    <button type="button" class="dash-pinj" onclick="setKasTab('pinjaman');go('kas')">
      <span class="ic">🤝</span>
      <span class="tx"><b>Dipinjam orang: ${fmtRp(totalPinjamKasAktif())}</b><span>${utang.length} belum lunas · ketuk untuk lihat rinciannya</span></span>
      <span class="arr" aria-hidden="true">›</span>
    </button>` : '';

  /* (8) Grafik batang mini 7 hari terakhir */
  renderDashChart7();

  const upcoming = DB.kegiatan.filter(e=>e.status==='akandatang').sort((a,b)=>a.tanggal.localeCompare(b.tanggal)).slice(0,4);
  /* (2) Kegiatan mendatang memakai badge hitung mundur: HARI INI / Besok / N hari lagi */
  document.getElementById('dashKegiatanList').innerHTML = upcoming.length ? upcoming.map(e=>kegiatanRowHTML(e,{hitungMundur:true})).join('') :
    `<div class="empty"><div class="ic">📅</div><div class="t">Belum ada kegiatan mendatang</div></div>`;

  const lastKas = DB.kas.slice(-5).reverse();
  document.getElementById('dashKasList').innerHTML = lastKas.length ? lastKas.map(kasRowHTML).join('') :
    `<div class="empty"><div class="ic">💰</div><div class="t">Belum ada transaksi kas</div></div>`;
}

/* Pengingat backup (v1.5.2): "Backup Sekarang" langsung mengunduh cadangan dan
   menyembunyikan pengingat; "Nanti" menunda 30 hari (dashPlat().backupNanti).
   Catatan: st() berada di dalam IIFE script 1 sehingga tidak terjangkau dari
   sini — field platform diakses langsung lewat dashPlat(). */
function dashPlat(){ if(!DB.platform) DB.platform = {}; return DB.platform; }
function renderDashBackup(){
  const box = document.getElementById('dashBackup');
  if(!box) return;
  const s = dashPlat(); const now = Date.now(); const HARI = 30*864e5;
  const terakhir = s.lastBackup ? Date.parse(s.lastBackup) : 0;
  const perluBackup = !terakhir || (now - terakhir) > HARI;
  if(!perluBackup || now < (s.backupNanti||0)){ box.hidden = true; return; }
  box.hidden = false;
  const ket = !terakhir ? 'Data belum pernah di-backup.'
    : `Backup terakhir ${Math.max(1, Math.floor((now-terakhir)/864e5))} hari lalu.`;
  box.innerHTML = `<div class="db-txt"><b>Waktunya backup data</b>${ket} Simpan cadangan supaya data tetap aman kalau ponsel hilang atau rusak.</div>
    <div class="db-act">
      <button class="btn btn-primary btn-sm" onclick="backupData();renderDashBackup()">Backup Sekarang</button>
      <button class="btn btn-secondary btn-sm" onclick="nantiBackup()">Nanti</button>
    </div>`;
}
function nantiBackup(){
  dashPlat().backupNanti = Date.now() + 30*864e5;
  saveDB();
  renderDashBackup();
}

/* Grafik batang mini 7 hari terakhir (v1.5.2): hijau = masuk, merah = keluar.
   Tinggi batang sebanding dengan nilai terbesar dalam 7 hari itu. */
function renderDashChart7(){
  const box = document.getElementById('dashChart7');
  if(!box) return;
  const namaHari = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
  const namaBln = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const rows = []; let max = 0, adaData = false, totM = 0, totK = 0;
  const now0 = new Date();
  for(let i=6;i>=0;i--){
    const d = new Date(now0.getFullYear(), now0.getMonth(), now0.getDate()-i);
    const iso = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    let m=0, k=0;
    DB.kas.forEach(t=>{ if(kasDihitung(t) && localDay(t.tanggal)===iso){ if(t.tipe==='masuk') m+=t.jumlah; else k+=t.jumlah; } });
    if(m||k) adaData = true;
    max = Math.max(max, m, k);
    totM += m; totK += k;
    rows.push({lbl:namaHari[d.getDay()], tgl:d.getDate(), m, k, iso,
      bln:d.getMonth(), thn:d.getFullYear()});
  }
  if(!adaData){
    box.innerHTML = `<div class="empty"><div class="ic">📊</div><div class="t">Belum ada transaksi 7 hari ini</div></div>`;
    return;
  }
  /* Periode untuk keterangan: "11–17 Nov 2026" atau lintas bulan
     "28 Nov – 4 Des 2026" */
  const a = rows[0], z = rows[6];
  const periode = (a.bln===z.bln)
    ? `${a.tgl}–${z.tgl} ${namaBln[z.bln]} ${z.thn}`
    : `${a.tgl} ${namaBln[a.bln]} – ${z.tgl} ${namaBln[z.bln]} ${z.thn}`;
  const selisih = totM - totK;
  /* Ringkasan di atas grafik: total 7 hari supaya langsung terbaca angkanya */
  box.innerHTML =
    `<div class="dc7-sum">
       <div class="s in" title="Total uang masuk 7 hari ini"><span>Masuk</span><b>${fmtRp(totM)}</b></div>
       <div class="s out" title="Total uang keluar 7 hari ini"><span>Keluar</span><b>${fmtRp(totK)}</b></div>
       <div class="s net ${selisih<0?'neg':''}" title="Hasil kurang uang masuk dikurangi uang keluar"><span>Selisih</span><b>${selisih<0?'−':'+'}${fmtRp(Math.abs(selisih))}</b></div>
     </div>` +
    `<div class="dc7">` + rows.map(r=>{
      const hm = r.m ? Math.max(5, Math.round(r.m/max*100)) : 0;
      const hk = r.k ? Math.max(5, Math.round(r.k/max*100)) : 0;
      return `<div class="dc7-col" title="${r.lbl} ${r.tgl} ${namaBln[r.bln]} · masuk ${fmtRp(r.m)} · keluar ${fmtRp(r.k)}">
        <div class="dc7-bars"><div class="dc7-bar in" style="height:${hm}%"></div><div class="dc7-bar out" style="height:${hk}%"></div></div>
        <div class="dc7-lbl">${r.lbl}<em>${r.tgl}/${r.bln+1}</em></div>
      </div>`;
    }).join('') + `</div><div class="dc7-legend"><span><i class="in"></i>Masuk</span><span><i class="out"></i>Keluar</span></div><div class="dc7-periode">${periode}</div>`;
}

/* =========================================================
   KAS & KEUANGAN
   ========================================================= */
let kasTab = 'semua';
/* Gate (v1.5.6): kunci per-tab Kas — "kas.pinjaman" & "kas.zakat". */
function kasTabKey(t){ return t === 'pinjaman' ? 'kas.pinjaman' : t === 'zakat' ? 'kas.zakat' : null; }
function setKasTab(t){
  const fk = kasTabKey(t);
  if (fk && Platform.isHidden(fk)) return; /* tab disembunyikan → tidak bisa dibuka */
  if (fk && !Platform.requireFeature(fk, (Platform.proFeatures[fk] || {}).label || t)) return;
  kasTab=t;
  document.querySelectorAll('#view-kas .tab').forEach(el=>el.classList.toggle('active', el.dataset.k===t));
  const fab = document.getElementById('kasFab');
  if(fab){
    if(t==='pinjaman'){
      fab.innerHTML='🤝'; fab.setAttribute('onclick',"openTransaksiForm('pinjam')"); fab.setAttribute('aria-label','Catat Pinjaman Kas');
    } else if(t==='zakat'){
      fab.innerHTML='🤲'; fab.setAttribute('onclick',"openZakatMenu()"); fab.setAttribute('aria-label','Tambah zakat');
    } else {
      fab.innerHTML='+'; fab.setAttribute('onclick',"openTransaksiForm('masuk')"); fab.setAttribute('aria-label','Catat Transaksi');
    }
  }
  renderKasList();
}
/* Ikon baris kas: pinjaman uang kas dibedakan (🤝) dari pengeluaran biasa (🧾)
   supaya kelihatan sekilas dan nyambung dengan tab Pinjaman. Uang masuk tetap 💰. */
function kasEmoji(k){
  if(!k) return '🧾';
  if(k.tipe === 'masuk') return '💰';
  return k.kategori === 'Pinjam Kas' ? '🤝' : k.kategori === KAS_KAT_SALUR ? '🤲' : '🧾';
}
function kasRowHTML(k){
  const isMasuk = k.tipe==='masuk';
  /* Sub-teks kiri hanya diisi keterangan; kalau kosong jangan diisi tanggal
     lagi — tanggal sudah tampil di kolom kanan (dulu tampil dua kali). */
  const sub = [k.sub, k.bentuk && k.bentuk!=='Uang' ? k.bentuk+(k.banyak?(' '+k.banyak):'') : '', k.dari?('dari '+k.dari):'', (k.keterangan||'').trim(), k.foto?'📷':''].filter(Boolean).join(' · ');
  return `<button type="button" class="list-item" style="cursor:pointer;" onclick="openTransaksiDetail('${k.id}')">
    <div class="avatar" style="background:${isMasuk?'var(--success-bg)':'var(--danger-bg)'};color:${isMasuk?'var(--success)':'var(--danger)'};">${kasEmoji(k)}</div>
    <div class="meta"><div class="t">${esc(k.kategori)}</div>${sub?`<div class="s">${esc(sub)}</div>`:''}</div>
    <div class="right"><div class="amt ${isMasuk?'plus':'minus'}">${isMasuk?'+':'-'}${fmtRp(k.jumlah)}</div><div class="s">${fmtDateTime(k.tanggal)}</div></div>
  </button>`;
}
/* Saldo hero: muatkan angka otomatis — perkecil font sampai teks tidak
   meluber ke tombol Opname (saldo besar di layar sempit dulu menimpanya).
   Kalau view sedang tersembunyi (clientWidth 0) dilewat; render berikutnya
   atau resize akan menghitung ulang. Batas bawah 15px, sisanya jadi ellipsis. */
function fitSaldo(el, text){
  if(!el) return;
  if(text != null){ el.textContent = text; el.dataset.val = text; }
  if(!el.clientWidth) return;
  el.style.fontSize = '';
  let size = parseFloat(getComputedStyle(el).fontSize) || 24;
  while(size > 15 && el.scrollWidth > el.clientWidth){ size--; el.style.fontSize = size + 'px'; }
}
window.addEventListener('resize', ()=>fitSaldo(document.getElementById('kasSaldoInline')));
function renderKasList(){
  fitSaldo(document.getElementById('kasSaldoInline'), fmtRp(saldoKas()));
  if(kasTab==='pinjaman'){ renderPinjamKasList(); return; }
  if(kasTab==='zakat'){ renderSalurZakat(); return; }
  let list = DB.kas.slice().reverse();
  if(kasTab!=='semua') list = list.filter(k=>k.tipe===kasTab);
  const wrap = document.getElementById('kasListWrap');
  wrap.innerHTML = (list.length ? list.map(kasRowHTML).join('') : `<div class="empty"><div class="ic">💰</div><div class="t">Belum ada transaksi</div></div>`);
}
/* =========================================================
   MODAL GABUNGAN (v1.5.2): Pemasukan · Pengeluaran · Pinjaman
   Satu modal "Catat Transaksi" dengan 3 tab. Form pinjaman kas
   (dulu openPinjamKasForm) pindah ke tab ketiga. */
let txPinjamId = '';
function openTransaksiForm(tipe, pinjamId){
  tipe = ['masuk','keluar','pinjam'].includes(tipe) ? tipe : 'masuk';
  txPinjamId = pinjamId || '';
  TX_FOTO = '';
  openModal(`
    <div class="modal-head"><h2>Catat Transaksi</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="tabs" role="tablist" style="margin-bottom:12px;">
      <button type="button" class="tab" id="txTabMasuk" onclick="setTxTab('masuk')">💰 Pemasukan</button>
      <button type="button" class="tab" id="txTabKeluar" onclick="setTxTab('keluar')">🧾 Pengeluaran</button>
      <button type="button" class="tab" id="txTabPinjam" onclick="setTxTab('pinjam')">🤝 Pinjaman</button>
    </div>
    <div id="txBody"></div>
  `);
  setTxTab(tipe);
}
function txBodyTransaksi(tipe){
  return `
    <input type="hidden" id="txTipe" value="${tipe}">
    <label>Kategori</label>
    <select id="txKategori" onchange="txKategoriChange()"></select>
    <label id="txSubLabel" class="hidden">Jenis</label>
    <select id="txSub" class="hidden" onchange="txSubChange()"></select>
    <p id="txPanduan" class="muted hidden" style="font-size:11.5px;line-height:1.5;margin:5px 0 0;"></p>
    <label id="txBentukLabel" class="hidden">Bentuk zakat</label>
    <select id="txBentuk" class="hidden" onchange="txBentukChange()">${BENTUK_ZAKAT.map(b=>`<option value="${b}">${b}</option>`).join('')}</select>
    <label id="txBanyakLabel" class="hidden">Banyaknya (kalau berupa barang)</label>
    <input type="text" id="txBanyak" class="hidden" placeholder="cth: 10 kg beras">
    <label id="txDariLabel" class="hidden">Dari / pihak (opsional)</label>
    <input type="text" id="txDari" class="hidden" placeholder="cth: H. Fulan">
    <label id="txSumberLabel">${tipe==='masuk'?'Masuk ke':'Dibayar dari'}</label>
    <select id="txSumber">${SUMBER_DANA.map(s=>`<option value="${s}">${s}</option>`).join('')}</select>
    <label id="txJumlahLabel">Jumlah (Rp)</label><input type="number" id="txJumlah" placeholder="0">
    <label>Tanggal</label><input type="date" id="txTanggal" value="${todayStr()}">
    <label>Keterangan (opsional)</label><textarea id="txKeterangan" placeholder="cth: Infaq shalat Jumat minggu ini"></textarea>
    <label>Bukti foto (opsional)</label>
    <input type="file" id="txFotoFile" accept="image/*" capture="environment" style="display:none" onchange="txFotoAmbil(this)">
    <button type="button" class="btn btn-secondary" onclick="document.getElementById('txFotoFile').click()">📷 Ambil Foto</button>
    <div id="txFotoBox" style="margin-top:8px;"></div>
    <div class="btn-row" style="margin-top:14px;"><button class="btn btn-primary" onclick="saveTransaksi()">Simpan</button></div>`;
}
function setTxTab(t){
  const body = document.getElementById('txBody'); if(!body) return;
  /* Klik tab yang sudah aktif: tidak perlu render ulang (data & foto di form
     tidak hilang). */
  const idAktif = {masuk:'txTabMasuk', keluar:'txTabKeluar', pinjam:'txTabPinjam'}[t];
  const aktif = document.getElementById(idAktif);
  if(aktif && aktif.classList.contains('active')) return;
  /* Pindah antar tab Pemasukan/Pengeluaran: nilai yang sudah diisi
     (jumlah, tanggal, keterangan) ikut terbawa, tidak hilang. */
  const lama = {};
  if(t!=='pinjam' && document.getElementById('txTipe')){
    ['txJumlah','txTanggal','txKeterangan'].forEach(id=>{ const el=document.getElementById(id); if(el) lama[id]=el.value; });
  }
  document.getElementById('txTabMasuk').classList.toggle('active', t==='masuk');
  document.getElementById('txTabKeluar').classList.toggle('active', t==='keluar');
  document.getElementById('txTabPinjam').classList.toggle('active', t==='pinjam');
  const p = t==='pinjam' ? (txPinjamId ? (DB.pinjamKas||[]).find(x=>x.id===txPinjamId) : null) : null;
  const head = document.querySelector('#modalBox .modal-head h2');
  if(head) head.textContent = t==='masuk' ? 'Catat Pemasukan' : t==='keluar' ? 'Catat Pengeluaran' : (p ? 'Ubah Pinjaman Kas' : 'Catat Pinjaman Kas');
  if(t==='pinjam'){
    PK_FOTO = (p && p.foto) || '';
    body.innerHTML = txBodyPinjam(p);
    fotoBoxHTML('pkFotoBox', PK_FOTO, 'pkFotoHapus');
    pkJamaahInfoSet();
    if(!p) pkJamaahChange();
  } else {
    body.innerHTML = txBodyTransaksi(t);
    fillTxKategori(t);
    ['txJumlah','txTanggal','txKeterangan'].forEach(id=>{ if(lama[id]!==undefined){ const el=document.getElementById(id); if(el) el.value=lama[id]; } });
    fotoBoxHTML('txFotoBox', TX_FOTO, 'txFotoHapus');
  }
}
function fillTxKategori(tipe){
  const el = document.getElementById('txKategori'); if(!el) return;
  const kategoris = tipe==='masuk' ? KATEGORI_MASUK : KATEGORI_KELUAR;
  el.innerHTML = kategoris.map(k=>`<option value="${k}">${k}</option>`).join('');
  txKategoriChange();
}
/* Tampilkan/sembunyikan dropdown "Jenis" dan kolom "Dari/pihak" sesuai
   kategori yang dipilih (hanya untuk pemasukan donasi/zakat/wakaf). */
function txKategoriChange(){
  const kat = (document.getElementById('txKategori')||{}).value || '';
  const subSel = document.getElementById('txSub'), subLbl = document.getElementById('txSubLabel');
  const subs = SUB_KATEGORI_MASUK[kat];
  if(subSel && subLbl){
    if(subs){
      subLbl.classList.remove('hidden'); subSel.classList.remove('hidden');
      subSel.innerHTML = subs.map(s=>`<option value="${s}">${s}</option>`).join('');
    } else { subLbl.classList.add('hidden'); subSel.classList.add('hidden'); }
  }
  const withDari = KATEGORI_DENGAN_DARI.includes(kat);
  const dariInp = document.getElementById('txDari'), dariLbl = document.getElementById('txDariLabel');
  if(dariInp && dariLbl){ dariLbl.classList.toggle('hidden', !withDari); dariInp.classList.toggle('hidden', !withDari); }
  /* Bentuk zakat hanya untuk kategori Zakat. Zakat mal (harta) umumnya
     berupa uang → default "Uang"; pengguna bisa ganti ke beras/bahan
     makanan (mis. hasil panen) lewat dropdown sendiri. */
  const isZakat = kat === 'Zakat';
  const bEl = document.getElementById('txBentuk'), bLbl = document.getElementById('txBentukLabel');
  if(bEl && bLbl){
    bLbl.classList.toggle('hidden', !isZakat); bEl.classList.toggle('hidden', !isZakat);
    if(isZakat) bEl.value = BENTUK_ZAKAT[0];
  }
  txBentukChange();
  txPanduanSet();
}
/* Baris panduan nisab/kadar di bawah dropdown "Jenis" — hanya untuk
   kategori Zakat, isinya tergantung jenis yang dipilih. */
function txPanduanSet(){
  const el = document.getElementById('txPanduan'); if(!el) return;
  const kat = (document.getElementById('txKategori')||{}).value || '';
  const sub = (document.getElementById('txSub')||{}).value || '';
  const teks = kat === 'Zakat' ? (PANDUAN_ZAKAT[sub] || PANDUAN_ZAKAT['']) : '';
  el.textContent = teks;
  el.classList.toggle('hidden', !teks);
}
/* Saat "Jenis" zakat diganti: bentuk balik ke default uang dan panduan
   di bawahnya ikut menyesuaikan jenis yang dipilih. */
function txSubChange(){
  const kat = (document.getElementById('txKategori')||{}).value || '';
  const bEl = document.getElementById('txBentuk');
  if(kat==='Zakat' && bEl && !bEl.classList.contains('hidden')){
    bEl.value = BENTUK_ZAKAT[0];
  }
  txBentukChange();
  txPanduanSet();
}
/* Kalau zakat berupa beras/bahan makanan: kolom "Banyaknya" muncul dan
   label jumlah jadi perkiraan harga (supaya tetap masuk laporan kas). */
function txBentukChange(){
  const bEl = document.getElementById('txBentuk');
  const barang = !!(bEl && !bEl.classList.contains('hidden') && bEl.value !== BENTUK_ZAKAT[0]);
  const bykLbl = document.getElementById('txBanyakLabel'), bykInp = document.getElementById('txBanyak');
  if(bykLbl && bykInp){ bykLbl.classList.toggle('hidden', !barang); bykInp.classList.toggle('hidden', !barang); }
  const jLbl = document.getElementById('txJumlahLabel');
  if(jLbl) jLbl.textContent = barang ? 'Perkiraan harga (Rp)' : 'Jumlah (Rp)';
  /* Kalau berupa barang: bukan uang tunai/bank/QRIS — sumber otomatis
     "Barang (bukan uang)" supaya tidak ikut menaikkan saldo kas. */
  const sEl = document.getElementById('txSumber'), sLbl = document.getElementById('txSumberLabel');
  if(sEl && sLbl){
    const tipe = (document.getElementById('txTipe')||{}).value || 'masuk';
    if(barang){ sLbl.textContent = 'Bukan uang — dicatat sebagai'; sEl.innerHTML = `<option value="${SUMBER_BARANG}">${SUMBER_BARANG}</option>`; }
    else { sLbl.textContent = tipe==='masuk' ? 'Masuk ke' : 'Dibayar dari'; sEl.innerHTML = SUMBER_DANA.map(s=>`<option value="${s}">${s}</option>`).join(''); }
  }
}
function saveTransaksi(){
  const tipe = document.getElementById('txTipe').value;
  const jumlah = Number(document.getElementById('txJumlah').value)||0;
  if(jumlah<=0){ toast('Jumlah harus lebih dari 0'); return; }
  const tgl = document.getElementById('txTanggal').value || todayStr();
  if(tgl > todayStr()){ toast('Tanggal tidak boleh di masa depan'); return; }
  const subEl = document.getElementById('txSub');
  const sub = (subEl && !subEl.classList.contains('hidden')) ? subEl.value : '';
  const dariEl = document.getElementById('txDari');
  const dari = (dariEl && !dariEl.classList.contains('hidden')) ? dariEl.value.trim() : '';
  const bentukEl = document.getElementById('txBentuk');
  const bentuk = (bentukEl && !bentukEl.classList.contains('hidden')) ? bentukEl.value : '';
  const banyakEl = document.getElementById('txBanyak');
  const banyak = (banyakEl && !banyakEl.classList.contains('hidden')) ? banyakEl.value.trim() : '';
  DB.kas.push({
    id: uid('k'), tanggal: new Date(tgl+'T'+new Date().toTimeString().slice(0,8)).toISOString(),
    tipe, kategori: document.getElementById('txKategori').value,
    jumlah, keterangan: document.getElementById('txKeterangan').value.trim(),
    foto: TX_FOTO || '', sub, dari, bentuk, banyak
  });
  saveDB(); closeModal();
  toast('Transaksi tersimpan');
  renderKasList(); renderDashboard();
}
function openTransaksiDetail(id){
  const k = DB.kas.find(x=>x.id===id);
  if(!k) return;
  openModal(`
    <div class="modal-head"><h2>Detail Transaksi</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="total-row"><span>Tipe</span><span class="badge ${k.tipe}">${k.tipe==='masuk'?'Pemasukan':'Pengeluaran'}</span></div>
    <div class="total-row"><span>Kategori</span><span>${esc(k.kategori)}</span></div>
    ${k.sub?`<div class="total-row"><span>Jenis</span><span>${esc(k.sub)}</span></div>`:''}
    ${k.bentuk && k.bentuk!=='Uang'?`<div class="total-row"><span>Bentuk</span><span>${esc(k.bentuk)}${k.banyak?(' · '+esc(k.banyak)):''}</span></div>`:''}
    ${k.dari?`<div class="total-row"><span>Dari / pihak</span><span>${esc(k.dari)}</span></div>`:''}
    <div class="total-row"><span>Tanggal</span><span>${fmtDateTime(k.tanggal)}</span></div>
    <div class="total-row big"><span>Jumlah</span><span>${fmtRp(k.jumlah)}</span></div>
    ${k.keterangan?`<hr class="sep"><p class="muted">${esc(k.keterangan)}</p>`:''}
    ${k.refPinjam
      ? fotoBaris('Bukti foto', k.foto) + `<p class="muted" style="margin-top:12px;">🔗 Transaksi ini dibuat otomatis dari <b>Pinjaman Kas</b>. Kalau mau diubah atau dihapus, lakukan dari tab <b>Pinjaman</b> supaya catatan pinjamannya tetap sinkron.</p>
         <div class="btn-row tx-act" style="margin-top:12px;"><button class="btn btn-primary" onclick="go('kas');setKasTab('pinjaman');closeModal()">Buka Pinjaman</button></div>`
      : k.refSalur
      ? `<p class="muted" style="margin-top:12px;">🔗 Transaksi ini dibuat otomatis dari <b>Penyaluran Zakat</b>. Kalau mau dihapus, lakukan dari tab <b>🤲 Zakat</b> supaya catatan penyalurannya tetap sinkron.</p>
         <div class="btn-row tx-act" style="margin-top:12px;"><button class="btn btn-primary" onclick="go('kas');setKasTab('zakat');closeModal()">Buka Zakat</button></div>`
      : `<hr class="sep">
         ${k.foto
           ? `<p class="muted" style="margin:0 0 6px;"><b>Bukti foto</b></p>
              <img class="bukti" src="${k.foto}" alt="Bukti foto transaksi" onclick="lihatFoto(this)">
              <div style="margin-top:6px;"><button type="button" class="btn btn-danger" style="width:auto;min-height:34px;padding:4px 12px;font-size:12.5px;" onclick="hapusFotoTransaksi('${k.id}')">Hapus Foto</button></div>`
           : `<input type="file" id="txFotoFileD" accept="image/*" capture="environment" style="display:none" onchange="txFotoAmbilDetail(this,'${k.id}')">
              <button type="button" class="btn btn-secondary" onclick="document.getElementById('txFotoFileD').click()">📷 Tambah Bukti Foto</button>`}
         <div class="btn-row tx-act" style="margin-top:14px;"><button class="btn btn-danger" onclick="askDeleteTransaksi('${k.id}')">Hapus Transaksi</button></div>`}
  `);
}
function deleteTransaksi(id){
  DB.kas = DB.kas.filter(x=>x.id!==id); saveDB(); closeModal(); renderKasList(); renderDashboard(); toast('Transaksi dihapus');
}
function askDeleteTransaksi(id){
  openModal(`
    <div class="modal-head"><h2>Hapus Transaksi?</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <p class="muted">Transaksi ini akan dihapus permanen.</p>
    <div class="btn-row" style="margin-top:14px;"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-danger" onclick="deleteTransaksi('${id}')">Ya, Hapus</button></div>
  `);
}

/* =========================================================
   PINJAMAN UANG KAS
   =========================================================
   Kadang ada orang/jamaah yang meminjam uang kas masjid. Pinjaman
   dicatat sebagai uang yang benar-benar keluar dari kas (pengeluaran
   "Pinjam Kas"), dan tiap pembayaran kembali dicatat sebagai pemasukan
   "Bayar Pinjaman". Jadi saldo kas dan laporan ikut benar sendiri —
   tidak perlu dicatat dua kali secara manual.
   Boleh dibayar bertahap (dicicil) sampai lunas. */
function totalBayarPinjamKas(p){ return (p.bayar||[]).reduce((a,b)=> a + (Number(b.jumlah)||0), 0); }
function sisaPinjamKas(p){ return Math.max(0, (Number(p.jumlah)||0) - totalBayarPinjamKas(p)); }
function pinjamKasLunas(p){ return sisaPinjamKas(p) <= 0; }
/* Berapa hari lewat dari rencana kembali (0 kalau belum lewat/lunas). */
function telatHariPinjamKas(p){
  if(pinjamKasLunas(p) || !p.tglRencana) return 0;
  const b = Math.floor((new Date(todayStr()+'T00:00:00') - new Date(p.tglRencana+'T00:00:00')) / 86400000);
  return b > 0 ? b : 0;
}
function totalPinjamKasAktif(){
  return (DB.pinjamKas||[]).filter(p=>!pinjamKasLunas(p)).reduce((a,p)=> a + sisaPinjamKas(p), 0);
}
function jumlahOrangPinjamKas(){ return (DB.pinjamKas||[]).filter(p=>!pinjamKasLunas(p)).length; }
function refreshKas(){ renderKasList(); renderDashboard(); }
/* Peminjam WAJIB orang yang sudah terdaftar di data jamaah. Disimpan sebagai
   `jamaahId`, sedangkan `peminjam` cuma salinan nama saat dicatat — jadi kalau
   profil jamaah nanti diubah namanya, yang tampil tetap nama terbaru. */
function jamaahById(id){ return (DB.jamaah||[]).find(j=>j.id===id); }
function jamaahByNama(nama){
  const n = String(nama||'').trim().toLowerCase();
  return n ? (DB.jamaah||[]).find(j=> String(j.nama||'').trim().toLowerCase() === n) : null;
}
function namaPeminjamKas(p){ const j = jamaahById(p && p.jamaahId); return j ? j.nama : ((p && p.peminjam) || '-'); }
function kontakPeminjamKas(p){ const j = jamaahById(p && p.jamaahId); return (p && p.kontak) || (j && j.telp) || ''; }

/* Samakan catatan kas dengan data pinjaman: selalu tepat satu pengeluaran
   "Pinjam Kas" per pinjaman (dibuat kalau belum ada, diperbarui kalau ada). */
function syncKasPinjam(p){
  const jumlah = Number(p.jumlah)||0;
  const tanggal = new Date((p.tglPinjam||todayStr())+'T'+new Date().toTimeString().slice(0,8)).toISOString();
  const k = DB.kas.find(x=> x.refPinjam===p.id && x.tipe==='keluar');
  const isi = { tanggal, tipe:'keluar', kategori:KAS_KAT_PINJAM, jumlah,
                keterangan:`Pinjaman kas oleh ${p.peminjam}`, refPinjam:p.id };
  if(k) Object.assign(k, isi);
  else DB.kas.push(Object.assign({id:uid('k')}, isi));
}

function renderPinjamKasList(){
  const wrap = document.getElementById('kasListWrap');
  const list = (DB.pinjamKas||[]).slice().sort((a,b)=> (b.tglPinjam||'').localeCompare(a.tglPinjam||''));
  const aktif = jumlahOrangPinjamKas();
  const sum = `<div class="pk-sum">
      <div class="l">Belum dikembalikan</div>
      <div class="v">${fmtRp(totalPinjamKasAktif())}</div>
      <div class="n">${aktif ? `${aktif} orang · uang kas berkurang selama belum dibayar` : 'Semua pinjaman sudah lunas'}</div>
    </div>`;
  const rows = list.map(p=>{
    const sisa = sisaPinjamKas(p);
    const lunas = sisa <= 0;
    const telat = telatHariPinjamKas(p);
    const badge = lunas ? 'lunas">Lunas' : (telat ? `telat">Telat ${telat} hari` : 'belum">Belum lunas');
    const sub = `Dipinjam ${fmtDateOnly(p.tglPinjam)}${p.tglRencana?` · rencana ${fmtDateOnly(p.tglRencana)}`:''}${p.foto?' · 📷':''}`;
    return `<button type="button" class="list-item" style="cursor:pointer;" onclick="openPinjamKasDetail('${p.id}')">
      <div class="avatar" style="background:var(--warning-bg);color:var(--warning);">🤝</div>
      <div class="meta">
        <div class="t">${esc(namaPeminjamKas(p))}</div>
        <div class="s">${sub}</div>
        <span class="badge ${badge}</span>
      </div>
      <div class="right"><div class="amt ${lunas?'':'minus'}">${fmtRp(sisa)}</div><div class="s">${lunas?'lunas':'sisa'}</div></div>
    </button>`;
  }).join('');
  wrap.innerHTML = sum + (list.length ? rows : `<div class="empty"><div class="ic">🤝</div><div class="t">Belum ada pinjaman kas</div></div>`);
}

/* ---------- Bukti foto ----------
   Foto disimpan sebagai gambar kecil di dalam data (bukan file terpisah),
   karena aplikasi jalan offline & datanya ikut saat dicadangkan. Dikecilkan
   dulu ke maksimal 900px / JPEG 0,7 supaya tidak menghabiskan penyimpanan. */
let PK_FOTO = '', PB_FOTO = '', TX_FOTO = '';
function fotoKecilkan(file, cb){
  if(!file) return;
  if(!/^image\//.test(file.type||'')){ toast('Pilih file foto (jpg/png)'); return; }
  const fr = new FileReader();
  fr.onload = () => {
    const img = new Image();
    img.onload = () => {
      const MAX = 900;
      const skala = Math.min(1, MAX / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width*skala));
      const h = Math.max(1, Math.round(img.height*skala));
      try{
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        cb(cv.toDataURL('image/jpeg', 0.7));
      }catch(e){ toast('Fotonya gagal diproses'); }
    };
    img.onerror = () => toast('Fotonya tidak bisa dibaca');
    img.src = fr.result;
  };
  fr.readAsDataURL(file);
}
function lihatFoto(el){
  const src = el && el.getAttribute('src'); if(!src) return;
  openModal(`
    <div class="modal-head"><h2>Bukti Foto</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <img class="bukti-full" src="${src}" alt="Bukti foto transaksi">
  `);
}
/* Kotak pratinjau foto di dalam form (dipakai pinjaman & pembayaran). */
function fotoBoxHTML(boxId, src, hapusFn){
  const el = document.getElementById(boxId); if(!el) return;
  el.innerHTML = src
    ? `<img class="bukti" src="${src}" alt="Bukti foto" onclick="lihatFoto(this)">
       <button type="button" class="btn btn-danger" style="margin-top:6px;min-height:34px;padding:4px 12px;font-size:12.5px;" onclick="${hapusFn}()">Hapus Foto</button>`
    : `<div class="muted" style="font-size:12px;">Belum ada foto.</div>`;
}
function pkFotoAmbil(inp){ fotoKecilkan(inp.files && inp.files[0], d=>{ PK_FOTO = d; fotoBoxHTML('pkFotoBox', PK_FOTO, 'pkFotoHapus'); }); inp.value=''; }
/* Bukti foto untuk transaksi pemasukan/pengeluaran (tab di modal gabungan). */
function txFotoAmbil(inp){ fotoKecilkan(inp.files && inp.files[0], d=>{ TX_FOTO = d; fotoBoxHTML('txFotoBox', TX_FOTO, 'txFotoHapus'); }); inp.value=''; }
function txFotoHapus(){ TX_FOTO = ''; fotoBoxHTML('txFotoBox', '', 'txFotoHapus'); }
/* Tambah bukti foto dari halaman detail transaksi (untuk transaksi lama). */
function txFotoAmbilDetail(inp, id){
  fotoKecilkan(inp.files && inp.files[0], d=>{
    const k = DB.kas.find(x=>x.id===id); if(!k) return;
    k.foto = d; saveDB(); toast('Bukti foto tersimpan');
    renderKasList(); renderDashboard(); openTransaksiDetail(id);
  });
  inp.value='';
}
function hapusFotoTransaksi(id){
  const k = DB.kas.find(x=>x.id===id); if(!k) return;
  k.foto = ''; saveDB(); toast('Foto dihapus');
  renderKasList(); renderDashboard(); openTransaksiDetail(id);
}
function pkFotoHapus(){ PK_FOTO = ''; fotoBoxHTML('pkFotoBox', '', 'pkFotoHapus'); }
function pbFotoAmbil(inp){ fotoKecilkan(inp.files && inp.files[0], d=>{ PB_FOTO = d; fotoBoxHTML('pbFotoBox', PB_FOTO, 'pbFotoHapus'); }); inp.value=''; }
function pbFotoHapus(){ PB_FOTO = ''; fotoBoxHTML('pbFotoBox', '', 'pbFotoHapus'); }
function fotoBaris(judul, src){
  return src ? `<hr class="sep"><p class="muted" style="margin:0 0 4px;"><b>${judul}</b></p>
    <img class="bukti" src="${src}" alt="${esc(judul)}" onclick="lihatFoto(this)">` : '';
}

/* Form pinjaman kas sekarang bagian tab "Pinjaman" pada modal gabungan
   "Catat Transaksi" (v1.5.2). Wrapper ini supaya pemanggil lama
   (FAB, tombol ubah di detail pinjaman) tetap jalan. */
function openPinjamKasForm(id){
  openTransaksiForm('pinjam', id || '');
}
/* Isi tab Pinjaman di modal gabungan — field sama seperti form pinjaman
   kas sebelumnya, hanya saja dirender ke dalam #txBody, bukan modal baru. */
function txBodyPinjam(p){
  /* Peminjam harus orang yang sudah terdaftar sebagai jamaah. */
  if(!p && !(DB.jamaah||[]).length){
    return `
    <p class="muted">Yang boleh meminjam uang kas adalah jamaah yang sudah terdaftar. Tambahkan dulu orangnya di menu <b>Jamaah</b>, lalu buka tab Pinjaman lagi.</p>
    <div class="btn-row" style="margin-top:14px;">
      <button class="btn btn-secondary" onclick="closeModal()">Tutup</button>
      <button class="btn btn-primary" onclick="closeModal();openJamaahForm()">Tambah Jamaah</button>
    </div>`;
  }
  const sudahBayar = p ? totalBayarPinjamKas(p) : 0;
  const kunci = sudahBayar > 0;   /* jumlah pokok dikunci kalau sudah ada pembayaran */
  /* Jamaah yang sedang terpilih: dari id tersimpan, atau dicocokkan namanya
     untuk catatan lama yang belum menyimpan id jamaah. */
  let pilih = p ? (p.jamaahId || (jamaahByNama(p.peminjam)||{}).id || '') : (DB.jamaah[0]||{}).id;
  const opsi = DB.jamaah.slice().sort((a,b)=> String(a.nama||'').localeCompare(String(b.nama||''),'id'))
    .map(j=>`<option value="${j.id}" ${pilih===j.id?'selected':''}>${esc(j.nama)}</option>`).join('');
  const belumTerdaftar = p && !pilih
    ? `<option value="" selected>${esc(p.peminjam)} — belum terdaftar, pilih yang benar</option>` : '';
  return `
    <label>Yang meminjam (dari daftar jamaah)</label>
    <select id="pkNama" onchange="pkJamaahChange()">${belumTerdaftar}${opsi}</select>
    <div class="kon-total" id="pkJamaahInfo"></div>
    <label>Kontak / WA</label><input type="text" id="pkKontak" inputmode="tel" value="${p?esc(p.kontak||''):''}" placeholder="otomatis dari profil jamaah">
    <label>Jumlah uang yang dipinjam (Rp)</label>
    <input type="number" id="pkJumlah" min="1" inputmode="numeric" value="${p?(Number(p.jumlah)||0):''}" placeholder="0" ${kunci?'disabled':''}>
    ${kunci?`<div class="kon-total">Jumlahnya tidak bisa diubah karena sudah ada pembayaran masuk (${fmtRp(sudahBayar)}).</div>`
           :`<div class="kon-total">Paling banyak uang yang ada di kas: <b>${fmtRp(saldoKas() + (p?Number(p.jumlah)||0:0))}</b></div>`}
    <div class="field-row">
      <div><label>Tanggal pinjam</label><input type="date" id="pkTgl" value="${p?esc(p.tglPinjam||todayStr()):todayStr()}"></div>
      <div><label>Rencana kembali</label><input type="date" id="pkRencana" value="${p?esc(p.tglRencana||''):''}"></div>
    </div>
    <label>Keterangan (opsional)</label><textarea id="pkKet" placeholder="cth: untuk kebersihan RT, dikembalikan minggu depan">${p?esc(p.keterangan||''):''}</textarea>
    <label>Bukti foto (opsional)</label>
    <input type="file" id="pkFotoFile" accept="image/*" capture="environment" style="display:none" onchange="pkFotoAmbil(this)">
    <button type="button" class="btn btn-secondary" onclick="document.getElementById('pkFotoFile').click()">📷 Ambil Foto</button>
    <div id="pkFotoBox" style="margin-top:8px;"></div>
    <div class="btn-row" style="margin-top:14px;">
      ${p?`<button class="btn btn-danger" onclick="askDeletePinjamKas('${p.id}')">Hapus</button>`:''}
      <button class="btn btn-primary" onclick="savePinjamKas('${p?p.id:''}')">💾 Simpan</button>
    </div>`;
}

/* Tampilkan ringkasan profil jamaah yang dipilih (status, alamat, no. HP). */
function pkJamaahInfoSet(){
  const j = jamaahById((document.getElementById('pkNama')||{}).value);
  const info = document.getElementById('pkJamaahInfo'); if(!info) return;
  if(!j){ info.innerHTML = 'Pilih dulu jamaah yang meminjam.'; return; }
  const bagian = [j.statusKeluarga || 'Jamaah'];
  if(j.alamat) bagian.push(esc(j.alamat));
  bagian.push(j.telp ? esc(j.telp) : '<i>belum ada no. HP di profil</i>');
  info.innerHTML = bagian.join(' · ');
}
/* Ganti jamaah → kontak/WA ikut terisi dari profilnya. */
function pkJamaahChange(){
  const j = jamaahById((document.getElementById('pkNama')||{}).value);
  const kon = document.getElementById('pkKontak');
  if(kon) kon.value = j ? (j.telp || '') : '';
  pkJamaahInfoSet();
}

function savePinjamKas(id){
  const p = id ? (DB.pinjamKas||[]).find(x=>x.id===id) : null;
  const j = jamaahById((document.getElementById('pkNama')||{}).value);
  if(!j){ toast('Pilih dulu jamaah yang meminjam'); return; }
  const kontak = document.getElementById('pkKontak').value.trim() || j.telp || '';
  const tgl = document.getElementById('pkTgl').value || todayStr();
  const rencana = document.getElementById('pkRencana').value || '';
  const ket = document.getElementById('pkKet').value.trim();
  if(tgl > todayStr()){ toast('Tanggal pinjam tidak boleh di masa depan'); return; }
  const jumlahLama = p ? (Number(p.jumlah)||0) : 0;
  const sudahBayar = p ? totalBayarPinjamKas(p) : 0;
  const jumlah = sudahBayar > 0 ? jumlahLama : (Number(document.getElementById('pkJumlah').value)||0);
  if(jumlah <= 0){ toast('Jumlah uangnya diisi dulu'); return; }
  /* Uang yang dipinjam tidak boleh melebihi isi kas — kalau tidak, saldo jadi minus.
     Saat mengubah pinjaman lama, pengeluarannya sendiri tidak dihitung sebagai "berkurang". */
  const adaDiKas = saldoKas() + jumlahLama;
  if(jumlah > adaDiKas){ toast(`Uang kas tidak cukup. Yang ada ${fmtRp(adaDiKas)}`); return; }
  const data = { jamaahId:j.id, peminjam:j.nama, kontak, jumlah, tglPinjam:tgl, tglRencana:rencana, keterangan:ket, foto:PK_FOTO||'' };
  if(p){
    Object.assign(p, data);
    syncKasPinjam(p);
  } else {
    const baru = Object.assign({id:uid('pk'), bayar:[]}, data);
    DB.pinjamKas.push(baru);
    syncKasPinjam(baru);
  }
  saveDB(); closeModal(); refreshKas();
  toast(p ? 'Pinjaman diperbarui' : 'Pinjaman dicatat — uang kas berkurang');
}

function openPinjamKasDetail(id){
  const p = (DB.pinjamKas||[]).find(x=>x.id===id); if(!p) return;
  const sisa = sisaPinjamKas(p), bayar = totalBayarPinjamKas(p), lunas = sisa <= 0, telat = telatHariPinjamKas(p);
  const riwayat = (p.bayar||[]).length
    ? p.bayar.slice().reverse().map(b=>`<div class="total-row"><span>${fmtDateOnly(b.tanggal)}${b.catatan?` · ${esc(b.catatan)}`:''}</span><span style="color:var(--success);font-weight:800;">${fmtRp(b.jumlah)}</span></div>${b.foto?`<img class="bukti" style="max-height:150px;" src="${b.foto}" alt="Bukti pembayaran" onclick="lihatFoto(this)">`:''}`).join('')
    : `<p class="muted" style="margin:6px 0 0;">Belum ada pembayaran masuk.</p>`;
  const jm = jamaahById(p.jamaahId);
  openModal(`
    <div class="modal-head"><h2>🤝 Pinjaman Kas</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="total-row"><span>Peminjam</span><span>${esc(namaPeminjamKas(p))}</span></div>
    ${jm?`<div class="total-row"><span>Profil jamaah</span><span>${esc(jm.statusKeluarga||'Jamaah')}${jm.alamat?` · ${esc(jm.alamat)}`:''}</span></div>`:''}
    ${kontakPeminjamKas(p)?`<div class="total-row"><span>Kontak</span><span>${esc(kontakPeminjamKas(p))}</span></div>`:''}
    <div class="total-row"><span>Tgl pinjam</span><span>${fmtDateOnly(p.tglPinjam)}</span></div>
    ${p.tglRencana?`<div class="total-row"><span>Rencana kembali</span><span>${fmtDateOnly(p.tglRencana)}${telat?` · <b style="color:var(--danger);">telat ${telat} hari</b>`:''}</span></div>`:''}
    <div class="total-row"><span>Uang dipinjam</span><span>${fmtRp(p.jumlah)}</span></div>
    <div class="total-row"><span>Sudah dibayar</span><span style="color:var(--success);font-weight:800;">${fmtRp(bayar)}</span></div>
    <div class="total-row big"><span>Sisa</span><span>${fmtRp(sisa)}</span></div>
    ${p.keterangan?`<hr class="sep"><p class="muted">${esc(p.keterangan)}</p>`:''}
    ${fotoBaris('Bukti foto saat uang diserahkan', p.foto)}
    <hr class="sep">
    <p class="muted" style="margin:0 0 2px;"><b>Riwayat pembayaran</b></p>
    ${riwayat}
    <div class="btn-row" style="margin-top:14px;">
      <button class="btn btn-danger btn-round btn-em" title="Hapus pinjaman" aria-label="Hapus pinjaman" onclick="askDeletePinjamKas('${p.id}')">🗑️</button>
      <button class="btn btn-secondary btn-round btn-em" title="Ubah data pinjaman" aria-label="Ubah data pinjaman" onclick="openPinjamKasForm('${p.id}')">✏️</button>
      ${lunas ? `<button class="btn btn-primary" onclick="closeModal()">Tutup</button>`
              : `<button class="btn btn-hijau" onclick="openBayarPinjamKas('${p.id}')">💵 Terima Bayar</button>`}
    </div>
  `);
}

function openBayarPinjamKas(id){
  const p = (DB.pinjamKas||[]).find(x=>x.id===id); if(!p) return;
  const sisa = sisaPinjamKas(p);
  if(sisa <= 0){ toast('Pinjaman ini sudah lunas'); return; }
  PB_FOTO = '';
  openModal(`
    <div class="modal-head"><h2>Terima Pembayaran</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <p class="muted" style="margin-top:-2px;">Pinjaman <b>${esc(namaPeminjamKas(p))}</b> · sisa <b>${fmtRp(sisa)}</b> dari ${fmtRp(p.jumlah)}.
    Boleh dibayar sebagian dulu.</p>
    <label>Jumlah dibayar (Rp)</label><input type="number" id="pbJumlah" min="1" inputmode="numeric" value="${sisa}" placeholder="0">
    <label>Tanggal terima</label><input type="date" id="pbTgl" value="${todayStr()}">
    <label>Catatan (opsional)</label><input type="text" id="pbKet" placeholder="cth: dicicil dulu">
    <label>Bukti foto (opsional)</label>
    <input type="file" id="pbFotoFile" accept="image/*" capture="environment" style="display:none" onchange="pbFotoAmbil(this)">
    <button type="button" class="btn btn-secondary" onclick="document.getElementById('pbFotoFile').click()">📷 Ambil Foto</button>
    <div id="pbFotoBox" style="margin-top:8px;"></div>
    <div class="btn-row" style="margin-top:14px;">
      <button class="btn btn-secondary" onclick="openPinjamKasDetail('${p.id}')">Batal</button>
      <button class="btn btn-primary" onclick="saveBayarPinjamKas('${p.id}')">💾 Simpan</button>
    </div>
  `);
  fotoBoxHTML('pbFotoBox', PB_FOTO, 'pbFotoHapus');
}

function saveBayarPinjamKas(id){
  const p = (DB.pinjamKas||[]).find(x=>x.id===id); if(!p) return;
  const sisa = sisaPinjamKas(p);
  const tgl = document.getElementById('pbTgl').value || todayStr();
  if(tgl > todayStr()){ toast('Tanggal tidak boleh di masa depan'); return; }
  const jumlah = Number(document.getElementById('pbJumlah').value)||0;
  if(jumlah <= 0){ toast('Jumlahnya diisi dulu'); return; }
  if(jumlah > sisa){ toast(`Paling banyak ${fmtRp(sisa)} (sisa pinjaman)`); return; }
  const b = {id:uid('pb'), tanggal:tgl, jumlah, catatan:document.getElementById('pbKet').value.trim(), foto:PB_FOTO||''};
  p.bayar = p.bayar || []; p.bayar.push(b);
  DB.kas.push({
    id:uid('k'),
    tanggal: new Date(tgl+'T'+new Date().toTimeString().slice(0,8)).toISOString(),
    tipe:'masuk', kategori:KAS_KAT_BAYAR, jumlah,
    keterangan:`Pembayaran pinjaman ${namaPeminjamKas(p)}`, refPinjam:p.id, refBayar:b.id,
  });
  saveDB(); closeModal(); refreshKas();
  toast(pinjamKasLunas(p) ? 'Lunas — uang kas kembali penuh' : 'Pembayaran dicatat');
}

function askDeletePinjamKas(id){
  const p = (DB.pinjamKas||[]).find(x=>x.id===id); if(!p) return;
  const ikut = DB.kas.filter(k=>k.refPinjam===id).length;
  openModal(`
    <div class="modal-head"><h2>Hapus Pinjaman?</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <p class="muted">Catatan pinjaman <b>${esc(namaPeminjamKas(p))}</b> akan dihapus permanen${ikut?`, termasuk ${ikut} catatan kas yang terhubung (uang keluar & pembayarannya). Saldo kas kembali seperti sebelum pinjaman dicatat.`:'.'}</p>
    <div class="btn-row" style="margin-top:14px;"><button class="btn btn-secondary" onclick="openPinjamKasDetail('${p.id}')">Batal</button><button class="btn btn-danger" onclick="deletePinjamKas('${p.id}')">Ya, Hapus</button></div>
  `);
}

function deletePinjamKas(id){
  DB.kas = DB.kas.filter(k=>k.refPinjam!==id);
  DB.pinjamKas = (DB.pinjamKas||[]).filter(x=>x.id!==id);
  saveDB(); closeModal(); refreshKas(); toast('Pinjaman dihapus — catatan kasnya ikut dibersihkan');
}

/* =========================================================
   PENYALURAN ZAKAT
   Zakat yang terkumpul di masjid (uang di kas / beras di gudang) dicatat
   penyalurannya ke penerima (mustahik). Penyaluran zakat UANG otomatis
   mengurangi kas (dibuat record pengeluaran kategori "Penyaluran Zakat"
   + refSalur); penyaluran BARANG tidak menyentuh kas sama sekali.
   ========================================================= */
/* Parsing kolom "Banyaknya" (mis. "10 kg beras") jadi angka + satuan supaya
   sisa zakat barang bisa dihitung otomatis. */
function parseBanyak(teks){
  const m = String(teks||'').match(/(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)?/);
  if(!m) return { jml:0, sat:'' };
  return { jml:Number(m[1].replace(',','.'))||0, sat:(m[2]||'').toLowerCase() };
}
/* Catatan zakat fitrah lama (sebelum ada modul fitrah) tetap disimpan di
   riwayat kas, tapi TIDAK ikut dihitung sebagai "zakat lainnya" — zakat
   fitrah sekarang punya modul sendiri (DB.fitrah + salurZakat fitrah). */
const zakatMasukList = () => (DB.kas||[]).filter(k=>k.tipe==='masuk' && k.kategori==='Zakat' && k.sub!=='Zakat Fitrah');
function zakatUangTerkumpul(){ return zakatMasukList().filter(k=>kasDihitung(k)).reduce((a,k)=>a+Number(k.jumlah||0),0); }
function zakatUangTersalur(){ return (DB.salurZakat||[]).filter(s=>s.jenisZakat!=='fitrah' && s.bentuk==='Uang').reduce((a,s)=>a+Number(s.jumlah||0),0); }
function sisaZakatUang(){ return Math.max(0, zakatUangTerkumpul()-zakatUangTersalur()); }
/* Zakat barang per satuan (kg, liter, dst) — dihitung dari angka pertama
   pada kolom "Banyaknya" (mis. "10 kg beras" → 10 kg). */
function zakatBarangPerSatuan(){
  const m = {};
  zakatMasukList().filter(k=>k.bentuk && k.bentuk!=='Uang').forEach(k=>{
    const p = parseBanyak(k.banyak); if(p.jml>0){ const s=p.sat||'pcs'; (m[s]=m[s]||{terkumpul:0,tersalur:0}).terkumpul+=p.jml; }
  });
  /* Zakat barang yang sudah salurkan: HANYA zakat lainnya (mal). Saluran
     fitrah punya modul sendiri (DB.fitrah + DB.salurZakat jenis fitrah),
     jadi tidak boleh ikut mengurangi sisa zakat barang. */
  (DB.salurZakat||[]).filter(s=>s.bentuk && s.bentuk!=='Uang' && s.jenisZakat!=='fitrah').forEach(s=>{
    const p = parseBanyak(s.banyak); if(p.jml>0){ const k=p.sat||'pcs'; (m[k]=m[k]||{terkumpul:0,tersalur:0}).tersalur+=p.jml; }
  });
  return m;
}
function sisaZakatBarangTeks(){
  const daftar = Object.entries(zakatBarangPerSatuan()).map(([sat,v])=>`${(v.terkumpul-v.tersalur).toLocaleString('id-ID')} ${sat}`);
  return daftar.length ? daftar.join(', ') : '';
}
/* ---------- Perhitungan zakat fitrah ----------
   Pengumpulan fitrah disimpan di DB.fitrah (tipe 'kumpul'), sedangkan
   Penyaluran fitrah disimpan di DB.salurZakat dengan jenisZakat='fitrah'
   (tanpa record kas). Jadi fitrah tidak pernah dobel tercatat. */
const fitrahKumpul = () => (DB.fitrah||[]).filter(f=>f.tipe!=='salur');
/* Total fitrah terkumpul (jumlah jiwa × nilai per jiwa) satu musim & bentuk. */
function fitrahTerkumpul(musim, bentuk){
  return fitrahKumpul()
    .filter(f=>(!musim||f.musim===musim)&&(!bentuk||f.bentuk===bentuk))
    .reduce((a,f)=>a+(Number(f.jiwa)||0)*(Number(f.nilai)||0),0);
}
/* Total fitrah yang sudah salurkan (dari DB.salurZakat jenis fitrah). */
function fitrahTersalur(musim, bentuk){
  return (DB.salurZakat||[]).filter(s=>s.jenisZakat==='fitrah'&&(!musim||s.musim===musim)&&(!bentuk||s.bentuk===bentuk))
    .reduce((a,s)=>a+fitrahNilaiRecord(s),0);
}
function fitrahNilaiRecord(s){
  if(s.bentuk==='Uang') return Number(s.jumlah||0);
  return parseBanyak(s.banyak).jml||0;
}
/* Jumlah jiwa di satu musim (sisi: 'kumpul' atau 'salur'). */
function fitrahJiwa(musim, sisi){
  if(sisi==='kumpul') return fitrahKumpul().filter(f=>!musim||f.musim===musim).reduce((a,f)=>a+(Number(f.jiwa)||0),0);
  return (DB.salurZakat||[]).filter(s=>s.jenisZakat==='fitrah'&&(!musim||s.musim===musim)).reduce((a,s)=>a+(Number(s.jiwa)||0),0);
}
/* Musim yang sedang ditampilkan (default: musim hijriah bulan ini). */
let fitrahMusim = '';
function fitrahMusimAktif(){ return fitrahMusim || musimHijri() || ''; }
function fitrahMusimSet(v){ fitrahMusim = v||''; renderSalurZakat(); }
/* Daftar musim untuk dropdown: musim sekitar sekarang + musim yang punya data. */
function musimOpsi(pilih){
  const set = new Set();
  const now = Date.now();
  for(let d=-730; d<=731; d+=30){ const m = musimHijri(new Date(now+d*86400000)); if(m) set.add(m); }
  fitrahKumpul().forEach(f=>{ if(f.musim) set.add(f.musim); });
  (DB.salurZakat||[]).forEach(s=>{ if(s.jenisZakat==='fitrah'&&s.musim) set.add(s.musim); });
  if(!set.size) set.add(musimHijri()||(new Date().getFullYear()+' M'));
  const arr = Array.from(set).sort((a,b)=>parseInt(b,10)-parseInt(a,10));
  const p = pilih || arr[0];
  return arr.map(m=>`<option value="${m}"${m===p?' selected':''}>${m}</option>`).join('');
}
function renderSalurZakat(){
  const wrap = document.getElementById('kasListWrap');
  const list = (DB.salurZakat||[]).slice().reverse();
  const sisaBrg = sisaZakatBarangTeks();
  const musim = fitrahMusimAktif();
  const kUang = fitrahTerkumpul(musim,FITRAH_UANG), sUang = fitrahTersalur(musim,FITRAH_UANG);
  const kBerat = fitrahTerkumpul(musim,FITRAH_BERAS), sBerat = fitrahTersalur(musim,FITRAH_BERAS);
  const sisaUangF = Math.max(0,kUang-sUang), sisaBeratF = Math.max(0,kBerat-sBerat);
  const sisaF = sisaUangF>0 ? fmtRp(sisaUangF) : (sisaBeratF>0 ? fmtBerat(sisaBeratF) : 'Belum ada');
  const kumpul = fitrahKumpul().filter(f=>f.musim===musim)
    .sort((a,b)=>String(b.tanggal||'').localeCompare(String(a.tanggal||'')));
  wrap.innerHTML = `
    <div class="pk-sum zk-fitrah">
      <div class="l">Zakat fitrah · ${esc(musim||'Musim ini')}</div>
      <div class="v">${sisaF}</div>
      <div class="n">Sisa yang belum salurkan${sisaBeratF>0?` · ${fmtBerat(sisaBeratF)}`:''}</div>
      <p class="zk-musim">Terkumpul: <b>${fitrahJiwa(musim,'kumpul')} jiwa</b>${kUang?` · ${fmtRp(kUang)}`:''}${kBerat?` · ${fmtBerat(kBerat)}`:''}</p>
      <p class="zk-musim">Tersalur: <b>${fitrahJiwa(musim,'salur')} jiwa</b>${sUang?` · ${fmtRp(sUang)}`:''}${sBerat?` · ${fmtBerat(sBerat)}`:''}</p>
      <p class="zk-pesan">⏰ Zakat fitrah paling lambat salurkan sebelum shalat Idul Fitri.</p>
      <p class="zk-pesan">💵 Dicatat terpisah dari kas — tidak masuk ke saldo kas.</p>
      <div class="zk-pick"><label for="zkMusimSel">Musim</label><select id="zkMusimSel" onchange="fitrahMusimSet(this.value)">${musimOpsi(musim)}</select></div>
      <div class="zk-aksi">
        <button class="btn btn-sm btn-primary" onclick="openFitrahKumpulForm()">+ Pengumpulan</button>
        <button class="btn btn-sm btn-secondary" onclick="openSalurForm('fitrah')">Salurkan</button>
      </div>
    </div>
    <div class="pk-sum zk-mal">
      <div class="l">Zakat lainnya · sisa di kas</div>
      <div class="v">${fmtRp(sisaZakatUang())}</div>
      <div class="n">Terkumpul ${fmtRp(zakatUangTerkumpul())} · tersalur ${fmtRp(zakatUangTersalur())}${sisaBrg?` · sisa zakat barang: <b>${esc(sisaBrg)}</b>`:''}</div>
    </div>
    <div class="zk-sub">Pengumpulan fitrah · ${esc(musim||'Musim ini')}</div>
    ${kumpul.length ? kumpul.map(fitrahRowHTML).join('') : `<div class="empty"><div class="ic">🌾</div><div class="t">Belum ada fitrah terkumpul</div><div class="s">Tekan tombol + Pengumpulan untuk mencatat fitrah yang diterima dari warga</div></div>`}
    <div class="zk-sub">Penyaluran zakat</div>
    ${list.length ? list.map(salurRowHTML).join('') : `<div class="empty"><div class="ic">🤲</div><div class="t">Belum ada penyaluran zakat</div><div class="s">Tekan tombol 🤲 di pojok kanan bawah untuk mencatat zakat yang disalurkan</div></div>`}`;
}
function salurRowHTML(s){
  const uang = s.bentuk==='Uang';
  const fitrah = s.jenisZakat==='fitrah';
  const jenis = fitrah ? ('Fitrah'+(s.musim?(' '+s.musim):'')) : 'Zakat lainnya';
  const sub = [jenis, uang ? ('Uang'+(fitrah?'':' · '+(s.sumber||'Tunai'))) : ('🍚 '+(s.banyak||'')), s.keterangan||''].filter(Boolean).join(' · ');
  return `<button type="button" class="list-item" style="cursor:pointer;" onclick="openSalurDetail('${s.id}')">
    <div class="avatar" style="background:${fitrah?'var(--success-bg)':'var(--warning-bg)'};color:${fitrah?'var(--success)':'var(--warning)'};">${fitrah?'🌾':'🤲'}</div>
    <div class="meta"><div class="t">${esc(s.penerima)}${s.asnaf?` <span class="badge ${fitrah?'fitrah':'zakat'}">${esc(s.asnaf)}</span>`:''}</div>${sub?`<div class="s">${esc(sub)}</div>`:''}</div>
    <div class="right"><div class="amt ${uang&&!fitrah?'minus':''}">${uang ? (fitrah?'':'-')+fmtRp(s.jumlah) : esc(s.banyak||'')}</div><div class="s">${fmtDateTime(s.tanggal)}</div></div>
  </button>`;
}
function openSalurForm(jenis){
  jenis = jenis==='fitrah' ? 'fitrah' : 'mal';
  const musim = fitrahMusimAktif();
  openModal(`
    <div class="modal-head"><h2>🤲 Catat Penyaluran Zakat</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <label>Jenis zakat</label>
    <select id="szJenis" onchange="szJenisChange()">
      <option value="mal"${jenis==='mal'?' selected':''}>Zakat lainnya (harta, usaha, penghasilan)</option>
      <option value="fitrah"${jenis==='fitrah'?' selected':''}>Zakat fitrah</option>
    </select>
    <label>Tanggal</label><input type="date" id="szTgl" value="${todayStr()}">
    <label>Penerima zakat</label><input type="text" id="szPenerima" placeholder="cth: Pak Abdullah">
    <label>Golongan penerima</label><select id="szAsnaf"></select>
    <label>Bentuk yang disalurkan</label><select id="szBentuk" onchange="szBentukChange()">${BENTUK_ZAKAT.map(b=>`<option value="${b}">${b}</option>`).join('')}</select>
    <div id="szMalBox">
      <div id="szUangBox">
        <label>Jumlah (Rp)</label><input type="number" id="szJumlah" placeholder="0" inputmode="numeric">
        <label>Diambil dari</label><select id="szSumber">${SUMBER_DANA.map(s=>`<option value="${s}">${s}</option>`).join('')}</select>
      </div>
      <div id="szBarangBox" class="hidden">
        <label>Banyaknya barang</label><input type="text" id="szBanyak" placeholder="cth: 5 kg beras">
        <label>Perkiraan harga (Rp, opsional)</label><input type="number" id="szHarga" placeholder="0" inputmode="numeric">
      </div>
      <p class="muted" id="szSisaUang" style="font-size:12px;margin:6px 0 0;"></p>
      <p class="muted" id="szSisaBrg" style="font-size:12px;margin:6px 0 0;"></p>
    </div>
    <div id="szFitrahBox" class="hidden">
      <label>Musim zakat fitrah</label><select id="szMusim" onchange="szHitung()">${musimOpsi(musim)}</select>
      <label>Jumlah jiwa</label><input type="number" id="szJiwa" min="1" placeholder="cth: 2" inputmode="numeric" oninput="szHitung()">
      <p class="muted" style="font-size:11.5px;margin:4px 0 0;">1 jiwa = 1 orang yang menerima fitrah.</p>
      <label id="szNilaiLabel">Nilai per jiwa (Rp)</label><input type="number" id="szNilai" value="${FITRAH_TARIF.uang}" inputmode="numeric" oninput="szHitung()">
      <div class="zk-total" id="szTotal"></div>
      <p class="muted" id="szSisaFitrah" style="font-size:12px;margin:6px 0 0;"></p>
      <p class="muted" style="font-size:11.5px;margin:6px 0 0;">⏰ Zakat fitrah paling lambat salurkan sebelum shalat Idul Fitri.</p>
    </div>
    <label>Keterangan (opsional)</label><textarea id="szKet" placeholder="cth: Bantuan sembako untuk korban banjir"></textarea>
    <div class="btn-row" style="margin-top:14px;"><button class="btn btn-primary" onclick="saveSalur()">Simpan</button></div>
  `);
  szJenisChange();
}
/* Ganti jenis zakat: golongannya ikut berubah (fitrah hanya Fakir & Miskin)
   dan blok isian menyesuaikan. */
function szJenisChange(){
  const jenis = (document.getElementById('szJenis')||{}).value || 'mal';
  const fitrah = jenis==='fitrah';
  const malBox = document.getElementById('szMalBox'), fitBox = document.getElementById('szFitrahBox');
  if(malBox) malBox.classList.toggle('hidden', fitrah);
  if(fitBox) fitBox.classList.toggle('hidden', !fitrah);
  const asnaf = document.getElementById('szAsnaf');
  if(asnaf){
    const list = fitrah ? FITRAH_ASNAF : ASNAF;
    asnaf.innerHTML = list.map(a=>`<option value="${a}">${a}</option>`).join('');
  }
  szBentukChange();
}
/* Hitung total fitrah yang akan salurkan + sisa fitrah musim ini. */
function szHitung(){
  const el = document.getElementById('szTotal'); if(!el) return;
  const fitrah = ((document.getElementById('szJenis')||{}).value)==='fitrah';
  if(!fitrah){ el.textContent=''; return; }
  const jiwa = Number((document.getElementById('szJiwa')||{}).value)||0;
  const nilai = Number((document.getElementById('szNilai')||{}).value)||0;
  const uang = ((document.getElementById('szBentuk')||{}).value)===FITRAH_UANG;
  const total = jiwa*nilai;
  el.textContent = jiwa>0
    ? (uang ? `Total: ${jiwa} jiwa × ${fmtRp(nilai)} = ${fmtRp(total)}` : `Total: ${jiwa} jiwa × ${fmtBerat(nilai)} = ${fmtBerat(total)}`)
    : 'Total: isi jumlah jiwa dulu';
  const sisaEl = document.getElementById('szSisaFitrah');
  if(sisaEl){
    const musim = (document.getElementById('szMusim')||{}).value || '';
    const bentuk = uang ? FITRAH_UANG : FITRAH_BERAS;
    const sisa = Math.max(0, fitrahTerkumpul(musim,bentuk) - fitrahTersalur(musim,bentuk));
    sisaEl.textContent = `Sisa fitrah ${musim}: ${uang?fmtRp(sisa):fmtBerat(sisa)}`;
  }
}
function szBentukChange(){
  const uang = (document.getElementById('szBentuk')||{}).value === 'Uang';
  const fitrah = ((document.getElementById('szJenis')||{}).value)==='fitrah';
  const ub = document.getElementById('szUangBox'), bb = document.getElementById('szBarangBox');
  if(ub) ub.classList.toggle('hidden', !uang);
  if(bb) bb.classList.toggle('hidden', uang);
  /* Untuk fitrah, nilai per jiwa ikut bentuk: uang → Rp, beras → kg. */
  const lbl = document.getElementById('szNilaiLabel'), inp = document.getElementById('szNilai');
  if(lbl && inp){
    lbl.textContent = uang ? 'Nilai per jiwa (Rp)' : 'Berat per jiwa (kg)';
    if(fitrah){ inp.value = uang ? FITRAH_TARIF.uang : FITRAH_TARIF.beras; inp.step = uang ? '1000' : '0.1'; }
  }
  const su = document.getElementById('szSisaUang');
  if(su) su.textContent = `Sisa zakat uang di kas sekarang: ${fmtRp(sisaZakatUang())}`;
  const sb = document.getElementById('szSisaBrg');
  if(sb){ const t = sisaZakatBarangTeks(); sb.textContent = t ? `Sisa zakat barang: ${t}` : 'Belum ada zakat barang (beras, dst) yang tercatat.'; }
  szHitung();
}
function saveSalur(){
  const tgl = document.getElementById('szTgl').value || todayStr();
  if(tgl > todayStr()){ toast('Tanggal tidak boleh di masa depan'); return; }
  const penerima = document.getElementById('szPenerima').value.trim();
  if(!penerima){ toast('Isi dulu nama penerima zakat'); return; }
  const jenis = (document.getElementById('szJenis')||{}).value || 'mal';
  const asnaf = document.getElementById('szAsnaf').value;
  const bentuk = document.getElementById('szBentuk').value;
  const ket = document.getElementById('szKet').value.trim();
  const id = uid('sz');
  const tanggal = new Date(tgl+'T'+new Date().toTimeString().slice(0,8)).toISOString();
  /* ---- Zakat fitrah: dicatat terpisah, TANPA record kas ----
     Uang fitrah tidak pernah menyentuh DB.kas (keputusan user: uang fitrah
     keluar total dari kas), jadi saldo kas & laporan tidak ikut berubah. */
  if(jenis==='fitrah'){
    const musim = (document.getElementById('szMusim')||{}).value || fitrahMusimAktif();
    const jiwa = Number((document.getElementById('szJiwa')||{}).value)||0;
    if(jiwa<=0){ toast('Jumlah jiwa harus lebih dari 0'); return; }
    const nilai = Number((document.getElementById('szNilai')||{}).value)||0;
    if(nilai<=0){ toast('Isi nilai per jiwa'); return; }
    const total = jiwa*nilai;
    const sisa = Math.max(0, fitrahTerkumpul(musim,bentuk) - fitrahTersalur(musim,bentuk));
    if(total > sisa){
      toast(`Sisa fitrah ${musim} tinggal ${bentuk===FITRAH_UANG?fmtRp(sisa):fmtBerat(sisa)} — tidak bisa salurkan lebih dari itu`);
      return;
    }
    const banyak = bentuk===FITRAH_UANG ? '' : (fmtNum(total)+' kg beras');
    (DB.salurZakat = DB.salurZakat || []).push({ id, jenisZakat:'fitrah', musim, tanggal, penerima, asnaf, bentuk,
      jumlah: bentuk===FITRAH_UANG?total:0, banyak, harga:0, sumber:'', jiwa, nilai, keterangan:ket, refKas:'' });
    saveDB(); closeModal(); refreshKas();
    toast('Penyaluran fitrah dicatat — saldo kas tidak berubah');
    return;
  }
  /* ---- Zakat lainnya (mal) ---- */
  let jumlah=0, banyak='', harga=0, sumber='', refKas='';
  if(bentuk==='Uang'){
    jumlah = Number(document.getElementById('szJumlah').value)||0;
    if(jumlah<=0){ toast('Jumlah harus lebih dari 0'); return; }
    const sisa = sisaZakatUang();
    if(jumlah > sisa){ toast(`Sisa zakat uang tinggal ${fmtRp(sisa)} — tidak bisa menyalurkan lebih dari itu`); return; }
    sumber = document.getElementById('szSumber').value;
    refKas = uid('k');
    /* otomatis keluar dari kas supaya saldo kas ikut turun dengan benar */
    DB.kas.push({ id:refKas, tanggal, tipe:'keluar', kategori:KAS_KAT_SALUR, jumlah, sumber,
      keterangan:`Penyaluran zakat untuk ${penerima}`, refSalur:id });
  } else {
    banyak = document.getElementById('szBanyak').value.trim();
    if(!banyak){ toast('Isi dulu banyaknya barang yang disalurkan'); return; }
    harga = Number(document.getElementById('szHarga').value)||0;
  }
  (DB.salurZakat = DB.salurZakat || []).push({ id, jenisZakat:'mal', tanggal, penerima, asnaf, bentuk, jumlah, banyak, harga, sumber, keterangan:ket, refKas });
  saveDB(); closeModal(); refreshKas();
  toast(bentuk==='Uang' ? 'Penyaluran zakat dicatat — uang kas berkurang' : 'Penyaluran zakat barang dicatat');
}
function openSalurDetail(id){
  const s = (DB.salurZakat||[]).find(x=>x.id===id); if(!s) return;
  const uang = s.bentuk==='Uang';
  const fitrah = s.jenisZakat==='fitrah';
  openModal(`
    <div class="modal-head"><h2>${fitrah?'🌾':'🤲'} Penyaluran Zakat</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="total-row"><span>Jenis zakat</span><span>${fitrah?'Zakat fitrah':'Zakat lainnya'}</span></div>
    ${fitrah&&s.musim?`<div class="total-row"><span>Musim</span><span>${esc(s.musim)}</span></div>`:''}
    <div class="total-row"><span>Penerima</span><span>${esc(s.penerima)}</span></div>
    ${s.asnaf?`<div class="total-row"><span>Golongan</span><span>${esc(s.asnaf)}</span></div>`:''}
    <div class="total-row"><span>Tanggal</span><span>${fmtDateTime(s.tanggal)}</span></div>
    <div class="total-row"><span>Bentuk</span><span>${uang?'Uang':'🍚 '+esc(s.bentuk)}</span></div>
    ${fitrah&&s.jiwa?`<div class="total-row"><span>Jumlah jiwa</span><span>${s.jiwa} jiwa</span></div>`:''}
    ${uang
      ? `<div class="total-row big"><span>Jumlah</span><span>${fmtRp(s.jumlah)}</span></div>
         ${(!fitrah&&s.sumber)?`<div class="total-row"><span>Diambil dari</span><span>${esc(s.sumber||'Tunai')}</span></div>`:''}`
      : `<div class="total-row big"><span>Banyaknya</span><span>${esc(s.banyak)}</span></div>
         ${s.harga?`<div class="total-row"><span>Perkiraan harga</span><span>${fmtRp(s.harga)}</span></div>`:''}`}
    ${s.keterangan?`<hr class="sep"><p class="muted">${esc(s.keterangan)}</p>`:''}
    ${(uang&&!fitrah)?`<p class="muted" style="margin-top:10px;">🔗 Uangnya otomatis tercatat sebagai pengeluaran kas (kategori <b>Penyaluran Zakat</b>). Menghapus penyaluran ini sekaligus menghapus catatan kasnya, jadi saldo kas kembali seperti semula.</p>`:''}
    ${fitrah?`<p class="muted" style="margin-top:10px;">💵 Zakat fitrah dicatat terpisah dari kas — penerima ini tidak mengurangi saldo kas dan tidak masuk laporan pengeluaran.</p>`:''}
    <div class="btn-row" style="margin-top:14px;"><button class="btn btn-danger" onclick="askDeleteSalur('${s.id}')">Hapus Penyaluran</button></div>
  `);
}
function askDeleteSalur(id){
  const s = (DB.salurZakat||[]).find(x=>x.id===id); if(!s) return;
  openModal(`
    <div class="modal-head"><h2>Hapus Penyaluran?</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <p class="muted">Penyaluran zakat untuk <b>${esc(s.penerima)}</b> akan dihapus permanen${s.refKas?', termasuk catatan kas pengeluarannya (saldo kas kembali seperti semula)':''}.</p>
    <div class="btn-row" style="margin-top:14px;"><button class="btn btn-secondary" onclick="openSalurDetail('${s.id}')">Batal</button><button class="btn btn-danger" onclick="deleteSalur('${s.id}')">Ya, Hapus</button></div>
  `);
}
function deleteSalur(id){
  const s = (DB.salurZakat||[]).find(x=>x.id===id);
  if(s && s.refKas) DB.kas = DB.kas.filter(k=>k.id!==s.refKas && k.refSalur!==id);
  DB.salurZakat = (DB.salurZakat||[]).filter(x=>x.id!==id);
  saveDB(); closeModal(); refreshKas(); toast('Penyaluran zakat dihapus');
}

/* =========================================================
   ZAKAT FITRAH — pengumpulan (Fase 1)
   Fitrah yang diterima dari warga dicatat di DB.fitrah; tidak
   pernah menyentuh DB.kas (saldo kas & laporan tidak berubah).
   ========================================================= */
/* Menu aksi zakat dari tombol 🤲 di tab Zakat. */
function openZakatMenu(){
  openModal(`
    <div class="modal-head"><h2>🤲 Zakat</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="zk-menu">
      <button class="zk-menu-item" onclick="closeModal();openFitrahKumpulForm()">
        <span class="zk-menu-ic">🌾</span>
        <span class="zk-menu-t">Catat Pengumpulan Fitrah</span>
        <span class="zk-menu-s">Fitrah uang atau beras yang diterima dari warga</span>
      </button>
      <button class="zk-menu-item" onclick="closeModal();openSalurForm()">
        <span class="zk-menu-ic">🤲</span>
        <span class="zk-menu-t">Catat Penyaluran</span>
        <span class="zk-menu-s">Zakat fitrah atau zakat lainnya yang diberikan ke penerima</span>
      </button>
    </div>
  `);
}
/* Form pengumpulan fitrah: nama, jumlah jiwa, bentuk, nilai per jiwa. */
function openFitrahKumpulForm(){
  const musim = fitrahMusimAktif();
  openModal(`
    <div class="modal-head"><h2>🌾 Catat Pengumpulan Fitrah</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <label>Musim zakat fitrah (tahun hijriah)</label>
    <select id="fkMusim">${musimOpsi(musim)}</select>
    <label>Tanggal</label><input type="date" id="fkTgl" value="${todayStr()}">
    <label>Nama yang menyerahkan fitrah</label><input type="text" id="fkNama" placeholder="cth: H. Ahmad">
    <label>Jumlah jiwa</label><input type="number" id="fkJiwa" min="1" placeholder="cth: 4" inputmode="numeric" oninput="fkHitung()">
    <p class="muted" style="font-size:11.5px;margin:4px 0 0;">1 jiwa = 1 orang. Satu keluarga 5 orang berarti 5 jiwa.</p>
    <label>Bentuk fitrah</label><select id="fkBentuk" onchange="fkBentukChange()">${FITRAH_BENTUK.map(b=>`<option value="${b}">${b}</option>`).join('')}</select>
    <label id="fkNilaiLabel">Nilai per jiwa (Rp)</label><input type="number" id="fkNilai" value="${FITRAH_TARIF.uang}" inputmode="numeric" oninput="fkHitung()">
    <div class="zk-total" id="fkTotal"></div>
    <label>Keterangan (opsional)</label><textarea id="fkKet" placeholder="cth: Fitrah bulan Ramadhan"></textarea>
    <div class="btn-row" style="margin-top:14px;"><button class="btn btn-primary" onclick="saveFitrahKumpul()">Simpan</button></div>
  `);
  fkBentukChange();
}
function fkBentukChange(){
  const uang = ((document.getElementById('fkBentuk')||{}).value)===FITRAH_UANG;
  const lbl = document.getElementById('fkNilaiLabel'), inp = document.getElementById('fkNilai');
  if(lbl && inp){
    lbl.textContent = uang ? 'Nilai per jiwa (Rp)' : 'Berat per jiwa (kg)';
    inp.value = uang ? FITRAH_TARIF.uang : FITRAH_TARIF.beras;
    inp.step = uang ? '1000' : '0.1';
  }
  fkHitung();
}
function fkHitung(){
  const el = document.getElementById('fkTotal'); if(!el) return;
  const jiwa = Number((document.getElementById('fkJiwa')||{}).value)||0;
  const nilai = Number((document.getElementById('fkNilai')||{}).value)||0;
  const uang = ((document.getElementById('fkBentuk')||{}).value)===FITRAH_UANG;
  const total = jiwa*nilai;
  el.textContent = jiwa>0
    ? (uang ? `Total: ${jiwa} jiwa × ${fmtRp(nilai)} = ${fmtRp(total)}` : `Total: ${jiwa} jiwa × ${fmtBerat(nilai)} = ${fmtBerat(total)}`)
    : 'Total: isi jumlah jiwa dulu';
}
function saveFitrahKumpul(){
  const musim = (document.getElementById('fkMusim')||{}).value || fitrahMusimAktif();
  const tgl = document.getElementById('fkTgl').value || todayStr();
  if(tgl > todayStr()){ toast('Tanggal tidak boleh di masa depan'); return; }
  const nama = document.getElementById('fkNama').value.trim();
  if(!nama){ toast('Isi nama yang menyerahkan fitrah'); return; }
  const jiwa = Number(document.getElementById('fkJiwa').value)||0;
  if(jiwa<=0){ toast('Jumlah jiwa harus lebih dari 0'); return; }
  const bentuk = document.getElementById('fkBentuk').value;
  const nilai = Number(document.getElementById('fkNilai').value)||0;
  if(nilai<=0){ toast('Isi nilai per jiwa'); return; }
  const ket = document.getElementById('fkKet').value.trim();
  (DB.fitrah = DB.fitrah||[]).push({ id:uid('ft'), tipe:'kumpul', musim, nama, jiwa, bentuk, nilai,
    tanggal:new Date(tgl+'T'+new Date().toTimeString().slice(0,8)).toISOString(), keterangan:ket });
  fitrahMusim = musim;
  saveDB(); closeModal(); refreshKas();
  toast('Fitrah dicatat — tidak masuk ke saldo kas');
}
function fitrahRowHTML(f){
  const uang = f.bentuk==='Uang';
  const total = (Number(f.jiwa)||0)*(Number(f.nilai)||0);
  const sub = [`${f.jiwa||0} jiwa`, uang?fmtRp(total):fmtBerat(total), f.keterangan||''].filter(Boolean).join(' · ');
  return `<button type="button" class="list-item" style="cursor:pointer;" onclick="openFitrahDetail('${f.id}')">
    <div class="avatar" style="background:var(--success-bg);color:var(--success);">🌾</div>
    <div class="meta"><div class="t">${esc(f.nama||'Tanpa nama')}</div>${sub?`<div class="s">${esc(sub)}</div>`:''}</div>
    <div class="right"><div class="amt plus">${uang?'+'+fmtRp(total):esc(fmtBerat(total))}</div><div class="s">${fmtDateTime(f.tanggal)}</div></div>
  </button>`;
}
function openFitrahDetail(id){
  const f = (DB.fitrah||[]).find(x=>x.id===id); if(!f) return;
  const uang = f.bentuk==='Uang';
  const total = (Number(f.jiwa)||0)*(Number(f.nilai)||0);
  openModal(`
    <div class="modal-head"><h2>🌾 Pengumpulan Fitrah</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="total-row"><span>Nama</span><span>${esc(f.nama||'-')}</span></div>
    <div class="total-row"><span>Musim</span><span>${esc(f.musim||'-')}</span></div>
    <div class="total-row"><span>Tanggal</span><span>${fmtDateTime(f.tanggal)}</span></div>
    <div class="total-row"><span>Bentuk</span><span>${uang?'Uang':'🍚 '+esc(f.bentuk)}</span></div>
    <div class="total-row"><span>Jumlah jiwa</span><span>${f.jiwa||0} jiwa</span></div>
    <div class="total-row"><span>Per jiwa</span><span>${uang?fmtRp(f.nilai):fmtBerat(f.nilai)}</span></div>
    <div class="total-row big"><span>Total</span><span>${uang?fmtRp(total):fmtBerat(total)}</span></div>
    ${f.keterangan?`<hr class="sep"><p class="muted">${esc(f.keterangan)}</p>`:''}
    <p class="muted" style="margin-top:10px;">💵 Zakat fitrah dicatat terpisah — tidak menambah saldo kas.</p>
    <div class="btn-row" style="margin-top:14px;"><button class="btn btn-danger" onclick="askDeleteFitrah('${f.id}')">Hapus</button></div>
  `);
}
function askDeleteFitrah(id){
  const f = (DB.fitrah||[]).find(x=>x.id===id); if(!f) return;
  openModal(`
    <div class="modal-head"><h2>Hapus Pengumpulan Fitrah?</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <p class="muted">Catatan fitrah <b>${esc(f.nama||'')}</b> (${f.jiwa||0} jiwa) akan dihapus permanen.</p>
    <div class="btn-row" style="margin-top:14px;"><button class="btn btn-secondary" onclick="openFitrahDetail('${f.id}')">Batal</button><button class="btn btn-danger" onclick="deleteFitrah('${f.id}')">Ya, Hapus</button></div>
  `);
}
function deleteFitrah(id){
  DB.fitrah = (DB.fitrah||[]).filter(x=>x.id!==id);
  saveDB(); closeModal(); refreshKas(); toast('Pengumpulan fitrah dihapus');
}

/* =========================================================
   KEGIATAN & KAJIAN
   ========================================================= */
const KEGIATAN_LABELS = {akandatang:'Akan Datang', selesai:'Selesai'};
let kegiatanTab = 'akandatang';
function setKegiatanTab(t){ kegiatanTab=t; document.querySelectorAll('#view-kegiatan .tab').forEach(el=>el.classList.toggle('active', el.dataset.e===t)); renderKegiatanList(); }
/* ---------- Jadwal berulang ----------
   Model "materialisasi": satu kejadian = satu entri nyata di DB.kegiatan.
   Entri hasil satu pola diberi seriId + seriInfo + ke/dari supaya bisa
   diedit/hapus per kejadian, atau dihapus sekaligus sebagai satu seri. */
const HARI_ID = ['Ahad','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];   // index = Date.getDay()
const HARI_SINGKAT = ['Ahd','Sen','Sel','Rab','Kam','Jum','Sab'];
const HARI_URUT = [1,2,3,4,5,6,0];                                          // urutan tampil: Senin→Ahad
const ULANG_JML_MIN = 1, ULANG_JML_MAX = 52, ULANG_JML_DEF = 26;
/* Semua teks di panel ini sengaja pakai bahasa sehari-hari — tanpa "ke-N",
   "interval", atau "kejadian". Penggunanya kebanyakan bukan orang teknis. */
const ORDINAL = ['pertama','kedua','ketiga','keempat','terakhir'];           // "hari Jumat yang pertama / terakhir"
const POLA_ULANG = [
  ['', 'Sekali saja'],
  ['harian', 'Tiap hari'],
  ['mingguan', 'Tiap minggu'],
  ['bulanan', 'Tiap bulan'],
  ['tahunan', 'Tiap tahun']
];
const isoD = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const dariIso = s => { const [y,m,d] = String(s).split('-').map(Number); return new Date(y, m-1, d); };
const tambahHari = (s,n) => { const d = dariIso(s); d.setDate(d.getDate()+n); return isoD(d); };
const hariBulan = (y, m1) => new Date(y, m1, 0).getDate();                 // m1 = 1..12
const urutHari = arr => (arr||[]).slice().sort((a,b)=>HARI_URUT.indexOf(a)-HARI_URUT.indexOf(b));

function ringkasUlang(u){
  const n = Math.max(1, parseInt(u.interval,10)||1);
  const tiap = satuan => n===1 ? `Tiap ${satuan}` : `Tiap ${n} ${satuan}`;
  if(u.pola==='harian') return tiap('hari');
  if(u.pola==='mingguan') return `${tiap('minggu')} · ${urutHari(u.hari).map(i=>HARI_SINGKAT[i]).join(', ')||'-'}`;
  if(u.pola==='bulanan-tgl') return `${tiap('bulan')} · tanggal ${u.tgl}`;
  if(u.pola==='bulanan-minggu') return `${tiap('bulan')} · ${HARI_ID[u.hari]} ${ORDINAL[u.minggu-1]||'pertama'}`;
  if(u.pola==='tahunan') return tiap('tahun');
  return 'Sekali';
}
/* Hasilkan daftar tanggal (ISO) untuk sebuah pola. selalu mulai dari tanggalAwal. */
function buatJadwalBerulang(tanggalAwal, u){
  const n = Math.max(1, parseInt(u.interval,10)||1);
  const jml = Math.min(ULANG_JML_MAX, Math.max(ULANG_JML_MIN, parseInt(u.jumlah,10)||ULANG_JML_DEF));
  const awal = tanggalAwal;
  const a = dariIso(awal);
  const out = [];
  const batas = 900;                                                       // pengaman anti-loop
  if(u.pola==='harian'){
    for(let k=0; k<jml; k++) out.push(tambahHari(awal, k*n));
  } else if(u.pola==='mingguan'){
    let hari = urutHari(u.hari);
    if(!hari.length) hari = [a.getDay()];
    const seninAwal = tambahHari(awal, -((a.getDay()+6)%7));                // awal minggu = Senin
    let c = 0;
    while(out.length<jml && c<batas){
      const mulai = tambahHari(seninAwal, c*n*7);
      for(const h of hari){
        const t = tambahHari(mulai, (h+6)%7);
        if(t>=awal && out.length<jml) out.push(t);
      }
      c++;
    }
  } else if(u.pola==='bulanan-tgl'){
    const tgl = Math.min(31, Math.max(1, parseInt(u.tgl,10)||a.getDate()));
    let j = 0;
    while(out.length<jml && j<batas){
      const d = new Date(a.getFullYear(), a.getMonth()+j*n, 1);
      const t = isoD(new Date(d.getFullYear(), d.getMonth(), Math.min(tgl, hariBulan(d.getFullYear(), d.getMonth()+1))));
      if(t>=awal && out.length<jml) out.push(t);
      j++;
    }
  } else if(u.pola==='bulanan-minggu'){
    /* "hari Jumat yang pertama/kedua/…" = kemunculan ke-N hari itu di bulan tsb.
       "yang terakhir" (u.minggu = 5) = kemunculan paling akhir di bulan itu. */
    const minggu = Math.min(5, Math.max(1, parseInt(u.minggu,10)||1));
    const hi = parseInt(u.hari,10); const hh = (hi>=0&&hi<=6) ? hi : a.getDay();
    let j = 0;
    while(out.length<jml && j<batas){
      const d = new Date(a.getFullYear(), a.getMonth()+j*n, 1);
      const dim = hariBulan(d.getFullYear(), d.getMonth()+1);
      if(minggu===5){
        for(let dd=dim; dd>=1; dd--){
          const t = isoD(new Date(d.getFullYear(), d.getMonth(), dd));
          if(dariIso(t).getDay()===hh){ if(t>=awal) out.push(t); break; }
        }
      } else {
        let hit = 0;
        for(let dd=1; dd<=dim; dd++){
          const t = isoD(new Date(d.getFullYear(), d.getMonth(), dd));
          if(dariIso(t).getDay()===hh){ hit++; if(hit===minggu && t>=awal){ out.push(t); break; } }
        }
      }
      j++;
    }
  } else if(u.pola==='tahunan'){
    for(let k=0; k<jml; k++){
      const y = a.getFullYear()+k*n;
      out.push(isoD(new Date(y, a.getMonth(), Math.min(a.getDate(), hariBulan(y, a.getMonth()+1)))));   // 29 Feb → 28 Feb
    }
  }
  return out;
}
/* ---- panel form dinamis ---- */
let efHariPilih = [];      // pola "tiap minggu": hari yang dipilih (boleh banyak)
let efHariSatu = null;     // pola "tiap bulan": satu hari
let efBulanTgl = true;     // pola "tiap bulan": true = patokan tanggal, false = patokan hari
function efUlangHTMLHari(multi){
  const on = multi ? efHariPilih : (efHariSatu==null?[]:[efHariSatu]);
  return `<div class="up-chips">${HARI_URUT.map(h=>`<button type="button" class="up-chip${on.includes(h)?' on':''}" data-h="${h}" onclick="efChipHari(this,${multi?1:0})">${HARI_SINGKAT[h]}</button>`).join('')}</div>`;
}
function efChipHari(btn, multi){
  if(multi){ btn.classList.toggle('on'); }
  else {
    btn.parentNode.querySelectorAll('.up-chip').forEach(b=>b.classList.remove('on'));
    btn.classList.add('on');
    const nm = document.getElementById('efUlangHariNama');     // nama hari di baris pengaturan ikut berubah
    if(nm) nm.textContent = HARI_ID[parseInt(btn.dataset.h,10)];
  }
  efUlangPreview();
}
function efUlangHTMLBulan(){
  const tglAwal = ((document.getElementById('efTanggal')||{}).value) || todayStr();
  if(efBulanTgl) return `<div class="row"><span>Tanggal</span><input type="number" id="efUlangTgl" min="1" max="31" value="${dariIso(tglAwal).getDate()}" oninput="efUlangPreview()"><span>tiap bulan</span></div>`;
  if(efHariSatu==null) efHariSatu = dariIso(tglAwal).getDay();
  return `${efUlangHTMLHari(false)}<div class="row"><span>hari</span><b id="efUlangHariNama">${HARI_ID[efHariSatu]}</b><span>yang</span><select id="efUlangMinggu" onchange="efUlangPreview()">${ORDINAL.map((o,i)=>`<option value="${i+1}">${o}</option>`).join('')}</select></div>`;
}
function efBulanSet(btn, pakaiTanggal){
  efBulanTgl = pakaiTanggal;
  btn.parentNode.querySelectorAll('.up-chip').forEach(b=>b.classList.toggle('on', b===btn));
  const box = document.getElementById('efUlangBulan');
  if(box) box.innerHTML = efUlangHTMLBulan();
  efUlangPreview();
}
function efUlangChange(){
  const pola = document.getElementById('efUlang').value;
  const p = document.getElementById('efUlangPanel');
  if(!pola){ p.innerHTML = ''; p.hidden = true; return; }
  p.hidden = false;
  const tglAwal = document.getElementById('efTanggal').value || todayStr();
  const dow = dariIso(tglAwal).getDay();
  efHariPilih = [dow]; efHariSatu = dow; efBulanTgl = true;
  const inp = `id="efUlangInterval" oninput="efUlangPreview()"`;
  const satuan = {harian:'hari', mingguan:'minggu', bulanan:'bulan', tahunan:'tahun'}[pola];
  const maks = {harian:30, mingguan:8, bulanan:24, tahunan:5}[pola];
  const tiap = `<div class="row"><span>Diulang tiap</span><input type="number" ${inp} min="1" max="${maks}" value="1"><span>${satuan}</span></div>`;
  const jml = `<div class="row" style="margin-top:8px;"><span>Dibuat</span><input type="number" id="efUlangJumlah" min="1" max="52" value="${ULANG_JML_DEF}" oninput="efUlangPreview()"><span>kali</span></div>`;
  let body = tiap;
  if(pola==='mingguan') body += `<div class="row"><span>Hari apa?</span></div>${efUlangHTMLHari(true)}`;
  else if(pola==='bulanan') body += `<div class="up-chips"><button type="button" class="up-chip on" onclick="efBulanSet(this,true)">Tanggal tetap</button><button type="button" class="up-chip" onclick="efBulanSet(this,false)">Hari tetap</button></div><div id="efUlangBulan">${efUlangHTMLBulan()}</div>`;
  p.innerHTML = body + jml + `<div class="up-note" id="efUlangNote"></div>`;
  efUlangPreview();
}
function bacaUlangForm(){
  const sel = document.getElementById('efUlang');
  const polaUI = sel ? sel.value : '';
  if(!polaUI) return null;
  const num = (id, def) => { const el = document.getElementById(id); const v = el ? parseInt(el.value,10) : NaN; return isNaN(v) ? def : v; };
  const tglAwal = ((document.getElementById('efTanggal')||{}).value) || todayStr();
  const dow = dariIso(tglAwal).getDay();
  const chip = () => Array.from(document.querySelectorAll('#efUlangPanel .up-chip.on')).map(b=>parseInt(b.dataset.h,10)).filter(h=>h>=0);
  const u = { pola: polaUI, interval: num('efUlangInterval',1), jumlah: num('efUlangJumlah', ULANG_JML_DEF) };
  if(polaUI==='mingguan'){ const h = chip(); u.hari = h.length ? h : [dow]; }
  else if(polaUI==='bulanan'){
    if(efBulanTgl){ u.pola = 'bulanan-tgl'; u.tgl = Math.min(31, Math.max(1, num('efUlangTgl', dariIso(tglAwal).getDate()))); }
    else { u.pola = 'bulanan-minggu'; const h = chip(); u.hari = h.length ? h[0] : dow; u.minggu = Math.min(5, Math.max(1, num('efUlangMinggu',1))); }
  }
  return u;
}
function efUlangPreview(){
  const note = document.getElementById('efUlangNote');
  if(!note) return;
  const u = bacaUlangForm();
  if(!u){ note.innerHTML = ''; return; }
  const tglAwal = ((document.getElementById('efTanggal')||{}).value) || todayStr();
  const list = buatJadwalBerulang(tglAwal, u);
  if(!list.length){ note.innerHTML = 'Tanggalnya belum bisa dihitung. Coba ubah pengaturannya.'; return; }
  const contoh = list.slice(0,3).map(t=>fmtDateOnly(t)).join(' · ') + (list.length>3 ? ` · ... sampai ${fmtDateOnly(list[list.length-1])}` : '');
  let catatan = '';
  if(u.pola==='bulanan-tgl' && u.tgl>28) catatan = '<br>Kalau bulannya lebih pendek (mis. Februari), dipakai tanggal terakhir bulan itu.';
  else if(u.pola==='tahunan' && String(tglAwal).slice(5)==='02-29') catatan = '<br>Di tahun yang bukan kabisat dipakai 28 Februari.';
  note.innerHTML = `${esc(ringkasUlang(u))} · dibuat <b>${list.length} kali</b><br>Tanggalnya: ${contoh}${catatan}<br>Tiap tanggal jadi catatan sendiri — bisa diubah atau dihapus satu-satu.`;
}
function kegiatanRowHTML(e, opts){
  /* Badge status pindah ke kolom kiri: di bawah tanggal & nama pengisi,
     sehingga judul kegiatan dapat lebar penuh.
     Opsi hitungMundur (Beranda): badge jadi HARI INI / Besok / N hari lagi.
     Catatan: bila dipakai lewat .map(fn), argumen kedua = indeks (angka) —
     aman karena properti .hitungMundur tidak ada pada angka. */
  const mundur = opts && opts.hitungMundur && e.status==='akandatang';
  let badgeHTML;
  if(mundur){
    const sisa = Math.round((Date.parse(e.tanggal+'T00:00:00') - Date.parse(todayStr()+'T00:00:00'))/864e5);
    if(sisa<=0) badgeHTML = `<div class="badge hariini">HARI INI</div>`;
    else if(sisa===1) badgeHTML = `<div class="badge besok">Besok</div>`;
    else badgeHTML = `<div class="badge akandatang">${sisa} hari lagi</div>`;
  } else {
    badgeHTML = `<div class="badge ${e.status}">${KEGIATAN_LABELS[e.status]}</div>`;
  }
  return `<button type="button" class="list-item" style="cursor:pointer;" onclick="openKegiatanDetail('${e.id}')">
    <div class="avatar" style="background:var(--info-bg);color:var(--info);">📅</div>
    <div class="meta"><div class="t">${esc(e.nama)}</div><div class="s">${fmtDateOnly(e.tanggal)} ${esc(e.waktu||'')} · ${esc(e.pengisi||'-')}${e.seriId?` · 🔁 ${e.ke||1} dari ${e.dari||'?'}`:''}</div>${badgeHTML}</div>
  </button>`;
}
/* Kegiatan yang tanggalnya sudah lewat otomatis pindah ke tab Selesai.
   Hanya menyimpan kalau memang ada yang berubah. */
function sweepKegiatanSelesai(){
  const t = todayStr();
  let n = 0;
  DB.kegiatan.forEach(e=>{ if(e.status==='akandatang' && e.tanggal < t){ e.status='selesai'; n++; } });
  if(n) saveDB();
  return n;
}
function renderKegiatanList(){
  sweepKegiatanSelesai();
  let list = DB.kegiatan.slice().sort((a,b)=>a.tanggal.localeCompare(b.tanggal));
  if(kegiatanTab==='akandatang') list = list.filter(e=>e.status==='akandatang');
  if(kegiatanTab==='selesai') list = list.filter(e=>e.status==='selesai').reverse();
  const wrap = document.getElementById('kegiatanListWrap');
  wrap.innerHTML = (list.length ? list.map(kegiatanRowHTML).join('') : `<div class="empty"><div class="ic">📅</div><div class="t">Belum ada kegiatan</div></div>`);
}
function openKegiatanForm(id){
  const e = id ? DB.kegiatan.find(x=>x.id===id) : null;
  openModal(`
    <div class="modal-head"><h2>${e?'Edit':'Tambah'} Kegiatan</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <label>Nama Kegiatan</label><input type="text" id="efNama" value="${e?esc(e.nama):''}" placeholder="cth: Kajian Rutin Ba'da Maghrib">
    <div class="field-row">
      <div><label>Tanggal</label><input type="date" id="efTanggal" value="${e?e.tanggal:todayStr()}" onchange="efUlangPreview()"></div>
      <div><label>Waktu</label><input type="time" id="efWaktu" value="${e?e.waktu||'':''}"></div>
    </div>
    <div class="field-row">
      <div><label>Pengisi/Penceramah</label><input type="text" id="efPengisi" value="${e?esc(e.pengisi||''):''}"></div>
      <div><label>Tempat</label><input type="text" id="efTempat" value="${e?esc(e.tempat||''):''}" placeholder="cth: Aula Utama"></div>
    </div>
    ${e && e.seriId ? `<div class="up-note" style="margin-top:12px;">Ini bagian dari jadwal berulang <b>${esc(e.seriInfo||'jadwal berulang')}</b> — tanggal ${e.ke||1} dari ${e.dari||'?'}. Perubahan di sini hanya untuk tanggal ini.</div>` : ''}
    ${e ? '' : `<label style="margin-top:12px;">Jadwal diulang?</label>
    <select id="efUlang" onchange="efUlangChange()">${POLA_ULANG.map(p=>`<option value="${p[0]}">${esc(p[1])}</option>`).join('')}</select>
    <div class="up-box" id="efUlangPanel" hidden></div>`}
    <label>Catatan (opsional)</label><textarea id="efCatatan">${e?esc(e.catatan||''):''}</textarea>
    <div class="btn-row" style="margin-top:14px;">
      ${e?`<button class="btn btn-danger" onclick="deleteKegiatan('${e.id}')">Hapus</button>`:''}
      <button class="btn btn-primary" onclick="saveKegiatan('${e?e.id:''}')">Simpan</button>
    </div>
  `);
}
function saveKegiatan(id){
  const data = {
    nama: document.getElementById('efNama').value.trim(),
    tanggal: document.getElementById('efTanggal').value || todayStr(),
    waktu: document.getElementById('efWaktu').value,
    pengisi: document.getElementById('efPengisi').value.trim(),
    tempat: document.getElementById('efTempat').value.trim(),
    catatan: document.getElementById('efCatatan').value.trim(),
  };
  if(!data.nama){ toast('Nama kegiatan wajib diisi'); return; }
  if(id){
    Object.assign(DB.kegiatan.find(x=>x.id===id), data);
    saveDB(); closeModal(); renderKegiatanList(); renderDashboard(); toast('Kegiatan disimpan');
    return;
  }
  const u = bacaUlangForm();
  if(u){
    const list = buatJadwalBerulang(data.tanggal, u);
    if(!list.length){ toast('Pola berulang belum menghasilkan kejadian'); return; }
    const seriId = uid('s'), info = ringkasUlang(u);
    list.forEach((t,i)=>DB.kegiatan.push(Object.assign({id:uid('e'), status:'akandatang'}, data,
      { tanggal:t, seriId, seriInfo:info, ke:i+1, dari:list.length })));
    saveDB(); closeModal(); renderKegiatanList(); renderDashboard();
    toast(`${list.length} jadwal dibuat`);
    return;
  }
  DB.kegiatan.push(Object.assign({id:uid('e'), status:'akandatang'}, data));
  saveDB(); closeModal(); renderKegiatanList(); renderDashboard(); toast('Kegiatan disimpan');
}
function deleteKegiatan(id){ DB.kegiatan = DB.kegiatan.filter(x=>x.id!==id); saveDB(); closeModal(); renderKegiatanList(); renderDashboard(); }
function jumlahSeri(seriId){ return DB.kegiatan.filter(x=>x.seriId===seriId).length; }
function askDeleteSeri(seriId, id){
  const e = DB.kegiatan.find(x=>x.id===id) || {};
  openModal(`
    <div class="modal-head"><h2>Hapus Semua Tanggal?</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <p class="muted" style="text-align:left;">Jadwal <b>${esc(e.seriInfo||'berulang')}</b> ini punya <b>${jumlahSeri(seriId)} tanggal</b>. Semuanya akan dihapus permanen. Kalau cuma mau menghapus satu tanggal, pakai tombol <b>Hapus</b> di form Edit.</p>
    <div class="btn-row" style="margin-top:14px;">
      <button class="btn btn-secondary" onclick="closeModal();openKegiatanDetail('${id}')">Batal</button>
      <button class="btn btn-danger" onclick="deleteKegiatanSeri('${seriId}')">Ya, Hapus Semua</button>
    </div>
  `);
}
function deleteKegiatanSeri(seriId){
  const n = jumlahSeri(seriId);
  DB.kegiatan = DB.kegiatan.filter(x=>x.seriId!==seriId);
  saveDB(); closeModal(); renderKegiatanList(); renderDashboard();
  toast(n ? `${n} jadwal dihapus` : 'Jadwal dihapus');
}
function openKegiatanDetail(id){
  const e = DB.kegiatan.find(x=>x.id===id);
  if(!e) return;
  openModal(`
    <div class="modal-head"><h2>${esc(e.nama)}</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="total-row"><span>Tanggal</span><span>${fmtDateOnly(e.tanggal)}</span></div>
    <div class="total-row"><span>Waktu</span><span>${e.waktu||'-'}</span></div>
    <div class="total-row"><span>Pengisi</span><span>${esc(e.pengisi||'-')}</span></div>
    <div class="total-row"><span>Tempat</span><span>${esc(e.tempat||'-')}</span></div>
    ${e.seriId?`<div class="total-row"><span>Diulang</span><span>${esc(e.seriInfo||'Ya')}</span></div>
    <div class="total-row"><span>Jadwal</span><span>${e.ke||1} dari ${e.dari||jumlahSeri(e.seriId)}</span></div>`:''}
    ${e.catatan?`<hr class="sep"><p class="muted">${esc(e.catatan)}</p>`:''}
    <div class="btn-row" style="margin-top:14px;">
      <button class="btn btn-secondary" onclick="closeModal();openKegiatanForm('${e.id}')">✏️ Edit</button>
      ${e.status==='akandatang'
        ? `<button class="btn btn-primary" onclick="markKegiatanSelesai('${e.id}')">Tandai Selesai</button>`
        : `<button class="btn btn-secondary" onclick="markKegiatanAkanDatang('${e.id}')">Tandai Akan Datang</button>`}
    </div>
    ${e.seriId?`<button class="btn btn-secondary" style="margin-top:10px;" onclick="askDeleteSeri('${e.seriId}','${e.id}')">🔁 Hapus Semua Jadwal Ini (${jumlahSeri(e.seriId)} tanggal)</button>`:''}
  `);
}
function markKegiatanSelesai(id){ DB.kegiatan.find(x=>x.id===id).status='selesai'; saveDB(); closeModal(); renderKegiatanList(); renderDashboard(); toast('Kegiatan ditandai selesai'); }
function markKegiatanAkanDatang(id){ DB.kegiatan.find(x=>x.id===id).status='akandatang'; saveDB(); closeModal(); renderKegiatanList(); renderDashboard(); }

/* =========================================================
   JAMAAH
   ========================================================= */
function renderJamaahList(){
  const q = (document.getElementById('jamaahSearch').value||'').toLowerCase();
  const list = DB.jamaah.filter(j=>!q||j.nama.toLowerCase().includes(q));
  const wrap = document.getElementById('jamaahListWrap');
  wrap.innerHTML = (list.length ? list.map(j=>`
    <button type="button" class="list-item" style="cursor:pointer;" onclick="openJamaahForm('${j.id}')">
      <div class="avatar" style="background:var(--c-jamaah-bg);color:var(--c-jamaah);">🧑</div>
      <div class="meta"><div class="t">${esc(j.nama)}</div><div class="s">${esc(j.statusKeluarga||'-')} · ${esc(j.telp||'-')}</div></div>
    </button>`).join('') : `<div class="empty"><div class="ic">🧑‍🤝‍🧑</div><div class="t">Belum ada data jamaah</div></div>`);
}
function openJamaahForm(id){
  const j = id ? DB.jamaah.find(x=>x.id===id) : null;
  openModal(`
    <div class="modal-head"><h2>${j?'Edit':'Tambah'} Jamaah</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <label>Nama</label><input type="text" id="jfNama" value="${j?esc(j.nama):''}">
    <label>No. HP</label><input type="tel" id="jfTelp" value="${j?esc(j.telp||''):''}">
    <label>Status</label>
    <select id="jfStatus">
      <option value="Kepala Keluarga" ${j&&j.statusKeluarga==='Kepala Keluarga'?'selected':''}>Kepala Keluarga</option>
      <option value="Anggota Keluarga" ${j&&j.statusKeluarga==='Anggota Keluarga'?'selected':''}>Anggota Keluarga</option>
      <option value="Pengurus/Takmir" ${j&&j.statusKeluarga==='Pengurus/Takmir'?'selected':''}>Pengurus/Takmir</option>
    </select>
    <label>Alamat</label><textarea id="jfAlamat">${j?esc(j.alamat||''):''}</textarea>
    <label>Catatan (opsional)</label><textarea id="jfCatatan">${j?esc(j.catatan||''):''}</textarea>
    <div class="btn-row" style="margin-top:12px;">
      ${j?`<button class="btn btn-danger" onclick="deleteJamaah('${j.id}')">Hapus</button>`:''}
      <button class="btn btn-primary" onclick="saveJamaah('${j?j.id:''}')">Simpan</button>
    </div>
  `);
}
function saveJamaah(id){
  const data = {
    nama: document.getElementById('jfNama').value.trim(),
    telp: document.getElementById('jfTelp').value.trim(),
    statusKeluarga: document.getElementById('jfStatus').value,
    alamat: document.getElementById('jfAlamat').value.trim(),
    catatan: document.getElementById('jfCatatan').value.trim(),
  };
  if(!data.nama){ toast('Nama wajib diisi'); return; }
  if(id) Object.assign(DB.jamaah.find(x=>x.id===id), data);
  else DB.jamaah.push(Object.assign({id:uid('j')}, data));
  saveDB(); closeModal(); renderJamaahList(); renderDashboard(); toast('Data jamaah disimpan');
}
function deleteJamaah(id){ DB.jamaah = DB.jamaah.filter(x=>x.id!==id); saveDB(); closeModal(); renderJamaahList(); renderDashboard(); }

/* =========================================================
   INVENTARIS
   ========================================================= */
const KONDISI_LABELS = {baik:'Baik', ringan:'Rusak Ringan', berat:'Rusak Berat'};
const KONDISI_URUT = ['baik','ringan','berat'];
const n0 = v => Math.max(0, Math.floor(Number(v) || 0));
/* Jumlah barang dicatat PER KONDISI (barang tidak selalu satu kondisi semua).
   Disimpan di `kondisiRinci` = {baik, ringan, berat}; `jumlah` tetap diisi
   totalnya supaya stok, barang keluar, dan data lama tetap jalan.
   Catatan lama yang belum punya kondisiRinci dibaca apa adanya: seluruh
   jumlahnya dianggap berada di satu kondisi yang dulu tercatat. */
function rincianKondisi(a){
  const r = {baik:0, ringan:0, berat:0};
  if(a && a.kondisiRinci && typeof a.kondisiRinci === 'object'){
    KONDISI_URUT.forEach(k => { r[k] = n0(a.kondisiRinci[k]); });
    return r;
  }
  const k = (a && KONDISI_URUT.indexOf(a.kondisi) >= 0) ? a.kondisi : 'baik';
  r[k] = n0(a && a.jumlah);
  return r;
}
function totalRincian(r){ return r.baik + r.ringan + r.berat; }
function totalAset(a){ return totalRincian(rincianKondisi(a)); }
function kondisiTerburuk(r){ return r.berat ? 'berat' : (r.ringan ? 'ringan' : 'baik'); }
function jumlahKeluar(a){ return pinjamAktif(a.id).reduce((s,p)=> s + (Number(p.jumlah)||0), 0); }
/* Barang yang sedang keluar TIDAK ikut dihitung sebagai barang yang ada di
   tempat — daftar aset menampilkan sisa yang benar-benar ada di masjid.
   Pengurangannya diambil dari kondisi terbaik dulu (baik → ringan → berat),
   karena yang dipinjam/dilaundry biasanya yang masih bagus. */
function rincianTersedia(a){
  const r = rincianKondisi(a);
  const t = {baik:r.baik, ringan:r.ringan, berat:r.berat};
  let sisa = jumlahKeluar(a);
  KONDISI_URUT.forEach(k => {
    if(sisa <= 0) return;
    const ambil = Math.min(t[k], sisa);
    t[k] -= ambil; sisa -= ambil;
  });
  return t;
}
function totalTersedia(a){ return totalRincian(rincianTersedia(a)); }
/* Rincian ringkas untuk daftar: "13 baik · 2 ringan" (yang nol tidak ditulis). */
function rincianHTML(r){
  return KONDISI_URUT.filter(k => r[k] > 0)
    .map(k => `<span class="k-${k}"><b>${r[k]}</b> ${KONDISI_LABELS[k].toLowerCase().replace('rusak ','')}</span>`)
    .join('');
}
function rincianKondisiHTML(a){ return rincianHTML(rincianKondisi(a)); }
function rincianTersediaHTML(a){ return rincianHTML(rincianTersedia(a)); }
let invTab = 'aset';
/* Jumlah barang yang sedang keluar untuk aset yang sedang dibuka di form.
   Dipakai supaya keterangan di bawah isian jumlah bisa menunjukkan berapa
   yang ada di tempat, bukan cuma total yang dimiliki. */
let IF_KELUAR = 0;
function setInvTab(t){
  invTab = t;
  document.querySelectorAll('#view-inventaris .tab').forEach(el=>el.classList.toggle('active', el.dataset.inv===t));
  document.getElementById('invPaneAset').style.display = t==='aset' ? '' : 'none';
  document.getElementById('invPaneKeluar').style.display = t==='keluar' ? '' : 'none';
  const fab = document.getElementById('invFab');
  if(t==='aset'){ fab.innerHTML='＋'; fab.setAttribute('onclick','openInventarisForm()'); fab.setAttribute('aria-label','Tambah Aset'); }
  else { fab.innerHTML='🚪'; fab.setAttribute('onclick','openPinjamForm()'); fab.setAttribute('aria-label','Catat Barang Keluar'); }
  renderInventarisList(); renderPinjamList();
}
function renderInventarisList(){
  const wrap = document.getElementById('inventarisListWrap');
  const ca = document.getElementById('invCountAset');
  if(ca){ ca.textContent = DB.inventaris.length; ca.style.display = DB.inventaris.length ? '' : 'none'; }
  wrap.innerHTML = (DB.inventaris.length ? DB.inventaris.map(i=>{
    const aktif = jumlahKeluar(i);
    const total = totalAset(i);
    const ada = total - aktif;
    const sum = rincianTersediaHTML(i);
    return `
    <button type="button" class="list-item" style="cursor:pointer;" onclick="openInventarisForm('${i.id}')">
      <div class="avatar" style="background:var(--c-keluar-bg);color:var(--c-keluar);">📦</div>
      <div class="meta">
        <div class="t">${esc(i.nama)}</div>
        <div class="s">${esc(i.kategori)}${i.lokasi?` · ${esc(i.lokasi)}`:''}${aktif?` · <b>Keluar: ${aktif}</b>`:''}</div>
        <div class="kon-sum">${sum || (aktif ? '<span>semua sedang keluar</span>' : '<span>belum diisi</span>')}</div>
      </div>
      <div class="right"><div class="amt">${ada}</div><div class="s">${aktif?`dari ${total}`:'barang'}</div></div>
    </button>`; }).join('') : `<div class="empty"><div class="ic">📦</div><div class="t">Belum ada data inventaris</div></div>`);
}
function openInventarisForm(id){
  const i = id ? DB.inventaris.find(x=>x.id===id) : null;
  const r = i ? rincianKondisi(i) : {baik:1, ringan:0, berat:0};
  IF_KELUAR = i ? jumlahKeluar(i) : 0;
  openModal(`
    <div class="modal-head"><h2>${i?'Edit':'Tambah'} Aset</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <label>Nama Aset</label><input type="text" id="ifNama" value="${i?esc(i.nama):''}">
    <div class="field-row">
      <div><label>Kategori</label><input type="text" id="ifKategori" value="${i?esc(i.kategori):''}" placeholder="cth: Elektronik"></div>
      <div><label>Lokasi</label><input type="text" id="ifLokasi" value="${i?esc(i.lokasi||''):''}" placeholder="cth: Gudang"></div>
    </div>
    <label>Jumlah barang yang dimiliki, per kondisi</label>
    <div class="kon-row">
      <div><label>Baik</label><input type="number" id="ifBaik" min="0" inputmode="numeric" value="${r.baik}" oninput="hitungTotalAset()"></div>
      <div><label>Rusak ringan</label><input type="number" id="ifRingan" min="0" inputmode="numeric" value="${r.ringan}" oninput="hitungTotalAset()"></div>
      <div><label>Rusak berat</label><input type="number" id="ifBerat" min="0" inputmode="numeric" value="${r.berat}" oninput="hitungTotalAset()"></div>
    </div>
    <div class="kon-total" id="ifTotal">${teksTotalAset(r.baik + r.ringan + r.berat)}</div>
    <label>Catatan (opsional)</label><textarea id="ifCatatan">${i?esc(i.catatan||''):''}</textarea>
    <div class="btn-row" style="margin-top:12px;">
      ${i?`<button class="btn btn-danger" onclick="deleteInventaris('${i.id}')">Hapus</button>`:''}
      <button class="btn btn-primary" onclick="saveInventaris('${i?i.id:''}')">Simpan</button>
    </div>
  `);
}
function teksTotalAset(t){
  if(IF_KELUAR > 0){
    return `Total dimiliki: <b>${t}</b> barang · sedang keluar <b>${IF_KELUAR}</b>, ada di tempat <b>${Math.max(0, t - IF_KELUAR)}</b>`;
  }
  return `Total: <b>${t}</b> barang · ringan = rusak sedikit, berat = rusak parah`;
}
function hitungTotalAset(){
  const t = n0(document.getElementById('ifBaik').value) + n0(document.getElementById('ifRingan').value) + n0(document.getElementById('ifBerat').value);
  const el = document.getElementById('ifTotal');
  if(el) el.innerHTML = teksTotalAset(t);
}
function saveInventaris(id){
  const r = {
    baik: n0(document.getElementById('ifBaik').value),
    ringan: n0(document.getElementById('ifRingan').value),
    berat: n0(document.getElementById('ifBerat').value),
  };
  const total = r.baik + r.ringan + r.berat;
  const data = {
    nama: document.getElementById('ifNama').value.trim(),
    kategori: document.getElementById('ifKategori').value.trim(),
    jumlah: total,
    kondisiRinci: r,
    kondisi: kondisiTerburuk(r),
    lokasi: document.getElementById('ifLokasi').value.trim(),
    catatan: document.getElementById('ifCatatan').value.trim(),
  };
  if(!data.nama){ toast('Nama aset wajib diisi'); return; }
  if(!total){ toast('Isi dulu jumlahnya, minimal 1 barang'); return; }
  if(id){
    /* stok tidak boleh dikecilkan sampai lebih kecil dari yang sedang keluar */
    const keluar = pinjamAktif(id).reduce((s,p)=> s + (Number(p.jumlah)||0), 0);
    if(total < keluar){ toast(`Jumlah tidak boleh kurang dari barang yang sedang keluar (${keluar})`); return; }
    Object.assign(DB.inventaris.find(x=>x.id===id), data);
  } else DB.inventaris.push(Object.assign({id:uid('i')}, data));
  saveDB(); closeModal(); renderInventarisList(); toast('Data aset disimpan');
}
function deleteInventaris(id){
  const aktif = pinjamAktif(id);
  if(aktif.length && !confirm(`Aset ini masih tercatat keluar (${aktif.length} catatan belum kembali). Hapus aset beserta seluruh riwayat barang keluarnya?`)) return;
  DB.pinjam = (DB.pinjam||[]).filter(p=>p.asetId!==id);
  DB.inventaris = DB.inventaris.filter(x=>x.id!==id); saveDB(); closeModal(); renderInventarisList(); renderPinjamList();
}

/* ---------- BARANG KELUAR ----------
   Barang bisa keluar bukan cuma karena dipinjam: bisa dibawa laundry,
   diperbaiki, atau dibawa ke acara. Jenisnya disimpan di field `jenis`.
   Status internal tetap 'dipinjam' (artinya sedang di luar) dan 'kembali'
   supaya catatan lama yang belum punya `jenis` tetap terbaca apa adanya. */
let PJ_EDIT_ID = null;
const JENIS_KELUAR = [
  {id:'pinjam',  label:'Dipinjam',     ic:'🤝', bg:'var(--info-bg)',    fg:'var(--info)',    org:'Dipinjam oleh', ph:'cth: Pak Budi',        simpan:'Barang dipinjam'},
  {id:'laundry', label:'Dilaundry',    ic:'🧺', bg:'var(--success-bg)', fg:'var(--success)', org:'Dibawa oleh',   ph:'cth: Bu Sri',          simpan:'Barang dilaundry'},
  {id:'servis',  label:'Diperbaiki',   ic:'🔧', bg:'var(--warning-bg)', fg:'var(--warning)', org:'Dibawa ke',     ph:'cth: Toko Elektronik', simpan:'Barang diperbaiki'},
  {id:'acara',   label:'Dibawa acara', ic:'🚚', bg:'var(--c-keluar-bg)',fg:'var(--c-keluar)',org:'Dibawa oleh',   ph:'cth: Panitia kajian',  simpan:'Barang dibawa ke acara'}
];
function jenisKeluar(p){ return JENIS_KELUAR.find(j=>j.id===(p && p.jenis)) || JENIS_KELUAR[0]; }
function pinjamAktif(asetId){ return (DB.pinjam||[]).filter(p=>p.asetId===asetId && p.status==='dipinjam'); }
function tersediaAset(a){ return (Number(a.jumlah)||0) - pinjamAktif(a.id).reduce((s,p)=>s+(Number(p.jumlah)||0),0); }
function renderPinjamList(){
  const wrap = document.getElementById('pinjamListWrap'); if(!wrap) return;
  const list = DB.pinjam||[];
  const aktif = list.filter(p=>p.status==='dipinjam');
  const ck = document.getElementById('invCountKeluar');
  if(ck){ ck.textContent = aktif.length; ck.style.display = aktif.length ? '' : 'none'; }
  const urut = [...list].sort((a,b)=> ((a.status==='dipinjam'?0:1)-(b.status==='dipinjam'?0:1)) || String(b.tglPinjam||'').localeCompare(String(a.tglPinjam||'')));
  wrap.innerHTML = (urut.length ? urut.map(p=>{
    const j = jenisKeluar(p), kembali = p.status==='kembali';
    return `
    <button type="button" class="list-item" style="cursor:pointer;" onclick="openPinjamForm('${p.id}')">
      <div class="avatar" style="background:${j.bg};color:${j.fg};">${j.ic}</div>
      <div class="meta"><div class="t">${esc(p.namaAset)} × ${p.jumlah}</div><div class="s">${j.label} · ${esc(p.peminjam)}${p.kontak?` · ${esc(p.kontak)}`:''} · ${p.tglPinjam}${p.tglRencana?` → rencana ${p.tglRencana}`:''}${kembali&&p.tglKembali?` · kembali ${p.tglKembali}`:''}</div></div>
      <div class="right"><div class="badge ${kembali?'kembali':'dipinjam'}">${kembali?'🔒 Kembali':'Keluar'}</div></div>
    </button>`; }).join('') : `<div class="empty"><div class="ic">🚪</div><div class="t">Belum ada barang keluar</div><div class="s">Catat barang yang dipinjam, dilaundry, diperbaiki, atau dibawa ke acara</div></div>`);
}
function openPinjamForm(id){
  PJ_EDIT_ID = id || null;
  const p = id ? (DB.pinjam||[]).find(x=>x.id===id) : null;
  if(!DB.inventaris.length && !p){ toast('Tambahkan aset dulu sebelum mencatat barang keluar'); return; }
  /* Catatan yang barangnya sudah kembali bersifat terkunci (hanya bisa dilihat
     dan dihapus), supaya riwayat keluar-masuk tidak bisa diubah belakangan. */
  if(p && p.status==='kembali'){ return openPinjamDetail(p); }
  const j = jenisKeluar(p);
  const asetId = p ? p.asetId : (DB.inventaris[0] && DB.inventaris[0].id);
  const opsi = DB.inventaris.map(a=>{
    const tersisa = tersediaAset(a) + (p && p.asetId===a.id ? (Number(p.jumlah)||0) : 0);
    return `<option value="${a.id}" ${asetId===a.id?'selected':''}>${esc(a.nama)} — tersedia ${tersisa}/${a.jumlah}</option>`;
  }).join('');
  openModal(`
    <div class="modal-head"><h2>${p?'Edit':'Catat'} Barang Keluar</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <label>Barang keluar karena</label>
    <div class="up-chips" id="pjJenisChips">
      ${JENIS_KELUAR.map(x=>`<button type="button" class="up-chip${x.id===j.id?' on':''}" data-j="${x.id}" onclick="pjJenisSet('${x.id}')">${x.ic} ${x.label}</button>`).join('')}
    </div>
    <label>Barang (aset)</label><select id="pjAset" onchange="pjAsetChange()">${opsi}</select>
    <div class="field-row">
      <div><label>Jumlah</label><input type="number" id="pjJumlah" min="1" value="${p? p.jumlah : 1}"></div>
      <div><label>Tgl keluar</label><input type="date" id="pjTgl" value="${p? p.tglPinjam : todayStr()}"></div>
    </div>
    <label id="pjOrgLabel">${j.org}</label><input type="text" id="pjPeminjam" value="${p?esc(p.peminjam):''}" placeholder="${j.ph}">
    <label>Kontak / WA (opsional)</label><input type="text" id="pjKontak" value="${p?esc(p.kontak||''):''}">
    <label>Rencana kembali (opsional)</label><input type="date" id="pjRencana" value="${p?esc(p.tglRencana||''):''}">
    <label>Catatan (opsional)</label><textarea id="pjCatatan">${p?esc(p.catatan||''):''}</textarea>
    <div class="btn-row">
      ${p?`<button class="btn btn-danger btn-round btn-em" title="Hapus catatan" aria-label="Hapus catatan barang keluar" onclick="askDeletePinjam('${p.id}')">🗑️</button>`:''}
      ${p
        ? `<button class="btn btn-primary btn-round btn-em" title="Simpan" aria-label="Simpan" onclick="savePinjam('${p.id}')">💾</button>`
        : `<button class="btn btn-primary" onclick="savePinjam('')">💾 Simpan</button>`}
      ${p && p.status==='dipinjam' ? `<button class="btn btn-hijau" onclick="askTandaiKembali('${p.id}')">${j.id==='servis'?'Sudah Selesai':'Sudah Kembali'}</button>`:''}
    </div>
  `);
  pjAsetChange();
}
/* Catatan yang sudah kembali tampil sebagai detail terkunci: tanpa isian,
   tanpa tombol Simpan — cuma bisa dihapus kalau memang salah catat. */
function openPinjamDetail(p){
  const j = jenisKeluar(p);
  openModal(`
    <div class="modal-head"><h2>${j.ic} Detail Barang Keluar</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="total-row"><span>Barang</span><span>${esc(p.namaAset)}</span></div>
    <div class="total-row"><span>Jumlah</span><span>${p.jumlah}</span></div>
    <div class="total-row"><span>Alasan keluar</span><span>${j.label}</span></div>
    <div class="total-row"><span>${j.org}</span><span>${esc(p.peminjam||'-')}</span></div>
    ${p.kontak?`<div class="total-row"><span>Kontak</span><span>${esc(p.kontak)}</span></div>`:''}
    <div class="total-row"><span>Tgl keluar</span><span>${p.tglPinjam||'-'}</span></div>
    ${p.tglRencana?`<div class="total-row"><span>Rencana kembali</span><span>${p.tglRencana}</span></div>`:''}
    <div class="total-row big"><span>Kembali</span><span>${p.tglKembali||'-'}</span></div>
    ${p.catatan?`<hr class="sep"><p class="muted">${esc(p.catatan)}</p>`:''}
    <p class="muted" style="margin-top:12px;">🔒 Barangnya sudah kembali, jadi catatan ini terkunci dan tidak bisa diubah. Kalau ada yang salah, hapus catatannya lalu buat yang baru.</p>
    <div class="btn-row" style="margin-top:14px;">
      <button class="btn btn-danger" onclick="askDeletePinjam('${p.id}')">🗑️ Hapus</button>
      <button class="btn btn-primary" onclick="closeModal()">Tutup</button>
    </div>
  `);
}
function askDeletePinjam(id){
  openModal(`
    <div class="modal-head"><h2>Hapus Catatan?</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <p class="muted">Catatan barang keluar ini akan dihapus permanen. Stok barangnya kembali seperti sebelum dicatat.</p>
    <div class="btn-row" style="margin-top:14px;"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-danger" onclick="deletePinjam('${id}')">Ya, Hapus</button></div>
  `);
}
/* Ganti jenis barang keluar: cukup label & contoh isian yang ikut berubah,
   isian lain dibiarkan supaya yang sudah diketik tidak hilang. */
function pjJenisSet(jid){
  const j = JENIS_KELUAR.find(x=>x.id===jid); if(!j) return;
  document.querySelectorAll('#pjJenisChips .up-chip').forEach(b=>b.classList.toggle('on', b.dataset.j===jid));
  const lb = document.getElementById('pjOrgLabel'); if(lb) lb.textContent = j.org;
  const inp = document.getElementById('pjPeminjam'); if(inp) inp.placeholder = j.ph;
}
function jenisTerpilih(){
  const on = document.querySelector('#pjJenisChips .up-chip.on');
  return on ? on.dataset.j : 'pinjam';
}
function pjAsetChange(){
  const a = DB.inventaris.find(x=>x.id===document.getElementById('pjAset').value); if(!a) return;
  const p = PJ_EDIT_ID ? (DB.pinjam||[]).find(x=>x.id===PJ_EDIT_ID) : null;
  const extra = (p && p.asetId===a.id) ? (Number(p.jumlah)||0) : 0;
  const el = document.getElementById('pjJumlah'); if(el) el.max = Math.max(1, tersediaAset(a)+extra);
}
function savePinjam(id){
  const aset = DB.inventaris.find(x=>x.id===document.getElementById('pjAset').value);
  if(!aset){ toast('Pilih barang yang valid'); return; }
  /* Pengaman kedua: catatan yang sudah kembali memang tidak boleh diubah. */
  const lama = id ? (DB.pinjam||[]).find(x=>x.id===id) : null;
  if(lama && lama.status==='kembali'){ toast('Catatan yang sudah kembali tidak bisa diubah'); return; }
  const j = JENIS_KELUAR.find(x=>x.id===jenisTerpilih()) || JENIS_KELUAR[0];
  const data = {
    asetId: aset.id, namaAset: aset.nama, jenis: j.id,
    jumlah: Math.max(1, Number(document.getElementById('pjJumlah').value)||1),
    tglPinjam: document.getElementById('pjTgl').value || todayStr(),
    peminjam: document.getElementById('pjPeminjam').value.trim(),
    kontak: document.getElementById('pjKontak').value.trim(),
    tglRencana: document.getElementById('pjRencana').value || '',
    catatan: document.getElementById('pjCatatan').value.trim(),
  };
  if(!data.peminjam){ toast(`Kolom "${j.org}" belum diisi`); return; }
  const terpakai = pinjamAktif(aset.id).reduce((s,p)=> s + (p.id===id?0:(Number(p.jumlah)||0)), 0);
  const max = (Number(aset.jumlah)||0) - terpakai;
  if(data.jumlah > max){ toast(`Jumlah melebihi stok tersedia (${max})`); return; }
  if(id) Object.assign((DB.pinjam||[]).find(x=>x.id===id), data);
  else DB.pinjam.push(Object.assign({id:uid('p'), status:'dipinjam', tglKembali:''}, data));
  saveDB(); closeModal(); renderInventarisList(); renderPinjamList(); toast(`${j.simpan} — tercatat`);
}
function askTandaiKembali(id){
  const p = (DB.pinjam||[]).find(x=>x.id===id); if(!p) return;
  const j = jenisKeluar(p);
  openModal(`
    <div class="modal-head"><h2>${j.ic} ${j.id==='servis'?'Sudah Selesai?':'Barang Sudah Kembali?'}</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <p class="muted">Setelah ditandai, catatan ini <b>terkunci</b> — datanya tidak bisa diubah lagi (masih bisa dilihat dan dihapus).</p>
    <div class="btn-row" style="margin-top:14px;"><button class="btn btn-secondary" onclick="openPinjamForm('${p.id}')">Batal</button><button class="btn btn-hijau" onclick="tandaiKembali('${p.id}')">${j.id==='servis'?'Ya, Sudah Selesai':'Ya, Sudah Kembali'}</button></div>
  `);
}
function tandaiKembali(id){
  const p = (DB.pinjam||[]).find(x=>x.id===id); if(!p) return;
  const j = jenisKeluar(p);
  p.status='kembali'; p.tglKembali = todayStr();
  saveDB(); closeModal(); renderInventarisList(); renderPinjamList(); toast(j.id==='servis' ? 'Barang sudah selesai diperbaiki' : 'Barang sudah kembali');
}
function deletePinjam(id){ DB.pinjam = (DB.pinjam||[]).filter(x=>x.id!==id); saveDB(); closeModal(); renderInventarisList(); renderPinjamList(); toast('Catatan barang keluar dihapus'); }

/* =========================================================
   LAPORAN
   ========================================================= */
let lapRange='bulanan';
let lapNavOpen=false; /* panel periode (‹ bulan › / input tanggal) hanya tampil saat filter periode aktif & dibuka */
let lapAnchor=todayStr();
let lapCustomFrom=todayStr().slice(0,8)+'01';
let lapCustomTo=todayStr();
const BULAN_ID=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const isoLocal=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function weekBounds(anchor){
  const d=new Date(anchor+'T00:00:00'), dow=(d.getDay()+6)%7;
  const s=new Date(d); s.setDate(d.getDate()-dow);
  const e=new Date(s); e.setDate(s.getDate()+6);
  return [isoLocal(s),isoLocal(e)];
}
function monthBounds(anchor){
  const [y,m]=anchor.split('-').map(Number);
  return [isoLocal(new Date(y,m-1,1)),isoLocal(new Date(y,m,0))];
}
function lapBounds(){
  if(lapRange==='mingguan') return weekBounds(lapAnchor);
  if(lapRange==='custom') return [lapCustomFrom,lapCustomTo];
  return monthBounds(lapAnchor);
}
/* Gate (v1.5.6): kunci per-range Laporan — "laporan.bulanan" & "laporan.custom" terkunci;
   mode mingguan tetap bisa diakses (yang dikunci hanya geser periode, lihat lapNav). */
function lapRangeKey(r){ return r === 'bulanan' ? 'laporan.bulanan' : r === 'custom' ? 'laporan.custom' : null; }
function setLaporanRange(r){
  const fk = lapRangeKey(r);
  if (fk && Platform.isHidden(fk)) return; /* tab disembunyikan → tidak bisa dibuka */
  if (fk && !Platform.requireFeature(fk, (Platform.proFeatures[fk] || {}).label || r)) return;
  /* Tap filter yang sedang aktif & panel terbuka → tutup panel periode.
     Tap filter lain (atau filter aktif saat panel tertutup) → aktifkan & buka. */
  if(lapRange===r && lapNavOpen){ lapNavOpen=false; }
  else { lapRange=r; lapNavOpen=true; }
  renderLaporan();
}
function renderLapDateNav(){
  const nav=document.getElementById('lapDateNav'); if(!nav) return;
  /* Saklar "hide" pada geser periode ‹ › → panel periode tidak pernah terbuka. */
  if (typeof Platform !== 'undefined' && Platform.isHidden && Platform.isHidden('laporan.mingguan.nav')) lapNavOpen = false;
  document.querySelectorAll('#view-laporan .tab').forEach(t=>{
    const on = t.dataset.r===lapRange;
    t.classList.toggle('active', on);
    /* tab = tombol → beri role + bisa diakses keyboard, supaya aria-expanded sah */
    t.setAttribute('role','button');
    t.setAttribute('tabindex','0');
    if(!t.dataset.kb){
      t.dataset.kb='1';
      t.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); t.click(); } });
    }
    if(on){ t.setAttribute('aria-expanded', lapNavOpen ? 'true' : 'false'); t.setAttribute('aria-controls','lapDateNav'); }
    else { t.removeAttribute('aria-expanded'); t.removeAttribute('aria-controls'); }
  });
  nav.hidden = !lapNavOpen;
  if(!lapNavOpen){ nav.innerHTML=''; return; }
  if(lapRange==='custom'){
    nav.innerHTML=`<input type="date" class="custom-date-input" id="lapFrom" value="${lapCustomFrom}" onchange="setLapCustom(this.value,'from')" aria-label="Dari tanggal"><span class="dn-sep">–</span><input type="date" class="custom-date-input" id="lapTo" value="${lapCustomTo}" onchange="setLapCustom(this.value,'to')" aria-label="Sampai tanggal">`;
    return;
  }
  let label;
  if(lapRange==='mingguan'){ const [s,e]=weekBounds(lapAnchor); label=`${fmtDateOnly(s).replace(/ \d{4}$/,'')} – ${fmtDateOnly(e)}`; }
  else { const [y,m]=lapAnchor.split('-').map(Number); label=`${BULAN_ID[m-1]} ${y}`; }
  nav.innerHTML=`<button class="date-btn" onclick="lapNav(-1)" aria-label="Periode sebelumnya">‹</button><div class="date-label">${label}</div><button class="date-btn" onclick="lapNav(1)" aria-label="Periode berikutnya">›</button>`;
}
function lapNav(dir){
  /* Gate (v1.5.6): geser periode ‹ › terkunci — saat mode mingguan dikunci lewat
     "laporan.mingguan.nav" (user hanya bisa lihat minggu ini); range lain mengikuti
     kunci range-nya masing-masing. */
  const fk = lapRange === 'mingguan' ? 'laporan.mingguan.nav' : lapRangeKey(lapRange);
  if (fk && Platform.isHidden(fk)) return; /* disembunyikan → tidak bisa digeser */
  if (fk && !Platform.requireFeature(fk, (Platform.proFeatures[fk] || {}).label || 'Laporan')) return;
  const d=new Date(lapAnchor+'T00:00:00');
  if(lapRange==='mingguan') d.setDate(d.getDate()+dir*7); else d.setMonth(d.getMonth()+dir);
  lapAnchor=isoLocal(d);
  renderLaporan();
}
function setLapCustom(v,side){
  if(!v) return;
  if(side==='from'){ lapCustomFrom=v; if(lapCustomTo<v) lapCustomTo=v; }
  else { lapCustomTo=v; if(lapCustomFrom>v) lapCustomFrom=v; }
  renderLaporan();
}
function inRange(iso){
  const [f,t]=lapBounds();
  const d=isoLocal(new Date(iso));
  return d>=f && d<=t;
}

/* ---------- Bahan laporan ----------
   Uang pinjaman (kategori Pinjam Kas & Bayar Pinjaman) dipisah dari hitungan
   pemasukan/pengeluaran: uang yang dipinjamkan bukan belanja masjid, dan uang
   yang kembali bukan donasi baru. Kalau dicampur, angka laporan jadi menyesatkan. */
let lapTrxShowAll = false;
const isPinjamKat = k => k.kategori === KAS_KAT_PINJAM || k.kategori === KAS_KAT_BAYAR;
const tglKas = k => isoLocal(new Date(k.tanggal));
function geserHari(iso, n){
  const d = new Date(iso+'T00:00:00'); d.setDate(d.getDate()+n); return isoLocal(d);
}
function jumlahHariPeriode(f,t){
  return Math.round((new Date(t+'T00:00:00') - new Date(f+'T00:00:00'))/86400000) + 1;
}
/* Saldo kas per akhir tanggal tertentu — semua transaksi sampai tanggal itu. */
function saldoPerTanggal(isoEnd){
  return DB.kas.reduce((a,k)=> (!kasDihitung(k) || tglKas(k) > isoEnd) ? a : a + (k.tipe==='masuk' ? Number(k.jumlah||0) : -Number(k.jumlah||0)), 0);
}
/* Periode pembanding: rentang sepanjang periode ini, tepat sebelumnya. */
function lapPrevBounds(){
  const [f,t] = lapBounds();
  const len = jumlahHariPeriode(f,t);
  return [geserHari(f,-len), geserHari(f,-1)];
}
function lapLabelPeriode(){
  const [f,t] = lapBounds();
  if(lapRange==='bulanan'){ const [y,m]=lapAnchor.split('-').map(Number); return `${BULAN_ID[m-1]} ${y}`; }
  if(lapRange==='mingguan') return `${fmtDateOnly(f).replace(/ \d{4}$/,'')} – ${fmtDateOnly(t)}`;
  return `${fmtDateOnly(f)} – ${fmtDateOnly(t)}`;
}
/* Ringkasan satu rentang: angka bersih (tanpa pinjaman) + semua catatan mentah. */
function lapRingkas(f,t){
  const semua = DB.kas.filter(k=>{ const d=tglKas(k); return d>=f && d<=t; });
  const kas = semua.filter(k=>!isPinjamKat(k) && kasDihitung(k));
  const jml = (arr,tipe)=>arr.filter(k=>k.tipe===tipe).reduce((a,k)=>a+Number(k.jumlah||0),0);
  return {
    semua,
    masuk: jml(kas,'masuk'), keluar: jml(kas,'keluar'),
    nMasuk: kas.filter(k=>k.tipe==='masuk').length,
    nKeluar: kas.filter(k=>k.tipe==='keluar').length,
    pinjamKeluar: jml(semua.filter(k=>k.kategori===KAS_KAT_PINJAM),'keluar'),
    pinjamMasuk: jml(semua.filter(k=>k.kategori===KAS_KAT_BAYAR),'masuk')
  };
}
function persenDelta(cur, prev){
  if(!(prev > 0)) return cur > 0 ? '<span class="up">baru</span>' : '';
  const p = Math.round(((cur-prev)/prev)*100);
  if(p === 0) return 'sama';
  return p > 0 ? `<span class="up">▲ ${p}%</span> dari periode lalu`
               : `<span class="down">▼ ${Math.abs(p)}%</span> dari periode lalu`;
}
/* Kelompok grafik: per hari untuk periode pendek, dibagi rata (maks ~10 kolom)
   untuk periode panjang supaya batangnya tetap kebaca di layar HP. */
function lapChartGroups(f,t){
  const hari = jumlahHariPeriode(f,t);
  const chunk = hari <= 14 ? 1 : Math.ceil(hari/10);
  const cols = [];
  const kas = DB.kas.filter(k=>!isPinjamKat(k));
  for(let i=0;i<hari;i++){
    const d = geserHari(f,i);
    const ci = Math.floor(i/chunk);
    if(!cols[ci]){
      const d0 = new Date(d+'T00:00:00');
      cols[ci] = { label: chunk===1 ? String(d0.getDate()) : String(d0.getDate()), masuk:0, keluar:0, dari:d, sampai:d };
    }
    cols[ci].sampai = d;
    kas.filter(k=>tglKas(k)===d).forEach(k=>{
      const n = Number(k.jumlah||0);
      if(k.tipe==='masuk') cols[ci].masuk += n; else cols[ci].keluar += n;
    });
  }
  return cols.filter(Boolean);
}
function lapKategoriHTML(list, tipe){
  if(!list.length) return `<p class="muted">Belum ada data ${tipe==='masuk'?'pemasukan':'pengeluaran'} di periode ini.</p>`;
  const total = list.reduce((a,x)=>a+x[1],0);
  return list.map(([k,v])=>{
    const pct = total ? Math.round(v/total*100) : 0;
    return `<div class="lap-cat">
      <div class="lap-cat-top"><span class="n">${esc(k)}</span><span class="v">${fmtRp(v)}<span class="pct">${pct}%</span></span></div>
      <div class="lap-track"><div class="lap-fill ${tipe==='masuk'?'in':'out'}" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');
}

function renderLaporan(){
  /* Saklar "hide" pada range aktif → pindah ke Mingguan (selalu tampil). */
  if (typeof Platform !== 'undefined' && Platform.isHidden && lapRangeKey(lapRange) && Platform.isHidden('laporan.' + lapRange)) { lapRange = 'mingguan'; lapNavOpen = false; }
  renderLapDateNav();
  const [f,t] = lapBounds();
  const now = lapRingkas(f,t);
  const [pf,pt] = lapPrevBounds();
  const prev = lapRingkas(pf,pt);
  const hari = jumlahHariPeriode(f,t);
  const saldoAwal = saldoPerTanggal(geserHari(f,-1));
  const saldoAkhir = saldoPerTanggal(t);
  const selisih = now.masuk - now.keluar;

  document.getElementById('lapMasuk').textContent = fmtRp(now.masuk);
  document.getElementById('lapKeluar').textContent = fmtRp(now.keluar);
  document.getElementById('lapSelisih').textContent = fmtRp(selisih);
  document.getElementById('lapSaldo').textContent = fmtRp(saldoAkhir);
  /* Bagian sub-angka: yang kosong dibuang supaya tidak ada "·" menggantung. */
  const sub = (...b) => b.filter(x=>x && String(x).trim()).join(' · ');
  document.getElementById('lapMasukSub').innerHTML = sub(`${now.nMasuk} transaksi`, persenDelta(now.masuk, prev.masuk));
  document.getElementById('lapKeluarSub').innerHTML = sub(`${now.nKeluar} transaksi`, persenDelta(now.keluar, prev.keluar));
  document.getElementById('lapSelisihSub').innerHTML = sub(`Rata-rata ${fmtRp(Math.round(selisih/hari))}/hari`, `${hari} hari`);
  document.getElementById('lapSaldoSub').innerHTML = sub(`Saldo awal ${fmtRp(saldoAwal)}`);

  /* Kartu pinjaman hanya muncul kalau memang ada uang pinjaman yang bergerak
     di periode ini atau masih ada pinjaman berjalan. */
  const aktif = (typeof totalPinjamKasAktif === 'function') ? totalPinjamKasAktif() : 0;
  const cardPinjam = document.getElementById('lapPinjamCard');
  if(cardPinjam){
    /* Tampil kalau ada uang pinjaman yang bergerak di periode ini, atau kalau
       periode ini sedang berjalan & masih ada pinjaman yang belum kembali. */
    const adaGerak = now.pinjamKeluar || now.pinjamMasuk;
    const periodeBerjalan = t >= todayStr();
    const ada = adaGerak || (aktif && periodeBerjalan);
    cardPinjam.hidden = !ada;
    if(ada){
      document.getElementById('lapPinjamKeluar').textContent = fmtRp(now.pinjamKeluar);
      document.getElementById('lapPinjamMasuk').textContent = fmtRp(now.pinjamMasuk);
      document.getElementById('lapPinjamNet').textContent = fmtRp(now.pinjamMasuk - now.pinjamKeluar);
      document.getElementById('lapPinjamAktif').textContent = fmtRp(aktif);
    }
  }

  /* Grafik tren */
  const g = lapChartGroups(f,t);
  const max = Math.max(1, ...g.map(x=>Math.max(x.masuk, x.keluar)));
  const chart = document.getElementById('lapChart');
  if(chart){
    const adaData = g.some(x=>x.masuk || x.keluar);
    chart.innerHTML = adaData ? g.map(x=>`
      <div class="col" title="${esc(x.dari===x.sampai ? fmtDateOnly(x.dari) : fmtDateOnly(x.dari)+' – '+fmtDateOnly(x.sampai))}: masuk ${fmtRp(x.masuk)}, keluar ${fmtRp(x.keluar)}">
        <div class="bars">
          <div class="bar in" style="height:${Math.round(x.masuk/max*100)}%"></div>
          <div class="bar out" style="height:${Math.round(x.keluar/max*100)}%"></div>
        </div>
        <div class="x">${esc(x.label)}</div>
      </div>`).join('')
      : `<div class="muted" style="font-size:12.5px;align-self:center;width:100%;text-align:center;">Belum ada transaksi di periode ini.</div>`;
  }

  /* Rincian per kategori (tanpa pinjaman) */
  const byCat = (tipe) => {
    const m = {};
    DB.kas.filter(k=>!isPinjamKat(k) && kasDihitung(k) && k.tipe===tipe)
      .filter(k=>{ const d=tglKas(k); return d>=f && d<=t; })
      .forEach(k=>{ m[k.kategori]=(m[k.kategori]||0)+Number(k.jumlah||0); });
    return Object.entries(m).sort((a,b)=>b[1]-a[1]);
  };
  document.getElementById('lapKategoriMasuk').innerHTML = lapKategoriHTML(byCat('masuk'),'masuk');
  document.getElementById('lapKategoriKeluar').innerHTML = lapKategoriHTML(byCat('keluar'),'keluar');

  /* Daftar transaksi periode (dibatasi 8 baris, sisanya lewat tombol) */
  const rows = now.semua.slice().sort((a,b)=> String(b.tanggal).localeCompare(String(a.tanggal)));
  const judul = document.getElementById('lapTrxTitle');
  if(judul) judul.textContent = `Transaksi Periode Ini (${rows.length})`;
  const boxTrx = document.getElementById('lapTrxList');
  if(boxTrx){
    if(!rows.length){
      boxTrx.innerHTML = `<div class="empty"><div class="ic">🧾</div><div class="t">Belum ada transaksi</div><div class="s">Coba pilih periode lain.</div></div>`;
    } else {
      const tampil = lapTrxShowAll ? rows : rows.slice(0,8);
      boxTrx.innerHTML = tampil.map(kasRowHTML).join('')
        + (rows.length > 8 ? `<button class="btn btn-secondary btn-sm" style="margin-top:10px;" onclick="lapTrxToggle()">${lapTrxShowAll ? 'Sembunyikan' : 'Lihat semua '+rows.length+' transaksi'}</button>` : '');
    }
  }
}
function lapTrxToggle(){ lapTrxShowAll = !lapTrxShowAll; renderLaporan(); }

/* ---------- Cetak laporan (browser: bisa langsung print atau Simpan PDF) ---------- */
function laporanCetakHTML(){
  const [f,t] = lapBounds();
  const now = lapRingkas(f,t);
  const saldoAwal = saldoPerTanggal(geserHari(f,-1));
  const saldoAkhir = saldoPerTanggal(t);
  const S = DB.settings || {};
  const nama = S.namaMasjid || 'Masjid';
  const byCat = (tipe) => {
    const m = {};
    DB.kas.filter(k=>!isPinjamKat(k) && kasDihitung(k) && k.tipe===tipe)
      .filter(k=>{ const d=tglKas(k); return d>=f && d<=t; })
      .forEach(k=>{ m[k.kategori]=(m[k.kategori]||0)+Number(k.jumlah||0); });
    return Object.entries(m).sort((a,b)=>b[1]-a[1]);
  };
  const trx = now.semua.slice().sort((a,b)=> String(a.tanggal).localeCompare(String(b.tanggal)));
  const rowKat = (list) => list.length
    ? list.map(([k,v])=>`<tr><td>${esc(k)}</td><td class="r">${fmtRp(v)}</td></tr>`).join('')
    : '<tr><td colspan="2" class="mut">—</td></tr>';
  const rowTrx = (k) => {
    const isMasuk = k.tipe === 'masuk';
    return `<tr><td class="nowrap">${fmtDateOnly(k.tanggal)}</td><td>${esc(k.kategori)}${k.keterangan?`<div class="mut">${esc(k.keterangan)}</div>`:''}</td><td class="r">${isMasuk?'+':'−'}${fmtRp(k.jumlah)}</td></tr>`;
  };
  return `<!doctype html><html lang="id"><head><meta charset="utf-8">
  <title>Laporan Kas ${esc(nama)} — ${esc(lapLabelPeriode())}</title>
  <style>
    @page{margin:14mm 12mm;}
    body{font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#1f1a16;font-size:12px;margin:0;}
    h1{font-size:17px;margin:0 0 2px;}
    h2{font-size:14px;margin:0 0 2px;}
    .sub{font-size:11px;color:#6b5e55;}
    .hr{border-top:1px solid #d9cfc7;margin:10px 0;}
    table{width:100%;border-collapse:collapse;margin:4px 0 10px;}
    th,td{padding:5px 6px;border-bottom:1px solid #eae2db;text-align:left;vertical-align:top;}
    th{font-size:11px;text-transform:uppercase;letter-spacing:.3px;color:#6b5e55;}
    td.r,th.r{text-align:right;white-space:nowrap;}
    .nowrap{white-space:nowrap;}
    .mut{color:#6b5e55;font-size:11px;}
    .box{border:1px solid #d9cfc7;border-radius:6px;padding:8px 10px;}
    .big{font-size:14px;font-weight:700;}
    .foot{margin-top:14px;font-size:10.5px;color:#6b5e55;}
    .grid{display:flex;gap:10px;}
    .grid > div{flex:1;}
  </style></head><body>
  <h1>${esc(nama)}</h1>
  ${S.alamat?`<div class="sub">${esc(S.alamat)}</div>`:''}
  <div class="hr"></div>
  <h2>Laporan Kas — ${esc(lapLabelPeriode())}</h2>
  <div class="sub">Periode ${fmtDateOnly(f)} s/d ${fmtDateOnly(t)}</div>
  <table>
    <tr><th>Keterangan</th><th class="r">Jumlah</th></tr>
    <tr><td>Pemasukan (${now.nMasuk} transaksi)</td><td class="r">${fmtRp(now.masuk)}</td></tr>
    <tr><td>Pengeluaran (${now.nKeluar} transaksi)</td><td class="r">${fmtRp(now.keluar)}</td></tr>
    <tr><td class="big">Selisih periode ini</td><td class="r big">${fmtRp(now.masuk-now.keluar)}</td></tr>
    <tr><td>Saldo awal periode</td><td class="r">${fmtRp(saldoAwal)}</td></tr>
    <tr><td>Saldo akhir periode</td><td class="r">${fmtRp(saldoAkhir)}</td></tr>
  </table>
  ${(now.pinjamKeluar||now.pinjamMasuk)?`<div class="box"><b>Uang pinjaman (tidak dihitung di atas)</b>
    <table style="margin:6px 0 0;">
      <tr><td>Dipinjamkan periode ini</td><td class="r">${fmtRp(now.pinjamKeluar)}</td></tr>
      <tr><td>Dikembalikan periode ini</td><td class="r">${fmtRp(now.pinjamMasuk)}</td></tr>
      <tr><td>Selisih pinjaman (ikut mengubah saldo)</td><td class="r">${fmtRp(now.pinjamMasuk-now.pinjamKeluar)}</td></tr>
    </table></div><div style="height:10px;"></div>`:''}
  <div class="grid">
    <div><h2>Pemasukan per Kategori</h2><table>${rowKat(byCat('masuk'))}</table></div>
    <div><h2>Pengeluaran per Kategori</h2><table>${rowKat(byCat('keluar'))}</table></div>
  </div>
  <h2>Daftar Transaksi (${trx.length})</h2>
  <table>
    <tr><th>Tanggal</th><th>Kategori</th><th class="r">Jumlah</th></tr>
    ${trx.length ? trx.map(rowTrx).join('') : '<tr><td colspan="3" class="mut">Belum ada transaksi.</td></tr>'}
  </table>
  <div class="foot">Dicetak ${fmtDateTime(new Date().toISOString())} · Kasir Solo - Masjid v${esc(window.APP_VERSION||'')}</div>
  </body></html>`;
}
let lapPrintBusy = false;
function printLaporan(){
  if(lapPrintBusy){ toast('Tunggu sebentar…'); return; }
  lapPrintBusy = true;
  const html = laporanCetakHTML();
  const lama = document.getElementById('lapPrintFrame'); if(lama) lama.remove();
  const fr = document.createElement('iframe');
  fr.id = 'lapPrintFrame';
  fr.setAttribute('aria-hidden','true');
  fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(fr);
  try{
    const doc = fr.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
  }catch(e){ lapPrintBusy = false; toast('Gagal menyiapkan laporan'); return; }
  setTimeout(()=>{
    try{ fr.contentWindow.focus(); fr.contentWindow.print(); }
    catch(e){ toast('Cetak tidak tersedia di perangkat ini'); }
    setTimeout(()=>{ lapPrintBusy = false; }, 1500);
  }, 500);
}

/* ---------- Bagikan ringkasan ke WA ---------- */
function ringkasanLaporanTeks(){
  const [f,t] = lapBounds();
  const now = lapRingkas(f,t);
  const saldoAwal = saldoPerTanggal(geserHari(f,-1));
  const saldoAkhir = saldoPerTanggal(t);
  const nama = (DB.settings && DB.settings.namaMasjid) || 'Masjid';
  const L = [];
  L.push(`*Laporan Kas — ${nama}*`);
  L.push(`Periode: ${lapLabelPeriode()}`);
  L.push('');
  L.push(`Pemasukan: ${fmtRp(now.masuk)} (${now.nMasuk} transaksi)`);
  L.push(`Pengeluaran: ${fmtRp(now.keluar)} (${now.nKeluar} transaksi)`);
  L.push(`Selisih: ${fmtRp(now.masuk-now.keluar)}`);
  L.push('');
  L.push(`Saldo awal: ${fmtRp(saldoAwal)}`);
  L.push(`Saldo akhir: ${fmtRp(saldoAkhir)}`);
  if(now.pinjamKeluar || now.pinjamMasuk){
    L.push('');
    L.push(`Pinjaman keluar: ${fmtRp(now.pinjamKeluar)}`);
    L.push(`Pinjaman kembali: ${fmtRp(now.pinjamMasuk)}`);
    L.push(`Selisih pinjaman: ${fmtRp(now.pinjamMasuk-now.pinjamKeluar)} (ikut mengubah saldo)`);
  }
  L.push('');
  L.push('_Angka pemasukan/pengeluaran belum termasuk uang pinjaman._');
  return L.join('\n');
}
function bagikanLaporanWA(){
  const txt = ringkasanLaporanTeks();
  let ok = false;
  try{
    const w = window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank');
    ok = !!w;
  }catch(e){ ok = false; }
  if(!ok){
    try{ navigator.clipboard.writeText(txt); toast('Ringkasan disalin — tempel di WA'); }
    catch(e){ toast('Tidak bisa membuka WA di perangkat ini'); }
  }
}

/* =========================================================
   PENGATURAN
   ========================================================= */
function fillSettingsForm(){
  const S = DB.settings||{};
  const setRow = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v || '—'; };
  setRow('rowNamaMasjid', S.namaMasjid);
  setRow('rowAlamat', S.alamat);
  setRow('rowTakmir', S.takmir);
  setRow('rowWA', S.wa);
  /* Tidak ada lagi input token/slug manual — slug & token publikasi diurus server
     lewat sesi akun (lihat modul HUB). DB.settings.pubSlug hanya cache lokal
     dari slug yang server balancerikan. */
  document.getElementById('licenseStatusBox').textContent = licenseInfoText();
  // Baris akun (v1.3.0): identitas sesi + status lisensi akun
  try {
    const akun = (typeof Akun !== 'undefined' && Akun.info()) || null;
    setRow('rowAkunWa', akun ? '0' + String(akun.wa).slice(2) : 'Belum masuk');
    setRow('rowAkunStatus', !akun ? 'Masuk dengan WA + PIN dulu'
      : (Akun.licensed() ? 'Lisensi akun aktif — tanpa batas kuota' : 'Belum ada lisensi akun · mode gratis'));
    if (akun && typeof Akun !== 'undefined') Akun.muatLisensi().then(() => { try { window.Platform.refresh(); } catch (e) { /* abaikan */ } });
  } catch (e) { /* modul akun belum siap — abaikan */ }
  const fv = document.getElementById('footerVersion'); if (fv) fv.textContent = 'Versi ' + (window.APP_VERSION||'');
  applyWebsiteModule();
  /* Kartu peran + outlet ikut mewarui status sesi terbaru */
  try { if (typeof HUB !== 'undefined') HUB.renderKartuPeran(); } catch (e) { /* abaikan */ }
}
const MASJID_FIELDS = {
  namaMasjid: { label:'Nama Masjid', icon:'🕌', type:'text' },
  alamat: { label:'Alamat', icon:'📍', type:'textarea' },
  takmir: { label:'Nama Ketua Takmir', icon:'👤', type:'text' },
  wa: { label:'No. WhatsApp Pengurus', icon:'💬', type:'text' }
};
function openMasjidField(key){
  const f = MASJID_FIELDS[key]; if (!f) return;
  const cur = esc(DB.settings[key]||'');
  const field = f.type==='textarea'
    ? `<textarea id="mfInput" rows="3">${cur}</textarea>`
    : `<input type="text" id="mfInput" value="${cur}">`;
  openModal(`<div class="modal-head"><h2>${f.icon} ${f.label}</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <label>${f.label}</label>${field}
    <div class="btn-row" style="margin-top:14px;"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="saveMasjidField('${key}')">Simpan</button></div>`);
}
function saveMasjidField(key){
  const f = MASJID_FIELDS[key]; if (!f) return;
  const el = document.getElementById('mfInput'); if (!el) return;
  DB.settings[key] = el.value.trim();
  saveDB(); closeModal(); fillSettingsForm(); updateBrandHeader(); toast('Pengaturan disimpan');
}
function backupData(){
  const blob = new Blob([JSON.stringify(DB, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `backup-kasirsolo-masjid-${todayStr()}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Backup berhasil diunduh');
}
function restoreData(ev){
  const file = ev.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const data = JSON.parse(reader.result);
      if(!data || typeof data!=='object' || Array.isArray(data)) throw new Error('struktur');
      const d = defaultDB();
      ['settings','license'].forEach(key=>{
        if(data[key]===undefined) return;
        if(!data[key] || typeof data[key]!=='object' || Array.isArray(data[key])) throw new Error(key);
        d[key] = Object.assign(d[key], data[key]);
      });
      ['kas','jamaah','kegiatan','inventaris'].forEach(key=>{
        if(data[key]===undefined) return;
        if(!Array.isArray(data[key]) || data[key].some(x=>!x || typeof x!=='object' || Array.isArray(x))) throw new Error(key);
        d[key] = data[key];
      });
      DB = d;
      saveDB();
      toast('Data berhasil dipulihkan');
      renderView('dashboard');
      updateTrialUI();
    }catch(e){ toast('File backup tidak valid'); }
  };
  reader.readAsText(file);
  ev.target.value = '';
}

/* ---------- WEBSITE MASJID (publikasi data publik) ---------- */
const PUB_URL = 'https://hhywrvedlwljawgxzpkq.supabase.co';
const PUB_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoeXdydmVkbHdsamF3Z3h6cGtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MzM4OTgsImV4cCI6MjEwMTEwOTg5OH0.GXHRDayBNRbWh1QywGkYCJ6D79qnm_mtyRSJUxw4x50';
function buildWebsiteData(){
  const now = new Date();
  const bulanKas = DB.kas.filter(k=>{ const d=new Date(k.tanggal); return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear(); });
  const byCat = tipe => { const m={}; bulanKas.filter(k=>k.tipe===tipe).forEach(k=>{ m[k.kategori]=(m[k.kategori]||0)+k.jumlah; }); return Object.entries(m).sort((a,b)=>b[1]-a[1]); };
  const total = tipe => bulanKas.filter(k=>k.tipe===tipe).reduce((a,k)=>a+k.jumlah,0);
  /* Website hanya menerima 8 jadwal terdekat (seri berulang bisa ratusan entri);
     jumlah totalnya tetap dikirim lewat kegiatanTotal. */
  const mendatang = DB.kegiatan.filter(e=>e.status==='akandatang').sort((a,b)=>a.tanggal.localeCompare(b.tanggal));
  return {
    slug: (typeof HUB !== 'undefined' && HUB.slugAktif) ? HUB.slugAktif() : (DB.settings.pubSlug||'masjid'),
    diperbarui: nowISO(),
    profil: {
      nama: DB.settings.namaMasjid||'Masjid',
      alamat: DB.settings.alamat||'',
      takmir: DB.settings.takmir||'',
      wa: DB.settings.wa||''
    },
    kegiatan: mendatang.slice(0,8).map(e=>({ nama:e.nama, tanggal:e.tanggal, waktu:e.waktu||'', pengisi:e.pengisi||'', tempat:e.tempat||'', catatan:e.catatan||'' })),
    kegiatanTotal: mendatang.length,
    laporan: {
      bulan: todayStr().slice(0,7),
      masuk: total('masuk'),
      keluar: total('keluar'),
      rincianMasuk: byCat('masuk'),
      rincianKeluar: byCat('keluar')
    }
  };
}
/* =========================================================
   WEBSITE (MINI-CMS)
   ========================================================= */
/* Host website publik. Model 1-project (v1.4.2): admin & website ada di PROYEK
   Vercel yang sama (root = masjid/) — admin di /adm/, website publik di /<slug>
   pada origin yang sama. Karena itu webBaseUrl() cukup location.origin: otomatis
   mengikuti kasolmasjid.vercel.app, domain custom yang di-attach, maupun host
   lokal saat dev (di dev tetap path /web-masjid/). */
function webBaseUrl(){
  const h = (location.hostname || '').toLowerCase();
  const lokal = !h || h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.endsWith('.localhost');
  return lokal ? '/web-masjid/' : location.origin + '/';
}

/* ---------- APP MITRA (akun universal: data diri, foto profil, lisensi) ----------
   Domain custom mitra.kasirsolo.com belum aktif → pakai host beta.
   Semua tautan ke Mitra memakai atribut data-mitra-akun (diisi saat init). */
const MITRA_AKUN_URL = 'https://mitrabeta.vercel.app/akun';
function bindMitraLinks(){
  document.querySelectorAll('[data-mitra-akun]').forEach(el => {
    if (el.getAttribute('href') !== MITRA_AKUN_URL) el.setAttribute('href', MITRA_AKUN_URL);
  });
}
const WEB_ED_SECTIONS = [
  { k:'hero', t:'Hero Pembuka', d:'Headline, subjudul, dan foto latar bagian atas' },
  { k:'sambutan', t:'Sambutan Pengurus', d:'Kata sambutan ketua takmir / DKM' },
  { k:'pengumuman', t:'Pengumuman', d:'Daftar info & pengumuman untuk jamaah' },
  { k:'galeri', t:'Galeri Foto', d:'Kumpulan foto kegiatan masjid' },
  { k:'sections', t:'Pengaturan Tampilan', d:'Sembunyikan/tampilkan bagian website' }
];
function defaultWebsiteDraft(){
  return {
    hero:{ headline:'', sub:'', foto:'' },
    sambutan:{ judul:'', isi:'', foto:'' },
    pengumuman:[], galeri:[],
    sections:{ hero:true, sambutan:true, pengumuman:true, galeri:true, jadwal:true, laporan:true }
  };
}
function getDraft(){ return DB.websiteDraft || defaultWebsiteDraft(); }
function getLiveEd(){ return (DB.websiteLive && DB.websiteLive.editorial) || null; }
let WEB_TAB = 'hero';
let WEB_EDIT = null;
function ensureWebEdit(){
  if(!WEB_EDIT) WEB_EDIT = JSON.parse(JSON.stringify(getDraft()));
  if(!WEB_EDIT.sections) WEB_EDIT.sections = {};
  if(!WEB_EDIT.hero) WEB_EDIT.hero = { headline:'', sub:'', foto:'' };
  if(!WEB_EDIT.sambutan) WEB_EDIT.sambutan = { judul:'', isi:'', foto:'' };
  if(!Array.isArray(WEB_EDIT.pengumuman)) WEB_EDIT.pengumuman = [];
  if(!Array.isArray(WEB_EDIT.galeri)) WEB_EDIT.galeri = [];
  return WEB_EDIT;
}
function setWebTab(t){
  WEB_TAB = t;
  document.querySelectorAll('#webEditTabs .tab').forEach(x=>x.classList.toggle('active', x.dataset.w===t));
  renderWebEditPanel();
}
function renderWebsiteView(){
  WEB_EDIT = null;
  renderWebStatus(); renderWebEditPanel();
  applyWebsiteModule();
  /* Peran + situs diambil dari server lewat SESI akun — tidak ada token di perangkat.
     Role belum diketahui → jangan sembunyikan apa pun (offline aman). */
  try {
    if (typeof HUB !== 'undefined'){
      HUB.muatSitus().then(() => { HUB.renderSitus(); return tarikDraftCloud(); });
      HUB.muatAkses().then(() => HUB.applyRoleUI());
    }
  } catch (e) { /* abaikan */ }
}
function webEdDiffCount(){
  const live = getLiveEd();
  if(!live) return WEB_ED_SECTIONS.length;
  const d = WEB_EDIT || getDraft();
  return WEB_ED_SECTIONS.filter(s => JSON.stringify(d[s.k]||null) !== JSON.stringify(live[s.k]||null)).length;
}
function fmtWebDate(iso){
  const d = new Date(iso); if(isNaN(d)) return '-';
  return d.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})+' '+d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
}
function renderWebStatus(){
  const badge = document.getElementById('webStatusBadge');
  const main = document.getElementById('webStatusMain');
  const sub = document.getElementById('webStatusSub');
  if(!badge) return;
  const live = DB.websiteLive;
  const n = webEdDiffCount();
  if(!live || !live.publishedAt){
    badge.textContent = 'BELUM TAYANG'; badge.className = 'web-badge';
    main.textContent = 'Website belum pernah dipublikasikan';
    sub.textContent = n + ' bagian siap ditayangkan';
  } else if(n > 0){
    badge.textContent = 'DRAFT'; badge.className = 'web-badge';
    main.textContent = n + ' perubahan belum tayang';
    sub.textContent = 'Terakhir tayang: ' + fmtWebDate(live.publishedAt);
  } else {
    badge.textContent = 'LIVE'; badge.className = 'web-badge live';
    main.textContent = 'Semua perubahan sudah tayang';
    sub.textContent = 'Terakhir tayang: ' + fmtWebDate(live.publishedAt);
  }
}
function webEd(path, val){
  const ed = ensureWebEdit();
  const parts = path.split('.');
  let o = ed;
  for(let i=0;i<parts.length-1;i++) o = o[parts[i]];
  o[parts[parts.length-1]] = val;
  renderWebStatus();
}
function webAddItem(k){
  const ed = ensureWebEdit();
  if(k==='pengumuman') ed.pengumuman.push({ id:uid('pg_'), judul:'', isi:'', tanggal: todayStr() });
  else ed.galeri.push({ id:uid('gl_'), url:'', caption:'' });
  renderWebEditPanel(); renderWebStatus();
}
function webDelItem(k,i){
  const ed = ensureWebEdit();
  ed[k].splice(i,1);
  renderWebEditPanel(); renderWebStatus();
}
function webEdItem(k,i,f,v){
  const ed = ensureWebEdit();
  if(!ed[k][i]) ed[k][i] = {};
  ed[k][i][f] = v;
  renderWebStatus();
}
/* ---------- Upload gambar dari perangkat (kompresi otomatis) ---------- */
const WEB_IMG_BUDGET = 260000;   /* batas ukuran data URL per gambar (~260 KB) */
function webKompresGambar(file, maxW){
  return new Promise((resolve,reject)=>{
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('gagal membaca file'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('file bukan gambar yang valid'));
      img.onload = () => {
        try{
          const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
          if(!w0 || !h0) throw new Error('file bukan gambar yang valid');
          let w = Math.min(w0, maxW||1200), h = Math.round(h0 * (w/w0));
          const cv = document.createElement('canvas');
          const cx = cv.getContext('2d');
          const qualities = [0.82, 0.72, 0.6, 0.5];
          let best = '';
          for(let attempt=0; attempt<4; attempt++){
            cv.width = w; cv.height = h;
            cx.fillStyle = '#ffffff'; cx.fillRect(0,0,w,h);
            cx.drawImage(img, 0,0,w,h);
            const q = qualities[Math.min(attempt, qualities.length-1)];
            let out = '';
            try{ out = cv.toDataURL('image/jpeg', q); }catch(e){ out = ''; }
            if(out && out.length > 100){ best = out; if(out.length <= WEB_IMG_BUDGET) break; }
            w = Math.max(320, Math.round(w*0.8)); h = Math.round(h*0.8);
          }
          if(!best) throw new Error('gagal mengompresi gambar');
          resolve(best);
        }catch(e){ reject(e); }
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
function webAmbilGambar(maxW, cb){
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
  document.body.appendChild(inp);
  inp.addEventListener('change', async () => {
    const f = inp.files && inp.files[0];
    inp.remove();
    if(!f) return;
    if(!/^image\//i.test(f.type||'')){ toast('Pilih file gambar (jpg, png, atau webp).'); return; }
    if(f.size > 15*1024*1024){ toast('Ukuran file terlalu besar (maks 15 MB).'); return; }
    const st = document.getElementById('webActionStatus');
    if(st) st.textContent = 'Memproses gambar...';
    try{
      const data = await webKompresGambar(f, maxW);
      cb(data);
      if(st) st.textContent = 'Foto tersimpan di draft perangkat. Tekan 💾 Simpan Draft atau 🚀 Publikasikan untuk menayangkannya.';
    }catch(e){
      toast('Gagal memproses gambar: ' + (e && e.message ? e.message : 'tidak diketahui'));
    }
  });
  inp.click();
}
function webImgPrev(val){
  if(!val) return `<div class="web-empty">Belum ada foto</div>`;
  return `<img class="web-thumb" src="${esc(val)}" alt="pratinjau foto" onerror="this.style.display='none'">`;
}
/* Kontainer gambar: kalau kosong, tombol upload berada DI DALAM kotak (di bawah teks "Belum ada foto") */
function webUploadBox(val, uploadHtml, removeHtml){
  if(!val) return `<div class="web-empty"><span>Belum ada foto</span>${uploadHtml}</div>`;
  return `<img class="web-thumb" src="${esc(val)}" alt="pratinjau foto" onerror="this.style.display='none'"><div class="btn-row" style="margin-top:8px;">${uploadHtml}${removeHtml}</div>`;
}
function webImgSrcInfo(val){
  if(!val) return 'Belum ada foto. Ambil dari perangkat (jpg/png/webp) — dikompresi otomatis sebelum disimpan.';
  if(String(val).slice(0,5)==='data:') return 'Sumber: upload dari perangkat (disimpan di data masjid, dikompresi otomatis).';
  return 'Sumber: tautan gambar — dibaca sebagai info saja. Untuk mengganti, upload foto dari perangkat.';
}
function webUploadHero(){ webAmbilGambar(1400, d => { webEd('hero.foto', d); renderWebEditPanel(); }); }
function webUploadSambutan(){ webAmbilGambar(1000, d => { webEd('sambutan.foto', d); renderWebEditPanel(); }); }
function webUploadGaleri(i){ webAmbilGambar(1000, d => { webEdItem('galeri', i, 'url', d); renderWebEditPanel(); }); }
function webClearImg(path){ webEd(path, ''); renderWebEditPanel(); }
function webClearGaleri(i){ webEdItem('galeri', i, 'url', ''); renderWebEditPanel(); }
/* Saklar tampil/bawah per bagian — diletakkan di halaman pengaturan kontennya sendiri */
function webSecToggle(k, t){
  const s = ensureWebEdit().sections||{};
  return `
  <div class="web-sec-row">
    <div><div class="t">Tampilkan di website</div><div class="d">Bagian ${t} tampil di website publik</div></div>
    <label class="pf-switch" style="margin:0;"><input type="checkbox" ${s[k]!==false?'checked':''} onchange="webEd('sections.${k}',this.checked)" aria-label="Tampilkan ${t}"><i></i></label>
  </div>`;
}
/* Baris aksi (Tarik dari Live / Preview / Simpan Draft) — per halaman pengaturan konten.
   Urutan: Tarik dari Live di paling kiri (lebar sesuai label), Preview + Simpan Draft
   membagi sisa lebar kartu. */
function webActionBar(k){
  const tarik = k
    ? `<button class="btn wb-ghost wb-first" onclick="pullWebSection('${k}')">↩️ Tarik dari Live</button>`
    : `<button class="btn wb-ghost wb-first" onclick="pullWebsiteLive()">↩️ Tarik dari Live</button>`;
  return `<div class="web-actions"><div class="btn-row">
    ${tarik}
    <button class="btn wb-preview wb-fill" onclick="previewWebsite()">👁️ Preview</button>
    <button class="btn wb-green wb-fill" onclick="saveWebsiteDraft()">💾 Simpan Draft</button>
  </div></div>`;
}
/* Tarik satu bagian dari versi tayang (bukan seluruh website) */
function pullWebSection(k){
  const live = getLiveEd();
  if(!live || !live[k]){ toast('Belum ada versi tayang untuk bagian ini'); return; }
  const ed = ensureWebEdit();
  ed[k] = JSON.parse(JSON.stringify(live[k]));
  DB.websiteDraft = JSON.parse(JSON.stringify(ed));
  saveDB();
  WEB_EDIT = null;
  renderWebStatus(); renderWebEditPanel();
  toast('Draft bagian ini disamakan dengan versi tayang');
}
function renderWebEditPanel(){
  const p = document.getElementById('webEditPanel'); if(!p) return;
  const ed = ensureWebEdit();
  if(WEB_TAB==='hero'){
    const up = `<button class="btn wb-teal" onclick="webUploadHero()">📷 Upload dari perangkat</button>`;
    const del = ed.hero.foto?`<button class="btn wb-red" onclick="webClearImg('hero.foto')">🗑️ Hapus foto</button>`:'';
    p.innerHTML = `
    <div class="card">
      <h3>🖼️ Hero Pembuka</h3>
      <div class="web-field"><label>Headline (kosongkan = nama masjid)</label><input type="text" value="${esc(ed.hero.headline||'')}" oninput="webEd('hero.headline',this.value)"></div>
      <div class="web-field"><label>Subjudul (kosongkan = alamat masjid)</label><input type="text" value="${esc(ed.hero.sub||'')}" oninput="webEd('hero.sub',this.value)"></div>
      <div class="web-field">
        <label>Foto Latar</label>
        ${webUploadBox(ed.hero.foto, up, del)}
        <p class="web-src">${webImgSrcInfo(ed.hero.foto)}</p>
      </div>
      ${webSecToggle('hero','Hero Pembuka')}
      ${webActionBar('hero')}
    </div>`;
  } else if(WEB_TAB==='sambutan'){
    const up = `<button class="btn wb-teal" onclick="webUploadSambutan()">📷 Upload dari perangkat</button>`;
    const del = ed.sambutan.foto?`<button class="btn wb-red" onclick="webClearImg('sambutan.foto')">🗑️ Hapus foto</button>`:'';
    p.innerHTML = `
    <div class="card">
      <h3>🗣️ Sambutan Pengurus</h3>
      <div class="web-field"><label>Judul</label><input type="text" placeholder="Assalamu'alaikum warahmatullahi wabarakatuh" value="${esc(ed.sambutan.judul||'')}" oninput="webEd('sambutan.judul',this.value)"></div>
      <div class="web-field"><label>Isi Sambutan</label><textarea rows="6" placeholder="Tulis sambutan dari ketua takmir / DKM..." oninput="webEd('sambutan.isi',this.value)">${esc(ed.sambutan.isi||'')}</textarea></div>
      <div class="web-field">
        <label>Foto Sambutan (opsional)</label>
        ${webUploadBox(ed.sambutan.foto, up, del)}
        <p class="web-src">${webImgSrcInfo(ed.sambutan.foto)}</p>
      </div>
      ${webSecToggle('sambutan','Sambutan Pengurus')}
      ${webActionBar('sambutan')}
    </div>`;
  } else if(WEB_TAB==='pengumuman'){
    const list = ed.pengumuman||[];
    p.innerHTML = `
    <div class="card">
      <h3>📢 Pengumuman</h3>
      ${list.length? list.map((a,i)=>`
      <div class="web-item">
        <div class="web-item-head"><b>#${i+1}</b><button class="web-del" onclick="webDelItem('pengumuman',${i})" aria-label="Hapus pengumuman">🗑️</button></div>
        <div class="web-field"><label>Judul</label><input type="text" placeholder="Jadwal kajian Ahad pagi" value="${esc(a.judul||'')}" oninput="webEdItem('pengumuman',${i},'judul',this.value)"></div>
        <div class="web-field"><label>Isi</label><textarea rows="3" placeholder="Tulis isi pengumuman..." oninput="webEdItem('pengumuman',${i},'isi',this.value)">${esc(a.isi||'')}</textarea></div>
        <div class="web-field"><label>Tanggal</label><input type="date" value="${esc(a.tanggal||'')}" onchange="webEdItem('pengumuman',${i},'tanggal',this.value)"></div>
      </div>`).join('') : '<p class="muted">Belum ada pengumuman. Tambahkan info untuk jamaah.</p>'}
      <div class="btn-row" style="margin-top:10px;"><button class="btn wb-teal" onclick="webAddItem('pengumuman')">➕ Tambah Pengumuman</button></div>
      ${webSecToggle('pengumuman','Pengumuman')}
      ${webActionBar('pengumuman')}
    </div>`;
  } else if(WEB_TAB==='galeri'){
    const list = ed.galeri||[];
    p.innerHTML = `
    <div class="card">
      <h3>🖼️ Galeri Foto</h3>
      ${list.length? list.map((g,i)=>`
      <div class="web-item">
        <div class="web-item-head"><b>Foto #${i+1}</b><button class="web-del" onclick="webDelItem('galeri',${i})" aria-label="Hapus foto">🗑️</button></div>
        ${webUploadBox(g.url, `<button class="btn wb-teal" onclick="webUploadGaleri(${i})">📷 Upload dari perangkat</button>`, g.url?`<button class="btn wb-red" onclick="webClearGaleri(${i})">🗑️ Hapus foto</button>`:'')}
        <p class="web-src">${webImgSrcInfo(g.url)}</p>
        <div class="web-field"><label>Keterangan</label><input type="text" placeholder="Kajian rutin Ahad pagi" value="${esc(g.caption||'')}" oninput="webEdItem('galeri',${i},'caption',this.value)"></div>
      </div>`).join('') : '<p class="muted">Belum ada foto. Tambahkan foto kegiatan masjid.</p>'}
      <div class="btn-row" style="margin-top:10px;"><button class="btn wb-teal" onclick="webAddItem('galeri')">➕ Tambah Foto</button></div>
      ${webSecToggle('galeri','Galeri Foto')}
      ${webActionBar('galeri')}
    </div>`;
  } else {
    const s = ed.sections||{};
    /* Hanya bagian yang isinya otomatis (dari menu Kegiatan / Kas).
       Bagian yang punya halaman pengaturan sendiri (Hero, Sambutan, Pengumuman, Galeri)
       saklarnya diatur di masing-masing tab. */
    const rows = [
      ['jadwal','Jadwal kajian','Otomatis dari menu Kegiatan'],
      ['laporan','Laporan kas bulan ini','Otomatis dari menu Kas']
    ];
    p.innerHTML = `
    <div class="card">
      <h3>🎛️ Tampilan Website</h3>
      <p class="muted">Bagian otomatis — isinya diambil dari aplikasi, jadi cukup Atur tampil/tidak di sini.</p>
      ${rows.map(([k,t,d])=>`
      <div class="web-sec-row">
        <div><div class="t">${t}</div><div class="d">${d}</div></div>
        <label class="pf-switch" style="margin:0;"><input type="checkbox" ${s[k]!==false?'checked':''} onchange="webEd('sections.${k}',this.checked)" aria-label="Tampilkan ${t}"><i></i></label>
      </div>`).join('')}
      <p class="muted" style="margin-top:10px;font-size:12px;">Saklar untuk Hero, Sambutan, Pengumuman, dan Galeri ada di tab pengaturan konten masing-masing.</p>
      ${webActionBar(null)}
    </div>`;
  }
}
function buildWebsiteDraftPayload(){
  const base = buildWebsiteData();
  base.editorial = JSON.parse(JSON.stringify(ensureWebEdit()));
  return base;
}
async function saveWebsiteDraft(){
  DB.websiteDraft = JSON.parse(JSON.stringify(ensureWebEdit()));
  saveDB();
  renderWebStatus();
  const st = document.getElementById('webActionStatus');
  if (typeof HUB === 'undefined'){ st.textContent = 'Draft tersimpan di perangkat.'; return; }
  st.textContent = 'Menyimpan draft ke cloud...';
  try{
    const r = await HUB.draftViaAkun(buildWebsiteDraftPayload());
    if (r && r.ok){
      st.textContent = '✅ Draft tersimpan di cloud. Preview siap dibuka.';
    } else {
      st.textContent = hubPesanGagal(r, 'Draft tersimpan di perangkat.');
    }
  }catch(e){
    st.textContent = 'Draft tersimpan di perangkat. Gagal kirim ke cloud ('+e.message+').';
  }
}
/* ---------- Titip draft preview ke perangkat ----------
   Sejak 2026-11-20 draft TIDAK lagi disimpan di kolom `masjid_website.draft`
   (kolom itu dulu bisa dibaca publik → draft bocor tanpa login). Preview kini
   memakai jalur lokal: adm-masjid (/adm/) dan web-masjid (/<slug>) satu origin,
   jadi draft dititipkan ke localStorage perangkat ini dan hanya dibaca
   web-masjid saat dibuka dengan ?preview=1. Tidak ada draft yang dikirim ke
   pengunjung website. Kunci & masa berlaku harus SAMA dengan yang dibaca di
   masjid/web-masjid/index.html (PREVIEW_KEY / PREVIEW_MAX_AGE). */
const PREVIEW_KEY = 'ksmasjid_preview_v1';
function titipkanPreview(slug, editorial){
  try{
    localStorage.setItem(PREVIEW_KEY, JSON.stringify({
      slug: slug || '', editorial: editorial || {}, at: Date.now()
    }));
    return true;
  }catch(e){ return false; }
}
async function previewWebsite(){
  await saveWebsiteDraft();
  /* Preview diarahkan ke slug situs yang SEDANG aktif (bukan default "masjid"). */
  const slug = (typeof HUB !== 'undefined' && HUB.slugAktif) ? HUB.slugAktif() : (DB.settings.pubSlug||'masjid');
  titipkanPreview(slug, getDraft());
  window.open(webBaseUrl() + '?preview=1&slug=' + encodeURIComponent(slug), '_blank');
}
/* Perangkat yang belum punya draft lokal (mis. ganti HP / bersihkan data) bisa
   menarik draft terakhir dari cloud lewat RPC masjid_my_draft — server hanya
   mengizinkan owner situs. Draft lokal yang sudah ada TIDAK ditimpa. */
async function tarikDraftCloud(){
  if (DB.websiteDraft) return;
  if (typeof HUB === 'undefined' || !HUB.myDraft) return;
  try{
    const r = await HUB.myDraft(HUB.slugAktif());
    if (r && r.ok && r.ada && r.data && Object.keys(r.data).length){
      DB.websiteDraft = r.data;
      saveDB();
      WEB_EDIT = null;
      renderWebStatus(); renderWebEditPanel();
    }
  }catch(e){ /* offline → biarkan apa adanya */ }
}
/* Normalisasi ID Website: lowercase, karakter non-alfanumerik jadi strip, kosong = 'masjid'
   (dipakai saat menyiapkan payload; slug final tetap ditentukan server). */
function normSlug(v){
  return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'masjid';
}
/* Catatan: input manual "ID Website" & "Token Publikasi" sudah dihapus.
   Slug, token, dan domain kini diurus server lewat sesi akun (modul HUB) —
   tidak ada rahasia publikasi yang tersimpan di perangkat. */
function pullWebsiteLive(){
  const live = getLiveEd();
  if(!live){ toast('Belum ada versi tayang'); return; }
  DB.websiteDraft = JSON.parse(JSON.stringify(live));
  saveDB();
  WEB_EDIT = null;
  renderWebStatus(); renderWebEditPanel();
  toast('Draft disamakan dengan versi tayang');
}
function toggleWebsiteModule(on){
  DB.settings.websiteEnabled = !!on;
  saveDB();
  applyWebsiteModule();
  toast(on ? 'Modul Website diaktifkan' : 'Modul Website dimatikan');
}
function applyWebsiteModule(){
  const on = DB.settings.websiteEnabled !== false;
  const cb = document.getElementById('setWebsiteOn');
  if (cb) cb.checked = on;
  /* Saklar #setWebsiteOn (di kanan judul halaman) mengontrol seluruh modul Website:
     hidup = semua tampil, mati = isi pengaturan disembunyikan.
     Menu "Website" di loker ☰ Lainnya SELALU tampil — pengguna tetap bisa
     membuka halamannya (untuk menyalakan kembali), hanya isi pengaturannya
     yang disembunyikan saat modul mati. */
  ['websiteModuleBody','webStatusCard','webEditTabs','webEditPanel'].forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.style.display = on ? '' : 'none';
  });
  const state = document.getElementById('websiteOnState');
  if (state) state.textContent = on ? 'Aktif' : 'Nonaktif';
  const note = document.getElementById('websiteOnNote');
  if (note) note.textContent = on
    ? 'Atur isi website lewat tab di bawah. Publikasi memakai akun Anda — tidak ada token di perangkat ini.'
    : 'Modul website dimatikan. Nyalakan saklar di atas untuk mengaktifkan kembali.';
}
function downloadWebsiteJson(){
  if (DB.settings.websiteEnabled === false) { toast('Modul Website dimatikan'); return; }
  const blob = new Blob([JSON.stringify(buildWebsiteData(), null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'data-website.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('data-website.json diunduh — salin ke folder web-masjid');
}
/* Satu tombol publikasi: simpan semua edit yang sedang dibuka di tab editor,
   lalu tayangkan ke website publik lewat RPC masjid_publish_by_account (SESSION JWT).
   Tidak ada token di perangkat — server yang cek peran owner.
   Kalau website sudah pernah tayang, tampilkan konfirmasi dulu sebelum menimpa versi live. */
function publishWebsite(){
  if (DB.settings.websiteEnabled === false) { toast('Modul Website dimatikan'); return; }
  if (typeof HUB === 'undefined'){ toast('Modul akun belum siap. Muat ulang aplikasi.'); return; }
  if (!HUB.peran()){
    /* Peran belum diketahui (offline / belum load) → jangan blokir; server yang jadi penentu.
       Tapi kalau sudah diketahui dan bukan owner → tolak di UI. */
    if (HUB.peranDiketahui() && HUB.peran() !== 'owner'){
      toast('🔒 Publikasi hanya untuk pemilik masjid.'); return;
    }
  }
  if (DB.websiteLive && DB.websiteLive.publishedAt){
    openModal(`
      <div class="modal-head"><h2>🚀 Publikasikan Ulang?</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
      <p class="muted" style="line-height:1.6">Website sudah tayang sejak <b>${esc(fmtWebDate(DB.websiteLive.publishedAt))}</b>. Semua isi saat ini akan <b>menggantikan versi live</b> di website publik.</p>
      <div class="btn-row" style="margin-top:14px;"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="closeModal();doPublishWebsite()">Ya, Publikasikan</button></div>`);
    return;
  }
  doPublishWebsite();
}
async function doPublishWebsite(){
  const st2 = document.getElementById('webActionStatus');
  const setSt = m => { if(st2) st2.textContent = m; };
  DB.websiteDraft = JSON.parse(JSON.stringify(ensureWebEdit()));
  saveDB();
  setSt('Mengirim...');
  try{
    const payload = buildWebsiteData();
    payload.editorial = JSON.parse(JSON.stringify(DB.websiteDraft));
    const r = await HUB.publishViaAkun(payload);
    if (r && r.ok){
      DB.websiteLive = { editorial: payload.editorial, publishedAt: (r.published_at || nowISO()) };
      saveDB();
      renderWebStatus();
      HUB.renderSitus();
      setSt('✅ Terpublikasi ke website (semua bagian).');
      toast('Website diperbarui');
    } else {
      setSt(hubPesanGagal(r, '❌ Gagal mempublikasikan.'));
    }
  }catch(e){
    setSt('Gagal mengirim ('+e.message+'). Periksa koneksi internet, atau pakai Unduh JSON.');
  }
}
/* Pesan error yang bisa dibaca manusia untuk kode kegagalan dari server HUB. */
function hubPesanGagal(r, fallback){
  const code = (r && r.code) ? String(r.code) : '';
  const map = {
    not_signed_in: '❌ Sesi akun habis. Masuk kembali lalu publikasikan.',
    unauthorized: '❌ Sesi akun habis. Masuk kembali lalu publikasikan.',
    identity_gone: '❌ Akun tidak ditemukan lagi. Masuk ulang.',
    forbidden: '🔒 Hanya pemilik masjid yang bisa melakukan ini.',
    invalid_outlet: '⚠️ Masjid yang dipilih tidak cocok dengan akunmu. Pilih ulang di Pengaturan.',
    outlet_required: '⚠️ Akunmu punya beberapa masjid. Pilih masjid dulu di Pengaturan → Peran & Tim.',
    site_not_found: '⚠️ Website belum disiapkan. Muat ulang halaman Website.',
    no_site: '⚠️ Website belum disiapkan. Muat ulang halaman Website.',
    invalid_domain: '⚠️ Format domain tidak valid (contoh: masjidku.solo.id).',
    domain_taken: '⚠️ Domain ini sudah dipakai masjid lain.',
    domain_reserved: '⚠️ Domain ini milik platform/terlarang dan tidak bisa diklaim. Pakai domain TLD milik masjid Anda.',
    domain_already_active: '⚠️ Domain ini sudah AKTIF. Klaim ulang akan membatalkan status aktif dan meminta verifikasi ulang.',
    domain_not_found: '⚠️ Domain ini tidak terdaftar. Klaim dulu sebelum verifikasi.',
    invalid_token: '⚠️ Token verifikasi tidak cocok. Klaim ulang domain untuk memperbarui instruksi DNS.',
    token_not_local: '⚠️ Token verifikasi tidak tersimpan di perangkat ini. Klaim ulang domain lalu ulangi.',
    offline: '📴 Tidak ada koneksi. Draft tetap tersimpan di perangkat.'
  };
  return map[code] || fallback;
}
/* Catatan: gating peran (data-role) sekarang ditangani modul HUB di bawah —
   tidak lagi ada variabel WEB_ROLE terpisah. */
function loadDemoData(){
  if(!seedIfEmpty()){ toast('Data sudah ada — data contoh hanya untuk aplikasi kosong'); return; }
  renderView('dashboard'); toast('Data contoh dimuat');
}

/* =========================================================
   AKUN KASOL (v1.3.0) — gerbang login wajib + lisensi ikut akun
   Pola sama dengan kaki5/js/account.js, tapi tanpa supabase-js:
   pakai REST GoTrue + PostgREST langsung supaya PWA tetap single-file.
   - Sesi  : localStorage `ks_masjid_session` {access_token, refresh_token, expires_at, wa}
   - Login : POST /auth/v1/token?grant_type=password  (email = <wa>@accounts.kasirsolo.local)
   - Daftar: POST /functions/v1/account-register     (CORS fail-closed → lihat BASELINE_ORIGINS)
   - Lisensi: RPC app_my_license('masjid', device_code, ...) — MENGIKUT AKUN,
     cache tahan-offline di `ks_masjid_license` (grace saat jaringan putus).
   ========================================================= */
const gebi = id => document.getElementById(id);
const Akun = (function () {
  const SB = String(PUB_URL).replace(/\/$/, '');
  const KEY = PUB_ANON_KEY;
  const SESI_K = 'ks_masjid_session';
  const LIC_K = 'ks_masjid_license';
  const EMAIL_D = 'accounts.kasirsolo.local';
  const APP_KEY = 'masjid';
  const LOGIN_ERR = 'Nomor WhatsApp atau PIN salah.';
  let _sesi = null;
  let _lisensi = null;

  function normWa(input) {
    let v = String(input || '').replace(/[^0-9]/g, '');
    if (!v) return null;
    if (v.startsWith('0')) v = '62' + v.slice(1);
    else if (v.startsWith('8')) v = '62' + v;
    if (v.length < 9 || v.length > 15) return null;
    return v;
  }
  const emailFor = wa => wa + '@' + EMAIL_D;

  function bacaSesi() {
    if (_sesi) return _sesi;
    try { _sesi = JSON.parse(localStorage.getItem(SESI_K) || 'null'); } catch (e) { _sesi = null; }
    return _sesi;
  }
  function simpanSesi(s) {
    _sesi = s;
    try { s ? localStorage.setItem(SESI_K, JSON.stringify(s)) : localStorage.removeItem(SESI_K); } catch (e) { /* penuh/ditolak → abaikan */ }
  }
  function bacaLisensiCache() {
    if (_lisensi) return _lisensi;
    try { _lisensi = JSON.parse(localStorage.getItem(LIC_K) || 'null'); } catch (e) { _lisensi = null; }
    return _lisensi;
  }
  function simpanLisensi(l) {
    _lisensi = l;
    try { l ? localStorage.setItem(LIC_K, JSON.stringify(l)) : localStorage.removeItem(LIC_K); } catch (e) { /* abaikan */ }
  }
  function hampirKadaluwarsa(s) { return !s || !s.expires_at || Date.now() > Number(s.expires_at) - 60000; }

  /** Sesi dicabut (token basi / logout / dicabut dari perangkat lain) →
   *  bersihkan lalu pastikan gerbang login tampil. */
  function matikanSesi(pesan) {
    const ada = !!_sesi || !!localStorage.getItem(SESI_K);
    _sesi = null; _lisensi = null;
    try { localStorage.removeItem(SESI_K); localStorage.removeItem(LIC_K); } catch (e) { /* abaikan */ }
    try { if (window.HUB) window.HUB.reset(); } catch (e) { /* abaikan */ }
    try { if (window.Platform && window.Platform.refresh) window.Platform.refresh(); } catch (e) { /* abaikan */ }
    if (ada && window.Gerbang) window.Gerbang.tampilkan(pesan || '');
  }

  /** Muat ulang access_token. Jaringan putus → sesi TETAP (grace offline);
   *  token ditolak server (400/401) → matikanSesi + gerbang. */
  async function refresh() {
    const s = bacaSesi();
    if (!s || !s.refresh_token) return null;
    let res;
    try {
      res = await fetch(SB + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: 'Bearer ' + KEY },
        body: JSON.stringify({ refresh_token: s.refresh_token }),
      });
    } catch (e) { return null; } // offline: jangan hapus sesi
    if (!res.ok) {
      if (res.status === 400 || res.status === 401) matikanSesi('Sesi berakhir. Masuk kembali ya.');
      return null;
    }
    try {
      const d = await res.json();
      simpanSesi({
        access_token: d.access_token,
        refresh_token: d.refresh_token || s.refresh_token,
        expires_at: Date.now() + Number(d.expires_in || 3600) * 1000,
        wa: s.wa,
        nama: s.nama || '',
        avatar: s.avatar || '', /* foto profil tetap tersimpan setelah refresh */
      });
      return _sesi;
    } catch (e) { return null; }
  }

  async function panggilLisensi(tok) {
    let res;
    try {
      res = await fetch(SB + '/rest/v1/rpc/app_my_license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: 'Bearer ' + tok },
        body: JSON.stringify({
          p_app_key: APP_KEY,
          p_device_code: (window.Platform && window.Platform.deviceId) ? window.Platform.deviceId() : 'UNKNOWN',
          p_device_label: 'adm-masjid ' + (navigator.platform || 'web'),
        }),
      });
    } catch (e) { return 'gagal'; }
    if (res.status === 401) return 'unauthorized';
    if (!res.ok) return 'gagal';
    try { return await res.json(); } catch (e) { return 'gagal'; }
  }

  /** Tarik lisensi akun → cache. Gagal jaringan → pakai cache lama (grace). */
  async function muatLisensi() {
    const s = bacaSesi();
    if (!s) return null;
    let d = await panggilLisensi(s.access_token);
    if (d === 'unauthorized') {
      const r = await refresh();
      if (!bacaSesi()) return null; // sesi mati → gerbang sudah tampil
      if (r) {
        d = await panggilLisensi(r.access_token);
        if (d === 'unauthorized') { matikanSesi('Sesi berakhir. Masuk kembali ya.'); return null; }
      } else d = 'gagal'; // refresh gagal karena jaringan → cache lama
    }
    if (d === 'gagal') return bacaLisensiCache();
    simpanLisensi(d);
    return d;
  }

  /** Ambil nama akun dari server (user_metadata.nama) + foto profil
   *  (RPC `account_my_avatar` → kolom global_identities.avatar_url) → simpan
   *  di sesi lokal, supaya tombol header menampilkan siapa yang sedang login.
   *  Gagal/offline → sesi lama tetap dipakai (grace, tanpa ganggu). */
  async function muatProfil() {
    const s = bacaSesi();
    if (!s) return null;
    let d = null;
    try {
      const res = await fetch(SB + '/auth/v1/user', {
        headers: { apikey: KEY, Authorization: 'Bearer ' + s.access_token },
      });
      if (!res.ok) return null;
      d = await res.json();
    } catch (e) { return null; }
    const meta = (d && d.user_metadata) || {};
    const nama = String(meta.nama || meta.name || meta.full_name || '').trim();
    if (nama) {
      const s2 = bacaSesi();
      if (s2 && s2.nama !== nama) { s2.nama = nama; simpanSesi(s2); }
    }
    /* Foto profil: avatar = null → RPC gagal/tidak dijawab (cache lama dipakai);
       avatar = '' → memang tidak ada foto (hapus cache).
       Retry 1x: tepat setelah login PostgREST kadang balas 401 "JWT issued at
       future" (selisih detik jam server) — sesaat saja, sesi tetap sah. */
    let avatar = null;
    try {
      const urlAvatar = SB + '/rest/v1/rpc/account_my_avatar';
      const opts = {
        method: 'POST',
        headers: {
          apikey: KEY,
          Authorization: 'Bearer ' + s.access_token,
          'Content-Type': 'application/json',
        },
        body: '{}',
      };
      let ar = await fetch(urlAvatar, opts);
      if (!ar.ok) {
        await new Promise(res => setTimeout(res, 1200));
        ar = await fetch(urlAvatar, opts);
      }
      if (ar.ok) {
        const ad = await ar.json().catch(() => ({}));
        avatar = String((ad && ad.avatar_url) || '');
      }
    } catch (e) { /* abaikan — pakai cache */ }
    if (avatar !== null) {
      const s2 = bacaSesi();
      if (s2 && String(s2.avatar || '') !== avatar) { s2.avatar = avatar; simpanSesi(s2); }
    }
    try { if (window.Platform && window.Platform.refresh) window.Platform.refresh(); } catch (e) { /* abaikan */ }
    const akhir = bacaSesi() || s;
    return { wa: s.wa, nama: nama || akhir.nama || '', avatar: akhir.avatar || '' };
  }

  /** Login WA + PIN → sesi (GoTrue password grant). */
  async function masuk(wa, pin) {
    const nw = normWa(wa);
    if (!nw) return { ok: false, reason: 'Nomor WhatsApp tidak valid.' };
    const pinv = String(pin || '').trim();
    if (!/^[0-9]{6,}$/.test(pinv)) return { ok: false, reason: 'PIN minimal 6 digit angka.' };
    let res;
    try {
      res = await fetch(SB + '/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: 'Bearer ' + KEY },
        body: JSON.stringify({ email: emailFor(nw), password: pinv }),
      });
    } catch (e) {
      return { ok: false, reason: 'Gagal menghubungi server. Periksa koneksi.' };
    }
    if (res.status === 429) return { ok: false, reason: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.' };
    if (!res.ok) return { ok: false, reason: LOGIN_ERR };
    try {
      const d = await res.json();
      simpanSesi({
        access_token: d.access_token,
        refresh_token: d.refresh_token,
        expires_at: Date.now() + Number(d.expires_in || 3600) * 1000,
        wa: nw,
      });
    } catch (e) {
      return { ok: false, reason: 'Respons server tidak dikenal. Coba lagi.' };
    }
    muatLisensi(); // latar belakang — gerbang tidak menunggu lisensi
    muatProfil();  // latar belakang — ambil nama akun untuk tombol header
    return { ok: true };
  }

  /** Daftar akun baru → Edge Function account-register → auto-login. */
  async function daftar({ wa, pin, nama }) {
    const nw = normWa(wa);
    if (!nw) return { ok: false, reason: 'Nomor WhatsApp tidak valid.' };
    const nm = String(nama || '').trim();
    if (nm.length < 2) return { ok: false, reason: 'Nama minimal 2 huruf.' };
    const pinv = String(pin || '').trim();
    if (!/^[0-9]{6,}$/.test(pinv)) return { ok: false, reason: 'PIN minimal 6 digit angka.' };
    let res;
    try {
      res = await fetch(SB + '/functions/v1/account-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: 'Bearer ' + KEY },
        body: JSON.stringify({ wa: nw, pin: pinv, nama: nm }),
      });
    } catch (e) {
      return { ok: false, reason: 'Gagal menghubungi server. Periksa koneksi.' };
    }
    let data = {};
    try { data = await res.json(); } catch (e) { /* body bukan JSON */ }
    if (!res.ok || !data.ok) {
      const reason = String(data.reason || (res.status === 409
        ? 'Nomor ini sudah punya akun. Buka tab Masuk ya.'
        : (res.status === 0 || !res.status ? 'Gagal menghubungi server. Periksa koneksi.' : 'Pendaftaran gagal. Coba lagi.')));
      return { ok: false, reason };
    }
    const r = await masuk(nw, pinv);
    if (!r.ok) return { ok: false, code: 'register_ok_login_failed', reason: 'Akun berhasil dibuat, tapi masuk gagal. Buka tab Masuk lalu coba lagi.' };
    /* nama langsung disimpan di sesi lokal → tombol header langsung tampil */
    const s2 = bacaSesi();
    if (s2) { s2.nama = nm; simpanSesi(s2); }
    try { if (window.Platform && window.Platform.refresh) window.Platform.refresh(); } catch (e) { /* abaikan */ }
    return { ok: true };
  }

  /** Akhir: hapus sesi perangkat INI (scope local — sama seperti kaki5). */
  async function keluar() {
    const s = bacaSesi();
    try {
      if (s && s.access_token) {
        await fetch(SB + '/auth/v1/logout?scope=local', {
          method: 'POST',
          headers: { apikey: KEY, Authorization: 'Bearer ' + s.access_token },
        });
      }
    } catch (e) { /* logout lokal tetap jalan walau server tak terjangkau */ }
    matikanSesi();
  }

  /** Boot setelah sesi ditemukan: refresh token bila hampir kedaluwarsa +
   *  tarik lisensi di latar belakang. */
  async function boot() {
    const s = bacaSesi();
    if (!s) { if (window.Gerbang) window.Gerbang.tampilkan(); return false; }
    if (hampirKadaluwarsa(s)) {
      await refresh();
      if (!bacaSesi()) return false; // token mati → gerbang sudah tampil
    }
    muatLisensi().then(() => { try { window.Platform.refresh(); } catch (e) { /* abaikan */ } });
    muatProfil(); // nama akun untuk tombol header
    return true;
  }

  return {
    normWa, masuk, daftar, keluar, boot, muatLisensi, muatProfil,
    sesiLokal: () => !!bacaSesi(),
    info: () => { const s = bacaSesi(); return s && s.wa ? { wa: s.wa, nama: s.nama || '', avatar: s.avatar || '' } : null; },
    /* Access token sesi — dipakai modul HUB untuk semua RPC akun (app_*, masjid_*).
       Token TIDAK pernah disimpan di luar localStorage sesi. */
    token: () => { const s = bacaSesi(); return (s && s.access_token) ? s.access_token : null; },
    licensed: () => { const l = bacaLisensiCache(); return !!(l && l.ok === true); },
    lisensi: () => bacaLisensiCache(),
    matikanSesi,
  };
})();
window.Akun = Akun;

/* =========================================================
   HUB — multi-role + outlet + situs (adopsi kaki5/rosok)
   ------------------------------------------------------------
   · Peran & outlet BUKAN ditentukan di perangkat: diambil dari
     server lewat RPC app_my_access (JWT sesi).
   · Gating tampilan lewat atribut `data-role` + kelas `.role-hidden`.
     Peran belum diketahui (offline / belum load) → TIDAK ada yang
     disembunyikan (aman offline & backward compatible).
   · Publikasi & domain lewat RPC masjid_* (JWT sesi) — tidak ada
     token publikasi yang tersimpan di perangkat mana pun.
   · Error jaringan TIDAK mencabut lisensi/sesi lokal (grace offline).
   ========================================================= */
const HUB = (function(){
  const SB = String(PUB_URL).replace(/\/$/,'');
  const KEY = PUB_ANON_KEY;
  const APP_KEY = 'masjid';
  const ACCESS_K = 'ks_masjid_access';   /* cache akses (grace offline) */
  const OUTLET_K = 'akunOutletAktifV1';  /* Outlet/masjid aktif           */
  const DOMTOK_K = 'ks_masjid_domtok';    /* token verifikasi DNS per domain */
  const SLUG_K    = 'ks_masjid_slug_v1';  /* slug situs terakhir dari server */
  const ROLE_RANK  = { kasir:1, manajer:2, owner:3 };
  const ROLE_LABEL = { owner:'Pemilik', manajer:'Manajer', kasir:'Kasir' };
  const ROLES = ['owner','manajer','kasir'];

  let _role = null;        /* null = belum diketahui → jangan sembunyikan apa pun */
  let _diketahui = false;  /* true = server sudah memastikan peran               */
  let _akses = null;       /* hasil app_my_access terakhir                        */
  let _situs = [];         /* daftar masjid_sites milik sesi                     */
  let _situsAktif = null;
  let _provisioning = false;

  /* ---------------- util ---------------- */
  function token(){
    try { return (typeof Akun !== 'undefined' && Akun.token) ? Akun.token() : null; }
    catch(e){ return null; }
  }
  function cacheBaca(k){ try { return JSON.parse(localStorage.getItem(k)||'null'); } catch(e){ return null; } }
  function cacheTulis(k,v){ try { v ? localStorage.setItem(k, JSON.stringify(v)) : localStorage.removeItem(k); } catch(e){ /* abaikan */ } }
  function outletTerpilih(){ try { return localStorage.getItem(OUTLET_K) || null; } catch(e){ return null; } }
  function outletPilih(id){ try { id ? localStorage.setItem(OUTLET_K, id) : localStorage.removeItem(OUTLET_K); } catch(e){ /* abaikan */ } }
  function daftarOutlet(){
    const o = (_akses && Array.isArray(_akses.outlets)) ? _akses.outlets : [];
    return o.map(x => ({ id: x.outlet_id || x.id || '', nama: x.nama || x.outlet_nama || 'Masjid', role: x.role || '' }));
  }
  function outletAktif(){
    const cur = outletTerpilih();
    if (cur) return cur;
    if (_akses && _akses.outlet_id) return _akses.outlet_id;
    const outs = daftarOutlet();
    return outs.length ? (outs[0].id || null) : null;
  }

  /* ---------------- RPC dengan JWT sesi ---------------- */
  async function rpc(fn, body){
    const at = token();
    if(!at) return { ok:false, code:'not_signed_in' };
    let res;
    try{
      res = await fetch(SB + '/rest/v1/rpc/' + fn, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', apikey:KEY, Authorization:'Bearer '+at },
        body: JSON.stringify(body||{})
      });
    }catch(e){ return { ok:false, code:'offline' }; }
    if(res.status === 401) return { ok:false, code:'unauthorized' };
    if(!res.ok){
      let d = null; try { d = await res.json(); } catch(e){ /* body bukan JSON */ }
      return { ok:false, code:(d && d.code) || ('http_' + res.status) };
    }
    try { const d = await res.json(); return (d && typeof d === 'object') ? d : { ok:true }; }
    catch(e){ return { ok:false, code:'bad_json' }; }
  }

  /* ---------------- akses / peran / outlet ---------------- */
  async function muatAkses(outletId, retry){
    const params = { p_app_key: APP_KEY };
    const oid = outletId || outletTerpilih() || ((_akses && _akses.outlet_id) || null);
    if(oid) params.p_outlet_id = oid;
    const d = await rpc('app_my_access', params);
    if(d && d.ok === true){
      if(d.gid && !d.wa){
        /* identitas global sudah dihapus → sesi tidak valid lagi (pola kaki5) */
        _role = ''; _diketahui = true; _akses = null;
        cacheTulis(ACCESS_K, null);
        try { if (typeof Akun !== 'undefined') Akun.matikanSesi('Sesi akun berakhir. Masuk kembali ya.'); } catch(e){ /* abaikan */ }
        applyRoleUI();
        return { ok:false, code:'identity_gone' };
      }
      _akses = d;
      _role = d.has_access ? (d.role || '') : '';
      _diketahui = true;
      cacheTulis(ACCESS_K, { at:Date.now(), akses:d });
      if(d.outlet_id) outletPilih(d.outlet_id);
      applyRoleUI();
      return d;
    }
    const code = (d && d.code) ? String(d.code) : '';
    if(code === 'unauthorized' || code === 'not_signed_in'){
      _role = ''; _diketahui = true; _akses = null;
      cacheTulis(ACCESS_K, null);
      try { if (typeof Akun !== 'undefined') Akun.matikanSesi(code === 'unauthorized' ? 'Sesi berakhir. Masuk kembali ya.' : ''); } catch(e){ /* abaikan */ }
      applyRoleUI();
      return d || { ok:false, code };
    }
    if(code === 'offline'){
      /* Offline → pakai cache lama (grace). Jangan cabut lisensi/sesi lokal. */
      const c = cacheBaca(ACCESS_K);
      if(c && c.akses){
        _akses = c.akses;
        _role = c.akses.has_access ? (c.akses.role || '') : '';
        _diketahui = true;
        applyRoleUI();
        return c.akses;
      }
      return d;
    }
    if(code === 'invalid_outlet' && !retry){
      outletPilih(null); _akses = null;
      return muatAkses(null, true);
    }
    return d || { ok:false, code:'unknown' };
  }
  function peran(){ return _role; }
  function peranDiketahui(){ return _diketahui; }
  function boleh(tier){
    const need = ROLE_RANK[tier] || 0;
    if(!_diketahui) return true;   /* belum diketahui → jangan sembunyikan apa pun */
    if(!_role) return false;       /* diketahui: tanpa akses → semua khusus owner disembunyikan */
    return (ROLE_RANK[_role] || 0) >= need;
  }
  function filterRoleEls(root){
    const scope = root || document;
    scope.querySelectorAll('[data-role]').forEach(el=>{
      const ok = boleh(el.dataset.role);
      el.classList.toggle('role-hidden', !ok);
      el.setAttribute('aria-hidden', ok ? 'false' : 'true');
    });
  }
  function applyRoleUI(){
    document.body.dataset.role = _role || '';
    renderKartuPeran();
    filterRoleEls(document);
    const note = document.getElementById('webRoleNote');
    if(note){
      if(_diketahui && _role && _role !== 'owner'){
        note.style.display = '';
        note.textContent = '🔒 Publikasi & domain hanya untuk pemilik. Peran Anda: ' + (ROLE_LABEL[_role] || _role) + '.';
      } else if(_diketahui && !_role){
        note.style.display = '';
        note.textContent = '⚠️ Akun Anda belum punya akses masjid. Hubungi pemilik untuk diundang.';
      } else {
        note.style.display = 'none';
        note.textContent = '';
      }
    }
  }
  function renderKartuPeran(){
    const lbl = document.getElementById('rowPeranLabel');
    const badge = document.getElementById('rowPeranBadge');
    const sel = document.getElementById('selectOutlet');
    const nama = document.getElementById('rowOutletNama');
    if(lbl) lbl.textContent = !_diketahui ? 'Memuat…' : (_role ? (ROLE_LABEL[_role] || _role) : 'Tidak punya akses');
    if(badge){
      badge.className = 'role-badge' + (_role && ROLE_RANK[_role] ? ' ' + _role : '');
      badge.textContent = !_diketahui ? '…' : (_role ? (ROLE_LABEL[_role] || _role) : 'Tanpa akses');
    }
    const outs = daftarOutlet();
    if(sel){
      const cur = outletTerpilih();
      if(outs.length){
        sel.innerHTML = outs.map(o=>`<option value="${esc(o.id)}"${o.id===cur?' selected':''}>${esc(o.nama)}</option>`).join('');
        if(cur && !outs.some(o=>o.id===cur)) sel.value = outs[0].id;
      } else {
        sel.innerHTML = '<option value="">— belum ada masjid —</option>';
      }
      sel.disabled = !outs.length;
    }
    if(nama){
      const cur = outletTerpilih();
      const o = outs.find(x=>x.id===cur);
      nama.textContent = o ? ('Peran di masjid ini: ' + (ROLE_LABEL[o.role] || o.role || '—')) : '';
    }
  }
  async function gantiOutlet(id){
    outletPilih(id || null);
    _akses = null;
    _situs = []; _situsAktif = null;
    await muatAkses(id || null);
    try { if (typeof Platform !== 'undefined' && Platform.refresh) Platform.refresh(); } catch(e){ /* abaikan */ }
    toast('Masjid aktif diganti.');
  }
  function reset(){
    _role = null; _diketahui = false; _akses = null;
    _situs = []; _situsAktif = null;
    cacheTulis(ACCESS_K, null);
    applyRoleUI();
  }

  /* ---------------- pegawai (4 RPC HUB) ---------------- */
  async function muatAnggota(){
    const params = { p_app_key: APP_KEY };
    const oid = outletAktif();
    if(oid) params.p_outlet_id = oid;
    return rpc('app_list_members', params);
  }
  async function tambahAnggota(wa, role, nama){
    const params = { p_app_key: APP_KEY, p_wa: wa, p_role: role };
    if(nama) params.p_nama = nama;
    const oid = outletAktif();
    if(oid) params.p_outlet_id = oid;
    return rpc('app_add_member', params);
  }
  async function ubahPeranAnggota(memberId, role){ return rpc('app_set_member_role', { p_member_id: memberId, p_role: role }); }
  async function hapusAnggota(memberId){ return rpc('app_remove_member', { p_member_id: memberId }); }

  async function bukaKelolaAnggota(){
    if(!boleh('owner')){ toast('🔒 Hanya pemilik yang bisa mengelola pegawai.'); return; }
    openModal(`<div class="modal-head"><h2>👥 Kelola Pegawai</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
      <p class="muted" id="staffMsg" style="font-size:13px;">Memuat anggota…</p>
      <div id="staffList"></div>
      <div class="section-title">Tambah Pegawai</div>
      <label for="stWa">No. WhatsApp</label><input type="tel" id="stWa" inputmode="numeric" placeholder="08xx xxxx xxxx" autocomplete="off">
      <label for="stNama" style="margin-top:8px;">Nama (opsional)</label><input type="text" id="stNama" placeholder="Nama debugger" autocomplete="off">
      <label for="stRole" style="margin-top:8px;">Peran</label>
      <select id="stRole"><option value="kasir">Kasir</option><option value="manajer">Manajer</option></select>
      <div class="btn-row" style="margin-top:12px;"><button class="btn btn-primary" onclick="HUB.tambahAnggotaUI()">➕ Tambah</button></div>`);
    await renderDaftarAnggota();
  }
  async function renderDaftarAnggota(){
    const list = document.getElementById('staffList');
    const msg = document.getElementById('staffMsg');
    if(!list) return;
    const d = await muatAnggota();
    if(!d || !d.ok){
      if(msg) msg.textContent = hubPesanGagal(d, 'Gagal memuat daftar pegawai.');
      list.innerHTML = '';
      return;
    }
    if(msg) msg.textContent = 'Peran Anda di masjid ini: ' + (ROLE_LABEL[d.role] || d.role || '—');
    const members = Array.isArray(d.members) ? d.members : [];
    list.innerHTML = members.length
      ? '<div class="anggota-list">' + members.map(m=>`
        <div class="anggota-item">
          <div class="info">
            <div class="nm">${esc(m.nama || m.wa || 'Tanpa nama')}${m.is_self ? ' (Anda)' : ''}</div>
            <div class="wa">${esc(m.wa || '—')}</div>
          </div>
          <span class="role-badge ${esc(m.role||'')}">${esc(ROLE_LABEL[m.role] || m.role || '—')}</span>
          <div class="acts">
            <select class="mini-sel" onchange="HUB.ubahPeranUI('${esc(m.member_id)}', this.value)" aria-label="Ubah peran">
              ${ROLES.map(r=>`<option value="${r}"${r===m.role?' selected':''}>${ROLE_LABEL[r]}</option>`).join('')}
            </select>
            ${m.is_self ? '' : `<button class="mini-btn danger" onclick="HUB.hapusAnggotaUI('${esc(m.member_id)}')" aria-label="Hapus pegawai">🗑️</button>`}
          </div>
        </div>`).join('') + '</div>'
      : '<p class="muted">Belum ada pegawai lain di masjid ini.</p>';
  }
  async function tambahAnggotaUI(){
    const wa = (document.getElementById('stWa')||{}).value || '';
    const nama = (document.getElementById('stNama')||{}).value || '';
    const role = (document.getElementById('stRole')||{}).value || 'kasir';
    const msg = document.getElementById('staffMsg');
    const r = await tambahAnggota(wa, role, nama);
    if(r && r.ok){
      toast('Pegawai ditambahkan.');
      const w = document.getElementById('stWa'); if(w) w.value = '';
      const n = document.getElementById('stNama'); if(n) n.value = '';
      await renderDaftarAnggota();
    } else if(msg){
      msg.textContent = hubPesanGagal(r, 'Gagal menambah pegawai. Cek nomor WhatsApp.');
    }
  }
  async function ubahPeranUI(memberId, role){
    const r = await ubahPeranAnggota(memberId, role);
    toast(r && r.ok ? 'Peran diperbarui.' : hubPesanGagal(r, 'Gagal mengubah peran.'));
    await renderDaftarAnggota();
  }
  async function hapusAnggotaUI(memberId){
    if(!confirm('Hapus pegawai ini dari masjid?')) return;
    const r = await hapusAnggota(memberId);
    toast(r && r.ok ? 'Pegawai dihapus.' : hubPesanGagal(r, 'Gagal menghapus pegawai.'));
    await renderDaftarAnggota();
  }

  /* ---------------- situs (slug + domain) ---------------- */
  /* Situs aktif: pakai slug yang tersimpan di perangkat bila cocok dengan
     daftar milik akun; kalau tidak → situs milik sendiri (owner). */
  function pilihSitus(){
    if(!_situs.length) return null;
    const cur = (DB.settings && DB.settings.pubSlug) || '';
    return _situs.find(s=>s.slug===cur) || _situs.find(s=>s.is_owner) || _situs[0];
  }
  async function muatSitus(){
    const d = await rpc('masjid_my_sites', {});
    if(d && d.ok){
      _situs = Array.isArray(d.sites) ? d.sites : [];
      _situsAktif = pilihSitus();
      /* Simpan slug situs milik sesi. Tanpa ini `slugAktif()` jatuh ke slug
         bawaan "masjid" → sinkron & pratinjau website mengarah ke situs yang
         salah (temuan uji E2E 20 Nov 2026). */
      if(_situsAktif && _situsAktif.slug){
        try{
          if(!DB.settings || DB.settings.pubSlug !== _situsAktif.slug){
            if(!DB.settings) DB.settings = {};
            DB.settings.pubSlug = _situsAktif.slug;
            saveDB();
          }
        }catch(e){ /* abaikan */ }
        try{ localStorage.setItem(SLUG_K, _situsAktif.slug); }catch(e){ /* abaikan */ }
      }
    }
    return d;
  }
  /* True kalau daftar situs sudah dimuat dari server. Dipakai sinkron agar
     tidak mengirim data ke slug yang bukan milik akun ini. */
  function situsDimuat(){ return _situs.length > 0; }
  /* Slug yang dipakai untuk publish, preview & sinkron — selalu milik akun. */
  function slugAktif(){
    if (_situsAktif && _situsAktif.slug) return _situsAktif.slug;
    const cache = (DB.settings && DB.settings.pubSlug) || '';
    if (cache) return cache;
    try { const s = localStorage.getItem(SLUG_K); if (s) return s; } catch(e){ /* abaikan */ }
    return 'masjid';
  }
  async function pastikanSitus(){
    const d = await muatSitus();
    if(!d || !d.ok) return { ok:false, code:(d && d.code) || 'offline' };
    if(_situsAktif) return { ok:true, site:_situsAktif };
    /* Belum ada situs → provision otomatis (outlet + lisensi + membership + site + token) */
    const oid = outletAktif();
    const nama = (DB.settings && DB.settings.namaMasjid) || 'Masjid Saya';
    const r = await rpc('masjid_ensure_site', { p_slug:null, p_nama:nama, p_outlet_id:oid });
    if(r && r.ok){
      await muatSitus();
      _situsAktif = _situs.find(s=>s.slug===r.slug)
        || { site_id:r.site_id, slug:r.slug, nama:r.nama, role:r.role, domains:[], is_owner:true };
      return { ok:true, site:_situsAktif };
    }
    return r || { ok:false, code:'no_site' };
  }
  async function publishViaAkun(payload){
    const s = await pastikanSitus();
    if(!s || !s.ok || !s.site) return { ok:false, code:(s && s.code) || 'no_site' };
    const r = await rpc('masjid_publish_by_account', { p_slug:s.site.slug, p_data:payload });
    if(r && r.ok){ DB.settings.pubSlug = s.site.slug; saveDB(); }
    return r;
  }
  async function draftViaAkun(payload){
    const s = await pastikanSitus();
    if(!s || !s.ok || !s.site) return { ok:false, code:(s && s.code) || 'no_site' };
    const r = await rpc('masjid_draft_by_account', { p_slug:s.site.slug, p_data:payload });
    if(r && r.ok){ DB.settings.pubSlug = s.site.slug; saveDB(); }
    return r;
  }
  /* Draft pengganti kolom `masjid_website.draft` — server hanya mengizinkan
     owner situs; dipakai saat perangkat belum punya draft lokal. */
  async function myDraft(slug){
    const sl = slug || slugAktif();
    if(!sl) return { ok:false, code:'invalid_slug' };
    return rpc('masjid_my_draft', { p_slug: sl });
  }
  /* Sinkron data operasional (kas, jamaah, kegiatan, …) — server memeriksa
     peran pada situs lewat sesi akun; tidak ada token di perangkat. */
  async function syncPush(slug, ops){
    const sl = slug || slugAktif();
    if(!sl) return { ok:false, code:'invalid_slug' };
    return rpc('masjid_sync_push', { p_slug: sl, p_ops: ops || [] });
  }
  async function syncPull(slug, since, limit){
    const sl = slug || slugAktif();
    if(!sl) return { ok:false, code:'invalid_slug' };
    return rpc('masjid_sync_pull', { p_slug: sl, p_since: since || 0, p_limit: limit || 300 });
  }

  function renderSitus(){
    const urlEl = document.getElementById('webSiteUrl');
    const metaEl = document.getElementById('webSiteMeta');
    const s = _situsAktif;
    const doms = (s && Array.isArray(s.domains)) ? s.domains : [];
    const aktif = doms.filter(d=>d.status==='active');
    if(urlEl) urlEl.textContent = aktif.length ? ('https://' + aktif[0].domain) : (s ? (webBaseUrl() + s.slug) : '—');
    if(metaEl){
      if(!s) metaEl.textContent = 'Belum disiapkan. Tutup dan buka lagi halaman Website setelah masuk.';
      else {
        const parts = ['Slug: ' + s.slug];
        if(s.outlet_nama) parts.push('Masjid: ' + s.outlet_nama);
        if(aktif.length > 1) parts.push('+' + (aktif.length-1) + ' domain lain');
        metaEl.textContent = parts.join(' · ');
      }
    }
    renderDomainList();
    filterRoleEls(document);
    /* Owner tanpa situs → siapkan otomatis (idempotent, idempotent di server). */
    if(!s && _diketahui && _role === 'owner' && !_provisioning){
      _provisioning = true;
      pastikanSitus().then(()=>{ _provisioning = false; renderSitus(); }).catch(()=>{ _provisioning = false; });
    }
  }
  function renderDomainList(){
    const el = document.getElementById('webDomainList');
    if(!el) return;
    const s = _situsAktif;
    const doms = (s && Array.isArray(s.domains)) ? s.domains : [];
    if(!doms.length){
      el.innerHTML = '<p class="muted" style="font-size:12px;">Belum ada domain custom. Klaim domain agar website punya alamat sendiri (mis. masjidku.solo.id).</p>';
      return;
    }
    el.innerHTML = doms.map(d=>`
      <div class="dom-box">
        <div class="dom-nm">${esc(d.domain)}</div>
        <div class="dns">${d.status === 'active'
          ? '✅ Aktif — website otomatis memakai domain ini.'
          : '⏳ Menunggu verifikasi DNS. Buat record DNS di registrar, lalu tekan "Cek Verifikasi".'}</div>
        ${d.status === 'active' ? '' : `<div class="btn-row" style="margin-top:10px;"><button class="btn btn-sm btn-secondary" onclick="HUB.verifikasiDomainUI('${esc(d.domain)}')">🔍 Cek Verifikasi</button></div>`}
      </div>`).join('');
  }
  function bukaKlaimDomain(){
    if(!boleh('owner')){ toast('🔒 Hanya pemilik yang bisa klaim domain.'); return; }
    openModal(`<div class="modal-head"><h2>🌐 Klaim Domain Custom</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
      <p class="muted" style="line-height:1.6;">Masukkan domain milik masjid (contoh: <b>masjidku.solo.id</b>). Setelah diklaim, Anda akan mendapat instruksi DNS untuk dipasangkan di registrar domain.</p>
      <label for="domInput">Domain</label><input type="text" id="domInput" placeholder="masjidku.solo.id" autocapitalize="off" autocorrect="off" spellcheck="false">
      <p class="muted" id="domMsg" style="margin-top:8px;font-size:12px;"></p>
      <div class="btn-row" style="margin-top:12px;"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="HUB.klaimDomainUI()">Klaim</button></div>`);
  }
  async function klaimDomain(domain, siteId, force){
    const fn = force ? 'masjid_reclaim_domain' : 'masjid_claim_domain';
    const body = force
      ? { p_domain:domain }
      : { p_domain:domain, p_site_id:siteId || null };
    const r = await rpc(fn, body);
    if(r && r.ok){
      const map = cacheBaca(DOMTOK_K) || {};
      map[r.domain] = r.verification_token;
      cacheTulis(DOMTOK_K, map);
      await muatSitus();
    }
    return r;
  }
  async function klaimDomainUI(){
    const raw = (document.getElementById('domInput')||{}).value || '';
    const msg = document.getElementById('domMsg');
    const domain = String(raw).toLowerCase().trim().replace(/^https?:\/\//,'').replace(/\/.*$/,'');
    if(!domain){ if(msg) msg.textContent = 'Isi domain dulu.'; return; }
    const s = _situsAktif;
    const siteId = (s && s.site_id) ? s.site_id : null;
    if(msg) msg.textContent = 'Meng klaim domain...';
    const r = await klaimDomain(domain, siteId, false);
    if(!r || !r.ok){
      /* F2: domain sudah AKTIF → jangan diturunkan diam-diam.
         Minta konfirmasi owner, baru panggil RPC reclaim. */
      if(r && r.code === 'domain_already_active'){
        const ok = confirm(
          'Domain ' + r.domain + ' sudah AKTIF untuk masjid ini.\n\n' +
          'Klaim ulang akan:\n' +
          '• membatalkan status AKTIF (website domain ini berhenti ter-resolve)\n' +
          '• membuat token verifikasi baru\n\n' +
          'Lanjutkan klaim ulang?'
        );
        if(!ok){
          if(msg) msg.textContent = 'Klaim dibatalkan. Domain tetap aktif.';
          return;
        }
        if(msg) msg.textContent = 'Memperbarui klaim domain...';
        const r2 = await klaimDomain(domain, siteId, true);
        if(!r2 || !r2.ok){
          if(msg) msg.textContent = hubPesanGagal(r2, 'Gagal memperbarui klaim domain.');
          return;
        }
        renderDnsBox(r2, msg);
        return;
      }
      if(msg) msg.textContent = hubPesanGagal(r, 'Gagal klaim domain.');
      return;
    }
    renderDnsBox(r, msg);
  }
  function renderDnsBox(r, msg){
    const dns = r.dns || {};
    if(msg) msg.innerHTML = '<b>Domain diklaim: ' + esc(r.domain) + '</b><br>' + esc(dns.catatan || '');
    if(!msg || !msg.parentNode) return;
    /* Hapus box lama supaya tidak menumpuk saat klaim ulang. */
    const lama = msg.parentNode.querySelectorAll('.dom-box');
    for(let i=0;i<lama.length;i++) lama[i].remove();
    const box = document.createElement('div');
    box.className = 'dom-box';
    box.innerHTML = `
      <div class="dom-nm">${esc(r.domain)}</div>
      <div class="dns">Buat record berikut di registrar domain:</div>
      <div class="dns">• <b>CNAME</b> <code>@</code> → <code>${esc(dns.cname_target||'')}</code><br>
      • <b>TXT</b> <code>${esc(dns.txt_name||'_vercel')}</code> → <code>${esc(dns.txt_value||'')}</code><br>
      • atau <b>A</b> <code>@</code> → <code>${esc(dns.a_record||'')}</code></div>
      <div class="btn-row" style="margin-top:10px;"><button class="btn btn-sm btn-primary" onclick="HUB.verifikasiDomainUI('${esc(r.domain)}')">🔍 Cek Verifikasi</button></div>`;
    msg.parentNode.insertBefore(box, msg.nextSibling);
    renderSitus();
  }
  async function verifikasiDomain(domain){
    const map = cacheBaca(DOMTOK_K) || {};
    const tok = map[domain];
    if(!tok) return { ok:false, code:'token_not_local' };
    const r = await rpc('masjid_verify_domain', { p_domain:domain, p_token:tok });
    if(r && r.ok) await muatSitus();
    return r;
  }
  async function verifikasiDomainUI(domain){
    const r = await verifikasiDomain(domain);
    if(r && r.ok){
      toast('✅ Domain aktif: ' + r.domain);
      closeModal();
      renderSitus();
      return;
    }
    const msg = document.getElementById('domMsg');
    const t = hubPesanGagal(r, 'Verifikasi gagal. DNS belum siap.');
    if(msg) msg.textContent = t; else toast(t);
  }

  /* ---------------- boot ---------------- */
  async function boot(){
    const d = await muatAkses();
    applyRoleUI();
    /* Daftar situs WAJIB dimuat di boot. Tanpa ini slugAktif() jatuh ke slug
       bawaan "masjid" → sinkron diarahkan ke situs yang bukan milik akun ini
       (temuan uji E2E 20 Nov 2026: status "Akun ini tidak berhak"). */
    try { await muatSitus(); } catch (e) { /* offline → pakai cache slug lokal */ }
    applyRoleUI();
    return d;
  }

  return {
    /* peran & gating */
    peran, peranDiketahui, boleh, applyRoleUI, filterRoleEls, boot, reset,
    /* outlet */
    gantiOutlet, outletTerpilih, outletAktif,
    /* pegawai */
    bukaKelolaAnggota, tambahAnggotaUI, ubahPeranUI, hapusAnggotaUI, muatAnggota,
    /* situs & publikasi */
    muatAkses, muatSitus, renderSitus, renderKartuPeran, slugAktif, situsDimuat,
    publishViaAkun, draftViaAkun, myDraft, pastikanSitus,
    syncPush, syncPull,
    /* domain */
    bukaKlaimDomain, klaimDomainUI, verifikasiDomainUI
  };
})();
window.HUB = HUB;

/* =========================================================
   SINKRON DATA KE CLOUD (offline-first, per record)
   =========================================================
   Data tetap 100% di perangkat (localStorage) — aplikasi tetap jalan penuh
   saat tidak ada sinyal. Lapisan ini hanya menitipkan perubahan ke cloud,
   lalu menarik perubahan dari perangkat lain.

   Alur:
   - Tiap saveDB() membandingkan isi DB dengan "bayangan" terakhir. Record yang
     baru/berubah → masuk antrean kirim; record yang hilang → penanda hapus.
     Satu record = satu operasi, jadi hemat kuota dan tidak saling menimpa.
   - Antrean disimpan di perangkat, jadi perubahan TIDAK hilang kalau internet
     putus atau aplikasi ditutup — dikirim lagi otomatis nanti.
   - Penarikan memakai nomor urut perubahan dari server (kursor), disimpan per
     situs. Kursor sengaja TIDAK dimajukan saat mengirim, supaya perubahan
     perangkat lain yang belum sempat terlihat tidak terlewat.
   - Hasil tarikan ditulis ke DB tanpa dimasukkan lagi ke antrean kirim (kalau
     tidak, kirim & tarik akan berputar tanpa henti).
   - Record yang perubahannya BELUM terkirim tidak ditimpa oleh tarikan:
     perubahan lokal selalu menang di perangkat ini, lalu dikirim ke cloud.
   - Penanda "lebih baru" memakai jam perangkat, tapi dijaga sebagai jam logis
     (selalu lebih besar dari yang pernah terlihat) supaya jam perangkat yang
     meleset tidak membuat perubahannya selalu kalah.
   - Data yang sudah ada di perangkat sebelum fitur ini dipasang dinaikkan
     SEKALI secara bertahap (lihat naikkanBasis), supaya data lama ikut ke awan
     tanpa menghabiskan penyimpanan HP.

   Yang SENGAJA tidak disinkron:
   - `license` — status lisensi datang dari server, per perangkat.
   - `websiteDraft` / `websiteLive` — jalurnya sendiri (tabel masjid_website).
   - `platform.shift` — sesi shift yang sedang berjalan, memang per perangkat.
   ========================================================= */
const SYNC_COLLS = ['kas','jamaah','kegiatan','inventaris','pinjam','pinjamKas','salurZakat','fitrah','cashflow','shiftLog','opnameLog'];
const SYNC_TUNGGAL = ['settings','platformSettings'];

const Sync = (() => {
  const ANTREAN_KEY = 'ksmasjid_sync_antrean_v1';
  const KURSOR_KEY  = 'ksmasjid_sync_kursor_v1';
  const BATAS_OPS   = 100;      /* maksimal record per permintaan */
  const BATAS_BYTE  = 600000;   /* maksimal besar data per permintaan (~600 KB) */

  let snap = new Map();         /* kunci record -> sidik jari isi */
  let mtTerakhir = 0;           /* jam logis perangkat */
  let saatMenerapkan = false;   /* sedang menulis hasil tarikan → jangan dicatat */
  let sedangKirim = false;
  let sedangTarik = false;
  let jedaKirim = null;
  let kode = 'belum', waktu = null, pesan = '';
  /* adaMasalah = ada langkah yang gagal/ditunda di putaran ini. Dipakai supaya
     status TIDAK berbunyi "Tersimpan di awan" hanya karena antreannya kosong. */
  let adaMasalah = false;

  const kunci = (coll,id) => coll + '\u0000' + id;

  /* ---------- baca isi DB tanpa efek samping ---------- */
  function platNama(nama){
    const p = DB.platform;
    return (p && Array.isArray(p[nama])) ? p[nama] : [];
  }
  function ambilArr(coll){
    if (coll === 'cashflow' || coll === 'shiftLog' || coll === 'opnameLog') return platNama(coll);
    return Array.isArray(DB[coll]) ? DB[coll] : [];
  }
  function ambilSatu(coll){
    if (coll === 'settings') return (DB.settings && typeof DB.settings === 'object') ? DB.settings : null;
    if (coll === 'platformSettings') return (DB.platform && DB.platform.settings) ? DB.platform.settings : null;
    return null;
  }
  function buatArr(coll){
    if (coll === 'cashflow' || coll === 'shiftLog' || coll === 'opnameLog'){
      if (!DB.platform) DB.platform = {};
      if (!Array.isArray(DB.platform[coll])) DB.platform[coll] = [];
      return DB.platform[coll];
    }
    if (!Array.isArray(DB[coll])) DB[coll] = [];
    return DB[coll];
  }
  function semuaRecord(){
    const out = [];
    for (const coll of SYNC_COLLS){
      for (const rec of ambilArr(coll)){
        if (rec && rec.id != null) out.push([kunci(coll,String(rec.id)), coll, String(rec.id), rec]);
      }
    }
    for (const coll of SYNC_TUNGGAL){
      const rec = ambilSatu(coll);
      if (rec) out.push([kunci(coll,'main'), coll, 'main', rec]);
    }
    return out;
  }

  /* ---------- sidik jari: cukup untuk tahu "record ini berubah?" ---------- */
  function sidik(teks){
    let h = 5381;
    for (let i = 0; i < teks.length; i++) h = ((h * 33) ^ teks.charCodeAt(i)) >>> 0;
    return teks.length + ':' + h.toString(36);
  }
  function bangunUlangSnap(){
    const s = new Map();
    for (const baris of semuaRecord()) s.set(baris[0], sidik(JSON.stringify(baris[3])));
    snap = s;
  }

  /* ---------- jam logis ---------- */
  function mtBaru(){
    const n = Math.max(Date.now(), mtTerakhir + 1);
    mtTerakhir = n;
    return n;
  }
  function catatMt(mt){
    const n = Number(mt) || 0;
    /* mt dari masa depan jauh (jam perangkat lain meleset) tidak dipakai,
       supaya tidak menyeret jam logis perangkat ini. */
    if (n > mtTerakhir && n <= Date.now() + 60000) mtTerakhir = n;
  }

  /* ---------- antrean & kursor di perangkat ---------- */
  function bacaAntrean(){
    try{
      const o = JSON.parse(localStorage.getItem(ANTREAN_KEY) || '{}');
      return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {};
    }catch(e){ return {}; }
  }
  function simpanAntrean(o){
    try{ localStorage.setItem(ANTREAN_KEY, JSON.stringify(o)); }
    catch(e){ console.warn('Sync: antrean gagal disimpan', e); }
  }
  function sisaAntrean(){ return Object.keys(bacaAntrean()).length; }
  function bacaKursor(slug){
    try{
      const o = JSON.parse(localStorage.getItem(KURSOR_KEY) || '{}');
      const n = Number(o[slug]);
      return (Number.isFinite(n) && n > 0) ? n : 0;
    }catch(e){ return 0; }
  }
  function simpanKursor(slug,n){
    try{
      const o = JSON.parse(localStorage.getItem(KURSOR_KEY) || '{}');
      o[slug] = n;
      localStorage.setItem(KURSOR_KEY, JSON.stringify(o));
    }catch(e){ /* abaikan */ }
  }

  /* ---------- catat perubahan setelah penyimpanan lokal ---------- */
  function setelahSimpan(){
    if (saatMenerapkan) return;
    try{
      const antrean = bacaAntrean();
      const sekarang = new Map();
      let n = 0;
      for (const baris of semuaRecord()){
        const k = baris[0], s = sidik(JSON.stringify(baris[3]));
        sekarang.set(k, s);
        if (snap.get(k) === s) continue;
        antrean[k] = { coll:baris[1], id:baris[2], data:baris[3], deleted:false, mt:mtBaru() };
        n++;
      }
      /* record yang hilang dari DB → penanda hapus */
      const kunciLama = [];
      snap.forEach((v,k) => kunciLama.push(k));
      for (const k of kunciLama){
        if (sekarang.has(k)) continue;
        const pisah = k.split('\u0000');
        antrean[k] = { coll:pisah[0], id:pisah[1], data:null, deleted:true, mt:mtBaru() };
        n++;
      }
      snap = sekarang;
      if (n){ simpanAntrean(antrean); jadwalkanKirim(); }
    }catch(e){ console.warn('Sync: gagal mencatat perubahan', e); }
  }

  function jadwalkanKirim(){
    if (jedaKirim) clearTimeout(jedaKirim);
    jedaKirim = setTimeout(() => { jedaKirim = null; kirim(); }, 2500);
  }

  /* ---------- tulis hasil tarikan ke DB ---------- */
  function simpanKeDb(coll,id,data){
    if (coll === 'settings'){
      DB.settings = Object.assign({}, DB.settings, data || {});
      return true;
    }
    if (coll === 'platformSettings'){
      if (!DB.platform) DB.platform = {};
      DB.platform.settings = Object.assign({}, DB.platform.settings || {}, data || {});
      return true;
    }
    const arr = buatArr(coll);
    const i = arr.findIndex(r => r && String(r.id) === id);
    if (i >= 0){
      if (JSON.stringify(arr[i]) === JSON.stringify(data)) return false;
      arr[i] = data;
      return true;
    }
    arr.push(data);
    return true;
  }
  function hapusDariDb(coll,id){
    if (coll === 'settings' || coll === 'platformSettings') return false;
    const arr = buatArr(coll);
    const sisa = arr.filter(r => !(r && String(r.id) === id));
    if (sisa.length === arr.length) return false;
    arr.length = 0;
    for (const r of sisa) arr.push(r);
    return true;
  }
  function terapkan(ops, antrean){
    let ubah = 0;
    saatMenerapkan = true;
    try{
      for (const op of ops){
        catatMt(op && op.mt);
        const coll = op && op.coll;
        const id = (op && op.id != null) ? String(op.id) : '';
        if (!coll || !id) continue;
        if (antrean[kunci(coll,id)]) continue;   /* perubahan lokal belum terkirim → jangan ditimpa */
        if (op.deleted) { if (hapusDariDb(coll,id)) ubah++; }
        else if (simpanKeDb(coll,id,op.data)) ubah++;
      }
      if (ubah) saveDB();
    } finally { saatMenerapkan = false; }
    if (ubah){ bangunUlangSnap(); segarkanTampilan(); }
    return ubah;
  }
  /* Sesudah menarik data, tampilan halaman yang sedang dibuka disegarkan —
     tapi TIDAK kalau ada formulir/modal terbuka, supaya ketikan tidak hilang. */
  function segarkanTampilan(){
    try{
      if (document.querySelector('#modalBackdrop.open')) return;
      const ae = document.activeElement;
      if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
      const view = (typeof navStack !== 'undefined' && navStack.length) ? navStack[navStack.length - 1] : null;
      if (view && typeof renderView === 'function') renderView(view);
    }catch(e){ /* abaikan */ }
  }

  /* ---------- status (bahasa sehari-hari) ---------- */
  function catatStatus(k, teks){
    kode = k; pesan = teks || ''; waktu = new Date();
    try{ renderStatus(); }catch(e){ /* abaikan */ }
  }
  /* Kegagalan/penundaan: tandai supaya putaran ini tidak dianggap "beres". */
  function gagal(k, teks){ adaMasalah = true; catatStatus(k, teks); }
  /* Menuliskan keadaan sinkron ke baris Pengaturan (kalau halamannya terbuka). */
  function renderStatus(){
    const t = document.getElementById('syncStatusTeks');
    if (!t) return;
    const k = statusKapan();
    t.textContent = statusTeks() + (k ? ' · pukul ' + k : '');
  }
  function terjemah(r){
    const c = (r && r.code) || 'gagal';
    if (c === 'not_signed_in' || c === 'unauthorized') return ['belum-masuk', 'Masuk akun dulu'];
    if (c === 'offline') return ['offline', 'Menunggu sinyal'];
    if (c === 'forbidden') return ['ditolak', 'Akun ini tidak berhak'];
    if (c === 'site_not_found') return ['ditolak', 'Situs masjid belum siap'];
    return ['gagal', 'Gagal terhubung'];
  }

  /* ---------- NAIKKAN DATA LAMA (sekali per situs) ----------
     Data yang sudah ada di perangkat SEBELUM fitur ini dipasang tidak pernah
     lewat antrean (karena antrean hanya mencatat perubahan), jadi dinaikkan
     sekali secara bertahap agar tidak menghabiskan penyimpanan HP.

     Dipakai penanda "0" (mt=0) untuk data lama ini. Akibatnya: record yang
     SUDAH ada di awan tidak ditimpa (versi awan dianggap lebih benar, karena
     datang dari perangkat yang sudah lebih dulu tersambung), sedangkan record
     yang belum ada di awan dinaikkan utuh. Perubahan sesudah ini memakai jam
     asli, jadi selalu menang atas penanda 0. */
  const BASIS_KEY = 'ksmasjid_sync_basis_v1';
  const BATAS_BASIS_PUTARAN = 8;   /* maksimal 8 permintaan per putaran */

  function bacaBasis(){
    try{
      const o = JSON.parse(localStorage.getItem(BASIS_KEY) || '{}');
      return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {};
    }catch(e){ return {}; }
  }
  function simpanBasis(o){
    try{ localStorage.setItem(BASIS_KEY, JSON.stringify(o)); }catch(e){ /* abaikan */ }
  }
  function basisSelesai(){
    try{ const b = bacaBasis()[HUB.slugAktif()]; return !!(b && b.selesai); }catch(e){ return true; }
  }

  async function naikkanBasis(){
    if (typeof HUB === 'undefined' || !HUB.syncPush) return;
    if (navigator.onLine === false) return;
    let slug;
    try{ slug = HUB.slugAktif(); }catch(e){ return; }
    if (!slug) return;
    const semuaB = bacaBasis();
    const per = semuaB[slug] || { mulai:0, selesai:false };
    if (per.selesai) return;
    const rek = semuaRecord();
    if (!rek.length){ semuaB[slug] = { mulai:0, selesai:true }; simpanBasis(semuaB); return; }
    for (let putar = 0; putar < BATAS_BASIS_PUTARAN; putar++){
      const ops = [];
      let byte = 0, i = per.mulai;
      while (i < rek.length && ops.length < BATAS_OPS){
        const baris = rek[i];
        const op = { coll:baris[1], id:baris[2], data:baris[3], deleted:false, mt:0 };
        const n = JSON.stringify(op).length;
        if (ops.length && byte + n > BATAS_BYTE) break;
        ops.push(op); byte += n; i++;
      }
      if (!ops.length){ per.selesai = true; semuaB[slug] = per; simpanBasis(semuaB); break; }
      catatStatus('jalan', 'Menyimpan data lama ke awan...');
      const r = await HUB.syncPush(slug, ops);
      if (!r || !r.ok){ const t = terjemah(r); gagal(t[0], t[1]); return; }
      per.mulai = i;
      if (per.mulai >= rek.length) per.selesai = true;
      semuaB[slug] = per;
      simpanBasis(semuaB);   /* kemajuan disimpan → aman walau aplikasi ditutup */
      if (per.selesai) break;
    }
  }

  /* ---------- KIRIM ---------- */
  /* Pastikan daftar situs sudah dimuat: tanpa ini slug bisa jatuh ke bawaan
     "masjid" dan data dikirim ke situs yang bukan milik akun ini. */
  async function siapkanSitus(){
    if (typeof HUB === 'undefined') return;
    try { if (HUB.situsDimuat && !HUB.situsDimuat() && HUB.muatSitus) await HUB.muatSitus(); }
    catch(e){ /* offline → server yang memutuskan (role dicek di server) */ }
  }
  async function kirim(){
    if (sedangKirim || saatMenerapkan) return;
    if (typeof HUB === 'undefined' || !HUB.syncPush) return;
    if (navigator.onLine === false){ gagal('offline', 'Menunggu sinyal'); return; }
    await siapkanSitus();
    let antrean = bacaAntrean();
    const daftarKunci = Object.keys(antrean);
    if (!daftarKunci.length){
      if (!adaMasalah && kode !== 'siap') catatStatus('siap', 'Tersimpan di awan');
      return;
    }
    sedangKirim = true;
    try{
      const slug = HUB.slugAktif();
      let i = 0;
      while (i < daftarKunci.length){
        const batch = [], terpakai = [];
        let byte = 0;
        while (i < daftarKunci.length && batch.length < BATAS_OPS){
          const op = antrean[daftarKunci[i]];
          const n = JSON.stringify(op).length;
          if (batch.length && byte + n > BATAS_BYTE) break;
          batch.push(op); terpakai.push(daftarKunci[i]); byte += n; i++;
        }
        const r = await HUB.syncPush(slug, batch);
        if (!r || !r.ok){ const t = terjemah(r); gagal(t[0], t[1]); return; }
        /* Buang HANYA op yang benar-benar terkirim & belum digantikan versi
           yang lebih baru (kalau keburu diubah lagi, biar tetap di antrean). */
        const terbaru = bacaAntrean();
        for (const k of terpakai){
          const lama = antrean[k], kini = terbaru[k];
          if (kini && lama && kini.mt === lama.mt) delete terbaru[k];
        }
        simpanAntrean(terbaru);
        antrean = terbaru;
      }
      catatStatus('siap', 'Tersimpan di awan');
      tarik();
    }catch(e){
      console.warn('Sync: gagal kirim', e);
      gagal('gagal', 'Gagal terhubung');
    }finally{ sedangKirim = false; }
  }

  /* ---------- TARIK ---------- */
  async function tarik(){
    if (sedangTarik || saatMenerapkan) return;
    if (typeof HUB === 'undefined' || !HUB.syncPull) return;
    if (navigator.onLine === false) return;
    await siapkanSitus();
    sedangTarik = true;
    try{
      const slug = HUB.slugAktif();
      let kursor = bacaKursor(slug);
      let putar = 0;
      while (putar++ < 25){
        const r = await HUB.syncPull(slug, kursor);
        if (!r || !r.ok){ if (r) { const t = terjemah(r); gagal(t[0], t[1]); } break; }
        const ops = Array.isArray(r.ops) ? r.ops : [];
        if (ops.length) terapkan(ops, bacaAntrean());
        if (typeof r.cursor === 'number' && r.cursor > kursor){
          kursor = r.cursor;
          simpanKursor(slug, kursor);
        }
        if (!r.ada_lagi || !ops.length) break;
      }
    }catch(e){ console.warn('Sync: gagal tarik', e); }
    finally{ sedangTarik = false; }
  }

  /* ---------- satu putaran penuh (dipakai tombol & saat online) ---------- */
  async function putaran(){
    adaMasalah = false;
    await tarik();
    await naikkanBasis();
    await kirim();
  }
  async function sekarang(){
    catatStatus('jalan', 'Menyinkron...');
    await putaran();
    return { kode, pesan, sisa: sisaAntrean() };
  }

  function statusTeks(){
    if (kode === 'belum') return sisaAntrean() ? 'Menunggu dikirim' : 'Belum tersinkron';
    if (kode === 'jalan') return pesan || 'Menyinkron...';
    if (kode === 'siap'){
      const s = sisaAntrean();
      if (s) return 'Menyinkron... (' + s + ' perubahan)';
      return basisSelesai() ? 'Tersimpan di awan' : 'Sedang menaikkan data lama';
    }
    return pesan || 'Belum tersinkron';
  }
  function statusKapan(){
    if (!waktu) return '';
    return waktu.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
  }

  function mulai(){
    bangunUlangSnap();
    setTimeout(() => { putaran(); }, 3500);
    window.addEventListener('online', () => { putaran(); });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) { putaran(); }
    });
    setInterval(() => { if (!document.hidden) { putaran(); } }, 4*60*1000);
  }

  return { mulai, sekarang, kirim, tarik, setelahSimpan, statusTeks, statusKapan,
           sisaAntrean, bangunUlangSnap, renderStatus };
})();
window.Sync = Sync;

/* =========================================================
   PEMICU SINKRON
   ------------------------------------------------------------
   Sinkron baru berguna kalau sesi akun + daftar situs sudah siap.
   Dipakai setelah login berhasil dan setelah boot aplikasi.
   ========================================================= */
function sinkronSetelahSiap(){
  try {
    Promise.resolve(window.HUB && window.HUB.boot ? window.HUB.boot() : null)
      .then(() => { if (window.Sync && window.Sync.sekarang) window.Sync.sekarang(); })
      .catch(() => { /* abaikan */ });
  } catch (e) { /* abaikan */ }
}

/* =========================================================
   GERBANG LOGIN — layer pertama, tidak bisa ditutup tanpa masuk.
   ========================================================= */
const Gerbang = {
  tampilkan(pesan) {
    const g = gebi('loginGate'); if (!g) return;
    g.classList.remove('hidden');
    try { gebi('app').inert = true; } catch (e) { /* inert tak didukung → overlay tetap memblokir */ }
    Gerbang.tab('masuk');
    const pin = gebi('gatePin'); if (pin) pin.value = '';
    if (pesan) Gerbang.err('masuk', pesan);
    setTimeout(() => { const w = gebi('gateWa'); if (w && document.activeElement !== w) w.focus(); }, 60);
  },
  sembunyikan() {
    const g = gebi('loginGate'); if (g) g.classList.add('hidden');
    try { gebi('app').inert = false; } catch (e) { /* abaikan */ }
  },
  tab(t) {
    const fm = gebi('gateFormMasuk'), fd = gebi('gateFormDaftar');
    const tm = gebi('gateTabMasuk'), td = gebi('gateTabDaftar');
    if (fm) fm.classList.toggle('hidden', t !== 'masuk');
    if (fd) fd.classList.toggle('hidden', t !== 'daftar');
    if (tm) tm.classList.toggle('on', t === 'masuk');
    if (td) td.classList.toggle('on', t === 'daftar');
    /* Narasi bawah menyesuaikan tab: tab Daftar menyebut persetujuan
       Syarat & Ketentuan dan aturan privasi dari PT Mesin Kasir Solo. */
    const note = gebi('gateNote');
    if (note) note.innerHTML = t === 'daftar'
      ? 'Dengan membuat akun, Anda menyetujui <b>Syarat &amp; Ketentuan</b> dan aturan privasi dari <b>PT Mesin Kasir Solo</b>.'
      : 'Belum punya akun? Pilih tab <b>Daftar</b> — sekali daftar, langsung masuk.';
    Gerbang.err('masuk', ''); Gerbang.err('daftar', '');
  },
  err(form, msg) {
    const el = gebi(form === 'masuk' ? 'gateErrMasuk' : 'gateErrDaftar');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('hidden', !msg);
  },
  busy(form, on) {
    const btn = gebi(form === 'masuk' ? 'gateBtnMasuk' : 'gateBtnDaftar');
    if (!btn) return;
    if (on) {
      if (!btn.dataset.label) btn.dataset.label = btn.textContent;
      btn.textContent = 'Memproses…';
      btn.disabled = true; btn.classList.add('gate-busy');
    } else {
      if (btn.dataset.label) btn.textContent = btn.dataset.label;
      btn.disabled = false; btn.classList.remove('gate-busy');
    }
  },
  async masuk() {
    Gerbang.err('masuk', '');
    const wa = (gebi('gateWa') || {}).value || '';
    const pin = (gebi('gatePin') || {}).value || '';
    Gerbang.busy('masuk', true);
    let r;
    try { r = await Akun.masuk(wa, pin); } finally { Gerbang.busy('masuk', false); }
    if (!r.ok) { Gerbang.err('masuk', r.reason); return; }
    Gerbang.selesaiLogin();
  },
  async daftar() {
    Gerbang.err('daftar', '');
    const nama = (gebi('gateNama') || {}).value || '';
    const wa = (gebi('gateWa2') || {}).value || '';
    const pin = (gebi('gatePin2') || {}).value || '';
    const pin2 = (gebi('gatePin3') || {}).value || '';
    if (String(pin) !== String(pin2)) { Gerbang.err('daftar', 'PIN ulangan tidak sama.'); return; }
    Gerbang.busy('daftar', true);
    let r;
    try { r = await Akun.daftar({ wa, pin, nama }); } finally { Gerbang.busy('daftar', false); }
    if (r.ok) { Gerbang.selesaiLogin(); return; }
    if (r.code === 'register_ok_login_failed') {
      Gerbang.tab('masuk');
      if (gebi('gateWa')) gebi('gateWa').value = wa;
      Gerbang.err('masuk', r.reason);
      return;
    }
    Gerbang.err('daftar', r.reason);
  },
  selesaiLogin() {
    Gerbang.sembunyikan();
    ['gatePin', 'gatePin2', 'gatePin3'].forEach(id => { const el = gebi(id); if (el) el.value = ''; });
    navStack = ['dashboard'];
    renderView('dashboard');
    try { updateTrialUI(); } catch (e) { /* abaikan */ }
    toast('Selamat datang 🎉');
    Akun.muatLisensi().then(() => { try { window.Platform.refresh(); } catch (e) { /* abaikan */ } });
    sinkronSetelahSiap();
  },
  async keluar() {
    await Akun.keluar(); // → matikanSesi → gerbang tampil otomatis
    navStack = ['dashboard'];
    try { renderView('dashboard'); } catch (e) { /* abaikan */ }
    const w = gebi('gateWa'); if (w) w.value = '';
  },
  keluarKonfirm() {
    openModal(`<div class="modal-head"><h2>🚪 Keluar dari Akun?</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
      <p class="muted" style="line-height:1.6;">Sesi hanya diakhiri di <b>perangkat ini</b>. Data masjid di perangkat tetap tersimpan. Untuk memakai lagi, cukup masuk dengan No. WhatsApp + PIN yang sama.</p>
      <div class="btn-row" style="margin-top:14px;"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="closeModal();Gerbang.keluar()">Ya, Keluar</button></div>`);
  },
};
window.Gerbang = Gerbang;

// Enter di field gerbang → submit tab yang sedang aktif
[['gateWa', 'masuk'], ['gatePin', 'masuk'], ['gateNama', 'daftar'], ['gateWa2', 'daftar'], ['gatePin2', 'daftar'], ['gatePin3', 'daftar']]
  .forEach(([id, tab]) => {
    const el = gebi(id);
    if (el) el.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); Gerbang[tab](); }
    });
  });

/* =========================================================
   INIT
   ========================================================= */
function updateBrandHeader(){
  const h = document.getElementById('brandName');
  if (h) h.textContent = (DB.settings && DB.settings.namaMasjid && DB.settings.namaMasjid.trim()) || 'Masjid';
  const s = document.getElementById('brandSub');
  if (s) s.textContent = document.title || 'Kasir Solo - Masjid'; // nama aplikasi = <title> halaman
}
/* ---------- saklar pengunci fitur dari Control Center (server) ----------
   RPC publik app_feature_gate('masjid') membaca kolom `gate` pada kartu
   katalog masjid di tabel products (diset lewat Control Center). Tanpa login:
   konfigurasi saklar bukan rahasia. Cache lokal (Platform.bacaGateCache)
   dipakai lebih dulu saat load supaya gate tetap jalan walau offline.
   CATATAN: blok script ini di luar IIFE — pakai `Platform`, bukan `P`. */
Platform.muatGateServer = async function () {
  const SB = String(PUB_URL).replace(/\/$/, '');
  const KEY = PUB_ANON_KEY;
  const panggil = () => fetch(SB + '/rest/v1/rpc/app_feature_gate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: 'Bearer ' + KEY },
    body: JSON.stringify({ p_app: 'masjid' }),
  });
  let res;
  try { res = await panggil(); } catch (e) { return null; } /* offline → cache lama tetap dipakai */
  if (res.status === 401) {
    /* PostgREST kadang balas 401 "JWT issued at future" — retry 1× setelah jeda ±1,2 dtk. */
    await new Promise(r => setTimeout(r, 1200));
    try { res = await panggil(); } catch (e) { return null; }
  }
  if (!res || !res.ok) return null;
  let g = null;
  try { g = await res.json(); } catch (e) { return null; }
  if (!g || typeof g !== 'object' || Array.isArray(g)) g = null; /* null → default bawaan */
  const berubah = Platform.applyServerGate(g);
  try { Platform.refresh(); } catch (e) { /* abaikan */ }
  return { gate: g, berubah: berubah };
};
function init(){
  updateTrialUI();
  bindMitraLinks();
  let ada = false;
  try { ada = Akun.sesiLokal(); } catch (e) { ada = false; }
  if (!ada) { Gerbang.tampilkan(); return; } // gerbang wajib: tanpa sesi, aplikasi tidak dirender
  /* Saklar pengunci fitur: pakai cache dulu (langsung jalan walau offline)... */
  try { Platform.applyServerGate(Platform.bacaGateCache()); } catch (e) { /* abaikan */ }
  try { Platform.renderGateBadges(); } catch (e) { /* abaikan */ }
  updateBrandHeader();
  renderView('dashboard');
  /* ...lalu tarik konfigurasi terbaru dari Control Center; kalau daftar kunci
     berubah, render ulang halaman aktif supaya badge & gate ikut ter-update. */
  try {
    Platform.muatGateServer().then(r => {
      if (r && r.berubah) {
        try {
          const v = (typeof navStack !== 'undefined' && navStack.length) ? navStack[navStack.length - 1] : 'dashboard';
          renderView(v);
          Platform.renderGateBadges();
        } catch (e) { /* abaikan */ }
      }
    }).catch(() => { /* abaikan */ });
  } catch (e) { /* abaikan */ }
  /* Akun.boot() merefresh access token bila sudah kedaluwarsa — HUB (peran &
     outlet) baru boleh jalan SESUDAH token segar, kalau tidak HUB masih
     memakai token lama → 401 → sesi ikut dicabut & gerbang login muncul
     padahal refresh token masih valid. */
  try {
    Promise.resolve(Akun.boot()).then(() => { sinkronSetelahSiap(); });
  } catch (e) {
    sinkronSetelahSiap();
  }
}
init();
Platform.start();

/* Sinkron cloud dinyalakan setelah kerangka aplikasi siap. Aman dijalankan
   sebelum masuk akun: pengiriman/penarikan otomatis menunggu sesi (status
   "Masuk akun dulu") dan antrean perubahan tetap menunggu di perangkat. */
try { if (window.Sync && window.Sync.mulai) window.Sync.mulai(); } catch (e) { /* abaikan */ }

;

/* ===== Aksesibilitas tab (P1-2, 20 Nov 2026) =====
   - Wadah .tabs → role="tablist"; tiap .tab → role="tab".
   - aria-selected selalu mengikuti kelas 'active', jadi pembaca layar tahu tab
     mana yang sedang aktif (sebelumnya 0 dari 25 tab punya ARIA).
   - Observer hanya bekerja bila kelas elemen berstatus 'tab' yang berubah, lalu
     dijadwalkan sekali per frame agar tidak membebani saat halaman digambar. */
(function () {
  function syncTabs() {
    document.querySelectorAll('.tabs').forEach(function (group) {
      if (!group.getAttribute('role')) group.setAttribute('role', 'tablist');
      group.querySelectorAll('.tab').forEach(function (t) {
        t.setAttribute('role', 'tab');
        t.setAttribute('aria-selected', t.classList.contains('active') ? 'true' : 'false');
      });
    });
  }
  function run() { syncTabs(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  window.addEventListener('load', run);
  var pending = false;
  try {
    var mo = new MutationObserver(function (muts) {
      var relevant = muts.some(function (m) {
        return m.type === 'attributes' && m.target && m.target.classList && m.target.classList.contains('tab');
      });
      if (!relevant || pending) return;
      pending = true;
      requestAnimationFrame(function () { pending = false; syncTabs(); });
    });
    mo.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['class'] });
  } catch (e) { /* MutationObserver tak tersedia — tab tetap berfungsi tanpa ARIA */ }
})();
