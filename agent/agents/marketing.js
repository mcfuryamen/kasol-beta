/**
 * Agent Marketing — agent/agents/marketing.js
 * =============================================================================
 * SPESIALIS draft pesan WhatsApp outreach — Mesin Kasir Solo (kasirsolo.com).
 * Berbekal basis pengetahuan produk (PRODUK), jawaban keberatan (OBJECTION),
 * dan sudut manfaat per jenis usaha (hookKategori), dia menyusun draft
 * kontekstual per kontak — SEMUA berhenti sebagai 'draft' di agent_outputs
 * untuk direview manusia di Control → Agent (human-in-the-loop).
 *
 * Tugas (task.tipe):
 *  - 'draft_wa'     : 1 draft per kontak; payload.variasi 1-3 → varian A/B/C.
 *  - 'followup_wa'  : draft lanjutan setelah pesan pertama — wajib bawa sudut
 *                     BARU, bukan pengulangan pitch (lihat payload di bawah).
 *
 * Payload (task.payload):
 *  { kontak_id, kontak: { nama, kategori?, status, sent_count, alamat?,
 *      catatan?, last_contact_at?, source? }, arahan?, variasi?,
 *      pesan_sebelumnya?, hari_lalu? }
 *
 * Alur eksekusi (jalankanMarketing):
 *  1. Re-fetch kontak FRESH by kontak_id (snapshot di payload bisa basi) —
 *     fallback ke snapshot bila fetch gagal/kosong. Status 'mati'/'optout'
 *     → error NON-RETRYABLE (kontak di luar outreach, jangan buang AI).
 *  2. Muat contoh review owner (few-shot dari draft rejected/approved) —
 *     gagal fetch diabaikan diam, tidak boleh gagalkan task.
 *  3. callAI → validasiDraft() → bila invalid, ulang SATU kali dengan pesan
 *     koreksi spesifik → masih invalid = error NON-RETRYABLE.
 *
 * Hasil: ≥1 baris agent_outputs (jenis='draft_wa', status='draft',
 * ref_id=kontak_id). Konvensi judul: "Draft WA — X" / "Draft WA B — X"
 * (varian) / "Follow-up — X" — dipakai seeder utk dedupe per tipe, JANGAN
 * diubah sembarangan.
 */

// ── Basis pengetahuan ─────────────────────────────────────────────────────────
const PRODUK = `
Fakta produk (WAJIB akurat — jangan mengarang fitur/harga/promo lain):
- Produk: aplikasi kasir "Kasir Solo" — jalan di HP, dipasang seperti aplikasi (PWA), ringan.
- Offline-first: data jualan tersimpan di HP sendiri, tetap jalan tanpa internet.
- Fitur inti: catat penjualan, buka/tutup kas harian, catat pengeluaran & pemasukan, laporan untung harian/mingguan, cetak struk via printer Bluetooth, backup data.
- Harga: SEKALI BAYAR Rp 500.000 untuk SELAMANYA — tanpa langganan bulanan/tahunan.
- Bisa dicoba gratis dulu (kuota transaksi gratis tiap bulan, tanpa kartu kredit).
- Bayar: QRIS atau transfer bank, bukti di-upload di aplikasi, lisensi aktif umumnya < 1 jam.
- Pasang didampingi lewat video call sampai jalan.
- Link: https://kaki5.kasirsolo.com
`;

const OBJECTION = `
Jawaban keberatan umum (pakai bila relevan, cukup satu per pesan):
- "Mahal" → sekali Rp 500rb selamanya vs aplikasi langganan yang nempel tiap bulan; kalau dihitung setahun < Rp 1.500/hari.
- "Ribet / gaptek" → tampilannya sederhana buat UMKM; pasang didampingi video call sampai jalan.
- "Takut data hilang" → data ada di HP sendiri + bisa dibackup; tanpa internet pun tetap jalan.
- "Sudah pakai aplikasi lain" → tanpa biaya bulanan, ringan, bisa coba gratis dulu tanpa harus pindah data.
`;

