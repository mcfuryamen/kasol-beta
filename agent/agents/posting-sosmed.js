/**
 * Agent Posting Sosmed — agent/agents/posting-sosmed.js
 * =============================================================================
 * SPESIALIS caption post Facebook (Fase 1 fitur Sosmed di Control).
 * Dijalankan on-demand dari modul Sosmed (sheet Buat Post → 🤖 Generate).
 *
 * Tugas (task.tipe):
 *  - 'buat_caption' : caption post siap-tayang sesuai topik/gaya.
 *
 * Payload (task.payload):
 *  {
 *    topik,        // wajib — angle/berita/promo yang mau diangkat
 *    produk,       // opsional — produk yang disorot (kaki5/laundry/rosok/…)
 *    gaya,         // 'edukasi' | 'promo' | 'umum' (default 'umum')
 *    platform,     // 'facebook' (fase 1)
 *    jumlah,       // jumlah varian (default 2, max 3)
 *    link          // opsional — link CTA yang boleh disebut
 *  }
 *
 * Aturan konten (pola marketing 70/30): kebanyakan value dulu baru CTA.
 * Hasil: agent_outputs jenis='posting_sosmed' status='draft' — direview &
 * disimpan ke social_posts lewat UI (human-in-the-loop).
 */

const GAYA_PROMPTS = {
  edukasi: `Fokus EDUKASI/Bermanfaat: bagikan tips, insight, atau mini-tutorial yang benar2 berguna bagi pemilik usaha. CTA hanya 1 kalimat ringan di akhir (bukan jualan keras).`,
  promo: `Fokus PROMO: sampaikan penawaran/fitur dengan bukti konkret (angka, contoh kasus). CTA jelas (coba/daftar/cek link). Tetap santai, jangan seperti iklan korporat.`,
  umum: `Fokus CERITA: sudut pandang sehari-hari pemilik usaha, observasi, atau kabar produk. Pertengahan antara edukasi dan promo.`,
};

function buildPrompt(payload) {
  const gaya = GAYA_PROMPTS[payload.gaya] || GAYA_PROMPTS.umum;
  const jumlah = Math.min(payload.jumlah || 2, 3);
  const link = payload.link ? `- Link yang BOLEH disebut di CTA: ${payload.link}` : `- Tidak ada link — CTA cukup ajakan umum (komentar/DM).`;
  return `Tulis ${jumlah} varian caption post FACEBOOK (bahasa Indonesia) untuk Kasir Solo —
produk: aplikasi kasir & manajemen usaha UMKM (kaki5 = kasir jualan kaki lima/UMKM, laundry = manajemen laundry, rosok = pengepul, minimarket, tpa, dll).

Topik/angle: ${payload.topik}
${payload.produk ? `Sorot produk: ${payload.produk}` : 'Boleh pilih produk yang paling nyambung dgn topik.'}
Gaya: ${gaya}

ATURAN KETAT:
- Maks ±120 kata per caption. Paragraf pendek, nyaman dibaca di HP.
- 1-3 emoji yang relevan (jangan bertabur).
- 3-5 hashtag di baris terakhir, relevan & realistis (campuran besar+spesifik).
- Plain text — DILARANG markdown (**, ##, \`\`\`) atau header seperti "Varian 1:".
- ${link}
- Antara varian WAJIB beda angle pembuka (jangan parafraze yang sama).

Pisahkan antar varian dengan baris berisi '---' saja. HANYA caption, tanpa penjelasan.`;
}

export async function jalankanPostingSosmed({ task, callAI, putOutput }) {
  const payload = task.payload || {};
  const topik = String(payload.topik || '').trim();
  if (!topik) throw new Error('[NON-RETRYABLE] payload.topik missing');

  const model = payload.model || '';
  const jumlah = Math.min(payload.jumlah || 2, 3);
  const platform = payload.platform || 'facebook';

  const systemPrompt = `Kamu social media writer untuk Kasir Solo (aplikasi kasir & manajemen usaha UMKM Indonesia).
Target pembaca: pemilik warung/laundry/toko/kedai yang teknologinya sederhana — bahasanya membumi, tidak korporat, tidak bombastis.
Output HANYA caption post, plain text, tanpa markdown dan tanpa penjelasan.`;

  try {
    const result = await callAI({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: buildPrompt({ ...payload, jumlah }) },
      ],
    });

    const fullText = (result?.text || '').trim();
    if (!fullText) throw new Error('[NON-RETRYABLE] AI returned empty');

    const varians = fullText.split(/\n?---\n?/).map((v) => v.trim()).filter((v) => v.length > 0);
    if (!varians.length) throw new Error('[NON-RETRYABLE] no varian extracted');

    let written = 0;
    for (let idx = 0; idx < varians.length; idx++) {
      const text = varians[idx];
      if (text.length > 900) throw new Error('[NON-RETRYABLE] caption terlalu panjang (>900 char)');
      if (text.includes('```') || /\*\*/.test(text) || text.includes('##')) {
        throw new Error('[NON-RETRYABLE] caption punya markdown');
      }
      const varLabel = varians.length > 1 && idx > 0 ? ` ${String.fromCharCode(65 + idx)}` : '';
      await putOutput({
        task_id: task.id,
        agent: task.agent, // kolom NOT NULL — pola draft-klien
        judul: `Post${varLabel} — ${topik.slice(0, 60)}`,
        jenis: 'posting_sosmed',
        isi: text,
        model,
        status: 'draft',
      });
      written++;
    }
    return { ok: true, platform, varian_count: written };
  } catch (e) {
    if (String(e.message || '').startsWith('[NON-RETRYABLE]')) throw e;
    throw new Error(`posting_sosmed: ${e.message}`);
  }
}
