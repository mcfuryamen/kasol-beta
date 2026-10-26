/**
 * control/api/_ai-variasi-core.js — inti logika "variasikan materi pakai AI"
 * =============================================================================
 * Satu sumber untuk dua pintu:
 *   • api/ai-variasi.js  (Vercel serverless)
 *   • server.js           (mirror dev)
 *
 * Alur:
 *   1. Ambil materi sumber dari `content_materials` (kalau ada material_id).
 *   2. Susun prompt (fakta produk + aturan gaya + level komentar).
 *   3. Panggil provider AI (OpenAI-compatible) via _ai-core.js.
 *   4. Parse JSON → normalisasi → [{ judul, isi }].
 *
 * Hasil TIDAK langsung disimpan — dikembalikan ke browser supaya user yang
 * memilih mana yang mau dipakai. Penyimpanan tetap via /api/rest (satu jalur).
 * =============================================================================
 */
import { chatOnce, extractJson } from './_ai-core.js';

// Fakta produk — WAJIB akurat. Sumber: marketing-kit + agent/agents/marketing.js.
const PRODUK = `Fakta produk (WAJIB akurat — jangan mengarang fitur/harga/promo lain):
- Produk: aplikasi kasir "Kasir Solo" (Kaki5) — jalan di HP, dipasang seperti aplikasi (PWA), ringan.
- Offline-first: data jualan tersimpan di HP sendiri, tetap jalan tanpa internet.
- Fitur inti: catat penjualan, buka/tutup kas harian, catat pengeluaran & pemasukan, laporan untung harian/mingguan, cetak struk (printer Bluetooth), backup data.
- Harga: SEKALI BAYAR Rp 500.000 untuk SELAMANYA — tanpa langganan bulanan/tahunan.
- Bisa dicoba gratis dulu (kuota transaksi gratis tiap bulan, tanpa kartu kredit).
- Link: https://kaki5.kasirsolo.com
`;

const GAYA_UMUM = `Gaya bahasa:
- Bahasa Indonesia santai, seperti ngobrol. BUKAN gaya korporat/brosur.
- Maksimal 2-3 kalimat (komentar: 1 kalimat). Emoji 0-2 saja, jangan di tiap kata.
- Fokus SATU sudut manfaat, bukan daftar fitur.
- DILARANG placeholder (mis. [nama], {nama}, [URL]) — tulis langsung.
- DILARANG klaim di luar fakta produk (tidak ada diskon, tidak ada "//", garansi, testimonial palsu).
- Variasikan cara membuka antar variasi — jangan semua mulai sama.
- Jangan mengulang kalimat utuh dari teks dasar; ubah angle/hook-nya.
`;

const GAYA_CAPTION = {
  edukasi: 'Gaya: edukasi. Angkat satu masalah nyata warung (catat manual, tutup buku 3 jam, untung ilang diam-diam) lalu kasih solusi singkat. Tidak hard selling.',
  promo: 'Gaya: promo. Tawarkan akses gratis / tanpa langganan, lalu ajak coba. Hard selling ringan, boleh sebut sekali saja bahwa Sekali bayar.',
  interaktif: 'Gaya: interaktif. Buka dengan pertanyaan ringan yang bikin orang mau komen. JANGAN todong jualan di dalam pertanyaan — jualan maksimal 1 kalimat di akhir.',
  'build-in-public': 'Gaya: build in public. Ceritakan proses bikin aplikasi kasir ini dengan jujur & manusiawi (kesulitan, belajar yang pelan), lalu sambung ke produk. Nuansa "jujur, bukan yang manis".',
  cerita: 'Gaya: cerita. Momen sehari-hari yang relate dengan pedagang kecil, lalu sambung ke solusi. Hangat, personal.',
};

const LEVEL_KOMENTAR = {
  A: 'Level A (umpan) — paling sering dipakai. TIDAK boleh ada unsur jualan sama sekali: tidak boleh menyebut aplikasi, tidak boleh link. Hanya amus, pujian spesifik, empati, atau pertanyaan ringan tentang usaha mereka.',
  B: 'Level B (soft) — boleh menyebut aplikasi kasir / cara catat jualan di HP, TIDAK boleh menaruh link. Penekanan pada masalah mereka, solusi menyusul singkat.',
  C: 'Level C (pitch) — boleh menyebut aplikasi kasir DAN link https://kaki5.kasirsolo.com. Ini hanya dipakai kalau orangnya memang nanya / minta rekomendasi.',
  D: 'Level D (DM hangat) — format pesan DM: sapa "Kak", tawarkan link, lalu ajak satu pertanyaan ringan (mis. "Kakak jualan apa?").',
};