const GAYA = `
Gaya pesan outreach Mesin Kasir Solo:
- Bahasa Indonesia santai tapi sopan; sapa kontak "Kak" / nama sapaan yang diberikan.
- Maksimal ~6 baris, emoji secukupnya (1-3).
- Fokus SATU sudut manfaat yang nyambung dengan jenis usaha kontak — bukan daftar fitur.
- Selalu akhiri pertanyaan/CTA ringan ("Mau linknya, Kak?").
- DILARANG placeholder seperti [nama] / {nama} — tulis langsung.
- DILARANG klaim palsu (pernah chat/temui kontak) atau menyebut diskon/tanggal promo yang tidak ada di fakta produk.
- Variasikan kalimat pembuka antar draft — jangan semuanya mirip.
- Kembalikan HANYA isi pesannya, tanpa kata pengantar atau tanda kutip pembungkus.
`;

// ── Kontekstualisasi kontak ───────────────────────────────────────────────────
const HOOK_KATEGORI = [
  [/makan|warung|kedai|cafe|resto|rm\b|ayam|seblak|bakso|mie|kopi|jajan|warteg/i,
    'Sudut manfaat: catat pesanan & kas warung jadi rapi — tiap tutup usaha langsung kelihatan untung harian.'],
  [/kelontong|sembako|toko\b|grosir|pulsa|bangunan|sparepart|alat/i,
    'Sudut manfaat: struk rapi + laporan per barang — gampang lihat mana yang paling laku dan untungnya.'],
  [/salon|barber|laundry|service|servis|jasa|bengkel|foto|rental|travel|iuran/i,
    'Sudut manfaat: catat pelanggan & pembayaran jadi satu di HP — tidak ada transaksi kelewat.'],
  [/butik|fashion|baju|sepatu|tas|olshop|online shop/i,
    'Sudut manfaat: penjualan online & offline tercatat jadi satu, laporan per item tinggal buka.'],
  [/rosok|pengepul|dagang|jualan|keliling/i,
    'Sudut manfaat: catat beli-jual langsung di HP — ringkas, tanpa buku besar.'],
];

function hookKategori(kategori) {
  const k = String(kategori || '');
  for (const [re, hook] of HOOK_KATEGORI) if (re.test(k)) return hook;
  return 'Sudut manfaat: ganti catat buku manual — jualan, kas, dan untung harian tercatat otomatis di HP.';
}

/** Nama sapaan ringkas — mirror waSapa() di control/js/outreach.js (jangan beda hasil) */
function sapaNama(nama) {
  const words = String(nama || '').replace(/^@/, '')
    .replace(/^(toko|warung|kedai|rm|wm|cafe|resto)\s+/i, '')
    .split(/\s+/).filter((w) => !/^(bp|ibu|mbak|mas|pak|bu)\.?$/i.test(w));
  return words.slice(0, 2).join(' ') || 'Kak';
}

function hariSejak(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 86_400_000));
}

function relasiKontak(k) {
  if (k.source === 'klien_lama') {
    return 'Relasi: kontak adalah KLIEN LAMA Mesin Kasir Solo (dulu pernah memakai kasir dari kami) — sapa hangat seperti kenalan lama, bukan orang asing. Bila ada alamat, boleh menyebut area/jalannya sekilas, tapi JANGAN tulis alamat lengkap dengan nomor rumah.';
  }
  return 'Relasi: kontak masih prospek baru — perkenalan dari nol, jangan mengaku pernah bertemu/chat.';
}

/** Status pipeline: belum → terkirim → bales → minat → beli (+ mati/optout di luar outreach) */
function faseKonteks(k) {
  if (k.status === 'beli') {
    return ['AFTER SALES', 'Kontak SUDAH MEMBELI — cukup makasih + satu tips pakai + tawaran bantuan bila ada kendala. JANGAN menjual lagi.'];
  }
  if (k.status === 'minat') {
    return ['CLOSING', 'Kontak sudah bilang MINAT — bantu ia memutuskan: sekali bayar Rp 500rb selamanya, bayar QRIS/transfer, lisensi aktif < 1 jam, pasang didampingi. Tanya kapan mau mulai coba.'];
  }
  const hari = hariSejak(k.last_contact_at);
  if ((Number(k.sent_count) || 0) > 0 || ['terkirim', 'bales'].includes(k.status)) {
    return ['FOLLOW-UP', `Kontak sudah pernah dihubungi${hari != null ? ` ${hari} hari lalu` : ''} — buka ringan tanpa kagep, ingatkan sekilas, lalu bawa SATU sudut manfaat baru, tutup satu pertanyaan.`];
  }
  return ['PERKENALAN', 'Kontak belum pernah dihubungi — perkenalkan diri singkat, satu sudut manfaat utama, CTA minta izin kirim link coba gratis.'];
}

// ── Prompt dasar ──────────────────────────────────────────────────────────────
function systemPrompt() {
  return `Kamu SPESIALIS marketing WhatsApp untuk Mesin Kasir Solo (kasirsolo.com), bisnis aplikasi kasir UMKM Indonesia.\n${PRODUK}${GAYA}`;
}

function dataKontak(k) {
  const bagian = [`nama="${k.nama}" (sapaan: "${sapaNama(k.nama)}")`, `kategori bisnis="${k.kategori || 'usaha kecil'}"`];
  if (k.alamat) bagian.push(`alamat="${k.alamat}"`);
  if (k.catatan) bagian.push(`catatan="${k.catatan}"`);
  return `Data kontak: ${bagian.join(', ')}.`;
}

// ── Validasi mutu draft ───────────────────────────────────────────────────────
/**
 * Cek mutu satu draft pesan. Kembalikan { ok, alasan } — alasan = rangkuman
 * pelanggaran yang terdeteksi (null bila lolos). Aturan:
 *  - tanpa placeholder [ini]/{ini}/<ini> (template belum terisi)
 *  - tidak kosong, panjang 20-700 karakter
 *  - tanpa pemisah '---' / '===' (bocoran parsing varian/prompt)
 *  - wajib menyapa "Kak" ATAU sapaan nama kontak (param sapa)
 */
export function validasiDraft(isi, sapa) {
  const teks = String(isi || '').trim();
  const pelanggaran = [];
  if (!teks) {
    pelanggaran.push('draft kosong');
  } else {
    if (teks.length < 20) pelanggaran.push(`terlalu pendek (${teks.length} < 20 karakter)`);
    if (teks.length > 700) pelanggaran.push(`terlalu panjang (${teks.length} > 700 karakter)`);
    const ph = teks.match(/[\[{<][a-zA-Z_ ]{2,20}[\]}>]/);
    if (ph) pelanggaran.push(`masih ada placeholder "${ph[0]}" — tulis langsung nilainya`);
    if (teks.includes('---') || teks.includes('===')) pelanggaran.push('ada pemisah "---"/"===" bocoran parsing');
    const s = String(sapa || '').trim();
    const sapaanAda = /kak/i.test(teks)
      || (!!s && s.toLowerCase() !== 'kak' && teks.toLowerCase().includes(s.toLowerCase()));
    if (!sapaanAda) pelanggaran.push(`tanpa sapaan "Kak" / nama "${s || '?'}"`);
  }
  return { ok: !pelanggaran.length, alasan: pelanggaran.join('; ') || null };
}

// ── Belajar dari review owner (few-shot) ──────────────────────────────────────
const CONTOH_POTONG = 200; // isi contoh dipotong — prompt tetap hemat

/**
 * Kumpulkan contoh draft yang SUDAH direview owner: yang ditolak (beserta
 * alasannya) sebagai pola yang harus dihindari, yang disetujui sebagai acuan
 * gaya. Fetch gagal → string kosong (abaikan diam, jangan gagalkan task).
 */