function buildPrompt({ jenis, gaya, level, platform, jumlah, teksDasar, judulDasar }) {
  const head = `Kamu SPESIALIS konten media sosial untuk Kasir Solo (Kasir Solo / Kaki5) — aplikasi kasir untuk UMKM Indonesia.\n\n${PRODUK}\n${GAYA_UMUM}\n`;
  let body = '';

  if (jenis === 'komentar') {
    const lvl = (level || 'A').toUpperCase();
    body = `${LEVEL_KOMENTAR[lvl] || LEVEL_KOMENTAR.A}\n`;
    if (lvl === 'A') body += '- Satu kalimat, casual, kayak orang yang nge-komentar di kolom komen.\n';
    body += `- Platform tujuan: ${platform || 'komentar Facebook'}.\n`;
  } else if (jenis === 'brief') {
    body = `Buat BRIEF VIDEO untuk direkam sendiri (1 video = 1 brief).
Format tiap brief:
Hook (teks 2 detik pertama) | Aksi layar (yang direkam) | VO (yang lo ucapkan) | CTA (yang ditulis di layar) | Durasi.
Aturan: vertikal 9:16, 15-35 detik, rekam layar HP asli, auto-caption di TikTok, jangan sebut fitur yang gak ada.
`;
  } else {
    body = `${GAYA_CAPTION[gaya] || GAYA_CAPTION.edukasi}\n- Platform tujuan: ${platform || 'facebook'}.\n`;
  }

  body += `\nTeks dasar (acuan — buat VARIASI yang angle-nya beda, jangan disalin):\n"${String(teksDasar || '').slice(0, 700)}"\n`;
  if (judulDasar) body += `Judul/rangkuman: ${judulDasar}\n`;

  body += `\nBalas HANYA dengan JSON array berisi ${jumlah} objek. Tiap objek: {"judul": "label angle singkat", "isi": "teksVariasi"}.
Contoh bentuk: [{"judul":"label","isi":"teks Variasi"}]
Jangan ada teks lain di luar JSON.`;
  return head + body;
}

/** Normalisasi hasil model (bisa string atau objek) → [{judul, isi}] */
function normalisasi(arr) {
  const out = [];
  for (const item of Array.isArray(arr) ? arr : []) {
    if (typeof item === 'string' && item.trim()) {
      out.push({ judul: '', isi: item.trim() });
    } else if (item && typeof item === 'object') {
      const isi = String(item.isi ?? item.teks ?? item.text ?? item.caption ?? item.komentar ?? '').trim();
      if (isi) out.push({ judul: String(item.judul ?? item.angle ?? '').trim(), isi });
    }
  }
  return out;
}

export function makeAiVariasiCore({ supabaseUrl, serviceKey }) {
  const base = String(supabaseUrl || '').replace(/\/$/, '');

  async function readMaterial(id) {
    const res = await fetch(`${base}/rest/v1/content_materials?id=eq.${encodeURIComponent(id)}&select=id,judul,isi,kategori,platform,tag`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    const rows = await res.json();
    return Array.isArray(rows) ? rows[0] || null : null;
  }

  return {
    async handle(body) {
      if (!supabaseUrl || !serviceKey) {
        return { status: 500, json: { ok: false, error: 'server_not_configured' } };
      }

      // 1) materi sumber
      let teksDasar = String(body.teks || '').trim();
      let judulDasar = String(body.judul || '').trim();
      let kategori = String(body.kategori || '');
      let platformAsal = '';
      if (body.material_id) {
        try {
          const m = await readMaterial(String(body.material_id));
          if (!m) return { status: 404, json: { ok: false, error: 'material_not_found' } };
          teksDasar = String(m.isi || '');
          judulDasar = String(m.judul || '');
          kategori = String(m.kategori || '');
          platformAsal = String(m.platform || '');
        } catch (e) {
          return { status: 500, json: { ok: false, error: 'material_read_failed', message: String(e?.message || e).slice(0, 200) } };
        }
      }
      if (!teksDasar) {
        return { status: 400, json: { ok: false, error: 'missing_teks', message: 'Pilih materi atau isi teks dasar dulu.' } };
      }

      // 2) jenis default mengikuti kategori materi
      let jenis = String(body.jenis || '').trim();
      if (!jenis) {
        if (kategori === 'variasi' || kategori === 'template') jenis = 'komentar';
        else if (kategori === 'brief_video') jenis = 'brief';
        else jenis = 'caption';
      }
      const jumlah = Math.max(1, Math.min(8, Number(body.jumlah) || 3));
      const platform = String(body.platform || platformAsal || '').trim();

      const prompt = buildPrompt({
        jenis, gaya: String(body.gaya || '').trim(), level: String(body.level || 'A').trim(),
        platform, jumlah, teksDasar, judulDasar,
      });

      // 3) panggil AI
      const out = await chatOnce({
        supabaseUrl, serviceKey,
        providerId: body.provider_id ? String(body.provider_id) : undefined,
        modelId: body.model ? String(body.model) : undefined,
        system: 'Kamu penulis konten media sosial Indonesia yang paham UMKM. Selalu balas JSON valid, tanpa penjelasan tambahan.',
        prompt,
        temperature: 0.9,
        maxTokens: 1200,
      });
      if (!out.ok) {
        return { status: 200, json: { ok: false, error: out.error, message: out.message || 'Gagal memanggil AI', ms: out.ms } };
      }

      // 4) parse + normalisasi
      const parsed = extractJson(out.text);
      if (!parsed) {
        return {
          status: 200,
          json: {
            ok: false, error: 'parse_failed',
            message: 'Balasan AI tidak bisa dibaca sebagai JSON. Coba lagi atau ganti model.',
            raw: String(out.text).slice(0, 400), ms: out.ms,
          },
        };
      }
      const variasi = normalisasi(parsed).slice(0, jumlah);
      if (!variasi.length) {
        return {
          status: 200,
          json: {
            ok: false, error: 'empty_variations',
            message: 'AI tidak menghasilkan variasi yang bisa dipakai.',
            raw: String(out.text).slice(0, 400), ms: out.ms,
          },
        };
      }
      return { status: 200, json: { ok: true, variasi, jenis, model: out.model, provider: out.provider, ms: out.ms } };
    },
  };
}