async function muatContohReview(sbFetch) {
  if (!sbFetch) return '';
  try {
    const potong = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, CONTOH_POTONG);
    const [tolak, oke] = await Promise.all([
      sbFetch('/rest/v1/agent_outputs?select=isi,review_note&jenis=eq.draft_wa&status=eq.rejected&review_note=not.is.null&order=reviewed_at.desc&limit=4'),
      sbFetch('/rest/v1/agent_outputs?select=isi&jenis=eq.draft_wa&status=eq.approved&order=reviewed_at.desc&limit=2'),
    ]);
    const baris = [];
    if (Array.isArray(tolak) && tolak.length) {
      baris.push('CONTOH DRAFT YANG DITOLAK OWNER — JANGAN ulangi pola serupa:');
      for (const t of tolak) baris.push(`- ${potong(t.isi)} (Alasan: ${potong(t.review_note)})`);
    }
    if (Array.isArray(oke) && oke.length) {
      baris.push('CONTOH GAYA YANG DISETUJUI OWNER:');
      for (const t of oke) baris.push(`- ${potong(t.isi)}`);
    }
    return baris.join('\n');
  } catch {
    return ''; // review owner tidak tersedia → lanjut tanpa contoh
  }
}

// ── Konfigurasi cloud (Control → Agent) ──────────────────────────────────────
// settings.agent_config = nilai global; settings.agents = daftar profil agent
// (id/nama/target/model/arahan/variasi/aktif) yang dibuat pemilik di Control.
let _konfigCache = null; // { at, data } — TTL 60 dtk, senada pola salt license.js
async function bacaKonfig(sbFetch) {
  try {
    if (_konfigCache && Date.now() - _konfigCache.at > 60_000) return _konfigCache.data;
    const rows = await sbFetch('/rest/v1/settings?key=in.(agent_config,agents)&select=key,value');
    const pick = (k) => (Array.isArray(rows) ? rows.find((r) => r.key === k)?.value : null) || {};
    // settings.agents menyimpan ARRAY profil langsung (bisa juga dibungkus {agents})
    const rawAgents = pick('agents');
    const data = { ...pick('agent_config'), agents: Array.isArray(rawAgents) ? rawAgents : (rawAgents?.agents || []) };
    _konfigCache = { at: Date.now(), data };
    return data;
  } catch {
    return _konfigCache?.data || { agents: [] }; // konfigurasi tak tersedia → nilai baku handler
  }
}

/** Profil agent milik task (payload.agent_id) — null bila tak dikenal */
const profilAgent = (konfig, task) =>
  (konfig.agents || []).find((a) => a.id === task.payload?.agent_id) || null;

// ── Tipe: draft_wa ────────────────────────────────────────────────────────────
async function handlerDraft({ task, callAI, contoh, konfig, ag }) {
  const k = task.payload?.kontak || {};
  if (!k.nama) throw new Error('payload.kontak.nama wajib ada');
  const arahan = task.payload?.arahan || ag?.arahan || konfig.arahanGlobal || '';
  const nVar = Math.min(3, Math.max(1, parseInt(task.payload?.variasi, 10) || parseInt(ag?.variasi, 10) || parseInt(konfig.variasi, 10) || 1));
  const sapa = sapaNama(k.nama);
  const [fase, arah] = faseKonteks(k);

  const user = [
    `Buatkan ${nVar > 1 ? `${nVar} DRAFT ALTERNATIF pesan WA — masing-masing sudut/kalimat pembuka BENAR-BENAR berbeda (bukan sekadar ganti kata). Pisahkan tiap draft dengan satu baris berisi tepat: ===V===` : '1 draft pesan WA'}.`,
    dataKontak(k),
    hookKategori(k.kategori),
    relasiKontak(k),
    `Fase pesan: ${fase}. ${arah}`,
    arahan ? `Arahan tambahan dari boss: ${arahan}` : '',
    contoh,
  ].filter(Boolean).join('\n');

  const { varian, model } = await buatDraftTervalidasi({
    callAI,
    messages: [
      { role: 'system', content: systemPrompt() },
      { role: 'user', content: user },
    ],
    temperature: 0.85,
    maxTokens: 700,
    sapa,
    nVar,
    model: ag?.model || konfig.model,
  });

  return varian.map((isi, i) => ({
    judul: nVar > 1 ? `Draft WA ${['A', 'B', 'C'][i] || 'A'} — ${sapa}` : `Draft WA — ${sapa}`,
    isi,
    model,
  }));
}

/** Pisahkan varian ===V=== ; gagal parse → 1 varian utuh (fallback aman) */
function splitVarian(t) {
  const bersih = (s) => s.trim().replace(/^["“]+|["”]+$/g, '').replace(/^(draft|varian)\s+[abc][:.]\s*/i, '').trim();
  const parts = t.split(/^\s*={2,}V={2,}\s*$/m).map(bersih).filter(Boolean);
  return parts.length ? parts : [bersih(t)];
}

// ── Panggil AI + validasi mutu (+ satu kali koreksi) ──────────────────────────
/**
 * callAI → splitVarian → validasiDraft. Bila ada varian invalid, ulang SATU
 * kali dengan pesan koreksi spesifik (sebut pelanggaran yang terdeteksi).
 * Masih invalid → throw NON-RETRYABLE: kualitas tak akan membaik dengan retry
 * mekanis, biarkan seeder/review yang perbaiki arahnya.
 */
async function buatDraftTervalidasi({ callAI, messages, temperature, maxTokens, sapa, nVar, model }) {
  const label = (i) => ['A', 'B', 'C'][i] || String(i + 1);
  const jalankan = async (msgs) => {
    const { text, model: real } = await callAI({ model: model || 'auto/best-fast', messages: msgs, temperature, maxTokens });
    return { text, model: real, varian: splitVarian(text.trim()).slice(0, nVar) };
  };

  const pertama = await jalankan(messages);
  let cek = pertama.varian.map((v) => validasiDraft(v, sapa));
  if (cek.every((c) => c.ok)) return pertama;

  const rincian = pertama.varian.map((v, i) => `- Varian ${label(i)}: ${cek[i].alasan}`).join('\n');
  const koreksi = [
    'Draft kamu GAGAL validasi mutu. Pelanggaran yang terdeteksi:',
    rincian,
    `Tulis ulang${nVar > 1 ? ` ${nVar} draft (pisahkan dengan satu baris tepat: ===V===)` : ''} yang lolos SEMUA aturan berikut:`,
    '- Tanpa placeholder seperti [nama] / {nama} — tulis langsung nilainya.',
    '- Panjang 20-700 karakter, tanpa pemisah "---"/"===", tanpa kata pengantar/kutip pembungkus.',
    `- Wajib menyapa "Kak" atau nama "${sapa}".`,
  ].join('\n');

  const ulang = await jalankan([...messages,
    { role: 'assistant', content: pertama.text },
    { role: 'user', content: koreksi },
  ]);
  cek = ulang.varian.map((v) => validasiDraft(v, sapa));
  if (cek.every((c) => c.ok)) return ulang;

  const gagal = ulang.varian.map((v, i) => `varian ${label(i)}: ${cek[i].alasan || '-'}`).join('; ');
  throw new Error(`[NON-RETRYABLE] draft_gagal_validasi: ${gagal}`);
}

// ── Tipe: followup_wa ─────────────────────────────────────────────────────────
async function handlerFollowup({ task, callAI, contoh, konfig, ag }) {
  const p = task.payload || {};
  const k = p.kontak || {};
  if (!k.nama) throw new Error('payload.kontak.nama wajib ada');
  const sapa = sapaNama(k.nama);
  const hari = p.hari_lalu ?? hariSejak(k.last_contact_at);
  const prev = String(p.pesan_sebelumnya || '').trim().slice(0, 400);
  const arahan = p.arahan || ag?.arahan || konfig.arahanGlobal || '';

  const user = [
    'Buatkan 1 draft pesan FOLLOW-UP WhatsApp (pesan lanjutan setelah pesan pertama diabaikan/dibalas singkat).',
    dataKontak(k),
    hookKategori(k.kategori),
    relasiKontak(k),
    prev
      ? `Pesan sebelumnya yang sudah terkirim${hari != null ? ` ${hari} hari lalu` : ''}:\n---\n${prev}\n---`
      : `Kontak sudah menerima pesan pertama${hari != null ? ` ${hari} hari lalu` : ''} (isi pesannya tidak tersedia).`,
    'Aturan follow-up (WAJIB):',
    '- JANGAN menyalin/mengulang pitch pesan sebelumnya.',
    `- Pilih SATU sudut BARU: salah satu jawaban keberatan umum di bawah, fitur lain, atau hitung-hitungan harga.${arahan ? `\n- Arahan tambahan dari boss: ${arahan}` : ''}`,
    '- Lebih PENDEK dari pesan pertama (maksimal 4 baris), santai, tidak menuntut balasan.',
    '- Tutup dengan SATU pertanyaan ringan yang gampang dijawab.',
    OBJECTION,
    contoh,
  ].filter(Boolean).join('\n');

  const { varian, model } = await buatDraftTervalidasi({
    callAI,
    messages: [
      { role: 'system', content: systemPrompt() },
      { role: 'user', content: user },
    ],
    temperature: 0.8,
    maxTokens: 400,
    sapa,
    nVar: 1,
    model: ag?.model || konfig.model,
  });

  return [{ judul: `Follow-up — ${sapa}`, isi: varian[0], model }];
}

// ── Dispatcher ────────────────────────────────────────────────────────────────
const TIPE = {
  draft_wa: handlerDraft,
  followup_wa: handlerFollowup,
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function jalankanMarketing({ task, callAI, putOutput, sbFetch }) {
  const tipe = TIPE[task.tipe] ? task.tipe : 'draft_wa';

  // ── Re-fetch kontak FRESH — snapshot di payload bisa basi (nama/status berubah) ──
  let kontakFresh = null;
  const kid = task.payload?.kontak_id || '';
  if (kid && UUID_RE.test(kid) && sbFetch) {
    try {
      const rows = await sbFetch(
        `/rest/v1/outreach_contacts?select=nama,kategori,status,sent_count,alamat,catatan,last_contact_at,source&id=eq.${kid}&limit=1`,
      );
      if (Array.isArray(rows) && rows[0]) {
        kontakFresh = rows[0];
        task = { ...task, payload: { ...task.payload, kontak: kontakFresh } };
      }
    } catch { /* fetch gagal → fallback ke snapshot payload.kontak */ }
  }

  const k = task.payload?.kontak || {};
  if (!k.nama) throw new Error('payload.kontak.nama wajib ada');
  if (['mati', 'optout'].includes(k.status)) {
    // Kontak di luar outreach — hentikan permanen, jangan buang panggilan AI
    throw new Error(`[NON-RETRYABLE] kontak mati/optout (status="${k.status}"${kid ? `, kontak_id=${kid}` : ''})`);
  }

  // Contoh gaya dari review owner (few-shot) — gagal fetch diabaikan diam
  const contoh = await muatContohReview(sbFetch);
  // Konfigurasi cloud (arahan global/model/variasi + daftar agent) — Control → Agent
  const konfig = await bacaKonfig(sbFetch);
  const ag = profilAgent(konfig, task);
  if (ag && ag.aktif === false) {
    // Agent dinonaktifkan pemilik — tugas pending miliknya tidak dieksekusi
    throw new Error(`[NON-RETRYABLE] agent nonaktif: ${ag.nama || ag.id}`);
  }

  const drafts = await TIPE[tipe]({ task, callAI, contoh, konfig, ag });
  for (const d of drafts) {
    await putOutput({
      task_id: task.id,
      agent: 'marketing',
      jenis: 'draft_wa',
      ref_table: 'outreach_contacts',
      ref_id: task.payload?.kontak_id || null,
      judul: d.judul,
      isi: d.isi,
      model: d.model,
      status: 'draft',
    });
  }
  // Data fresh ikut ke result task agar terlacak (snapshot vs fresh)
  return {
    ok: true,
    tipe,
    jumlah: drafts.length,
    sumber_kontak: kontakFresh ? 'fresh' : 'snapshot',
    kontak_fresh: kontakFresh,
  };
}
