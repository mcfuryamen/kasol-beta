/**
 * Agent Draft Klien — agent/agents/draft-klien.js
 * =============================================================================
 * SPESIALIS draft pesan per klien — sesuai status pipeline & konteks bisnis.
 * Dijalankan on-demand dari Control Center modul Klien (tidak batch).
 *
 * Tugas (task.tipe):
 *  - 'draft_pesan' : draft pesan follow-up/penawaran sesuai status klien
 *                    (baru → hubungi, dihubungi → tawarkan, dll).
 *
 * Payload (task.payload):
 *  {
 *    client_id,           // ID klien di tabel clients
 *    nama_usaha,          // Nama usaha (fallback bila fetch fresh gagal)
 *    status,              // Status pipeline (baru, dihubungi, tertarik, dll)
 *    app_type,            // Jenis app (kaki5, retail, dll)
 *    persona,             // Persona agent dari agent_config
 *    model,               // Model AI yg dipilih
 *    variasi              // Jumlah varian (default 2)
 *  }
 *
 * Alur eksekusi (jalankanDraftKlien):
 *  1. Resolve status → tentukan jenis pesan (hubungi, tawarkan, follow-up).
 *  2. Fetch klien FRESH (optional — fallback ke payload).
 *  3. callAI dengan prompt kontekstual per status.
 *  4. Validasi draft bersih (no header/footer, plain text).
 *  5. Simpan ke agent_outputs (≥1 baris per varian).
 *
 * Hasil: agent_outputs dengan status='draft', jenis='draft_klien'
 * Konvensi judul: "Draft — [Status] [Nama Usaha]" / "Draft B — [...]"
 */

const PERSONA_PROMPTS = {
  profesional: `Tulis pesan bisnis profesional tapi hangat. Gunakan:
  - Salam pembuka personal dengan nama.
  - Lanjut dengan value proposition singkat (max 1 kalimat).
  - CTA jelas (ajukan meeting/call/demo).
  - Tanda tangan informal (nama saja, jangan title).
  Format: plain text, no markdown, no emoji (kecuali demi clarity).`,
  
  kasual: `Tulis pesan santai, ramah, seperti teman. Gunakan:
  - Salam santai (halo, pagi, gimana kabar).
  - Cerita singkat tentang manfaat (tanpa "produk" — sebut solusi konkret).
  - Emoji 1-2 biji aja untuk warna.
  - Ajak respons casual (coba? mau tahu lebih?).
  Format: plain text, natural rhythm, seperti chat WhatsApp.`,
  
  manajerial: `Tulis fokus ROI/efisiensi. Gunakan:
  - Salam singkat.
  - Lead dengan angka/metrik (berapa % efisiensi, berapa jam hemat).
  - Explain the mechanic (gimana cara kerjanya).
  - Offer next step yang jelas.
  Format: structured, data-driven, 1 call-to-action.`
};

const STATUS_CONTEXT = {
  baru: {
    judul: 'Hubungi',
    prompt: `Tujuan: PERKENALAN + INTEREST.
    Klien baru, belum ada kontak sebelumnya.
    Tulis: "Halo [Nama], saya [Nama Sender]. Kami [Brief Kasir Solo]. Saya pikir [Benefit singkat untuk bisnis mereka]. Interested? Mari kita chat. Kapan elo siap? 👋"`
  },
  dihubungi: {
    judul: 'Tawarkan',
    prompt: `Tujuan: DETAIL PENAWARAN + SOCIAL PROOF.
    Sudah ada kontak awal, sekarang perlu detail.
    Tulis: detail singkat fitur yang paling relevan untuk [app_type] mereka + 1-2 success story.
    Closing: "Mau saya demo langsung? Bisa hari ini/besok?""`
  },
  tertarik: {
    judul: 'Verifikasi',
    prompt: `Tujuan: KONFIRMASI + URGENCY.
    Klien tertarik, perlu push ringan untuk commit.
    Tulis: "Great! Untuk mulai, butuh [hal konkret: verifikasi data/info bisnis/doc]. Apa ada kendala? Saya siap bantu ASAP."`
  },
  aktif: {
    judul: 'Feedback',
    prompt: `Tujuan: RETENTION + EXPANSION.
    Klien aktif/sudah pakai, cek puas + offer upgrade/feature baru.
    Tulis: "Halo [Nama], apa kabar? Setelah [waktu] pakai Kasir Solo, feedback gimana? Ada feature yang kurang? Kami baru ada [feature baru] cocok untuk [use case mereka]."`
  }
};

/**
 * Main handler — dipanggil oleh runner.mjs
 */
export async function jalankanDraftKlien({ task, callAI, putOutput, sbFetch }) {
  const payload = task.payload || {};
  const clientId = payload.client_id;
  const namaUsaha = payload.nama_usaha || 'Klien';
  const status = payload.status || 'baru';
  const appType = payload.app_type || 'retail';
  const persona = payload.persona || 'profesional';
  // Model kosong → callAI pilih default provider aktif (multi-provider 2026-10-01)
  const model = payload.model || '';
  const variasi = Math.min(payload.variasi || 2, 3); // max 3 varian

  if (!clientId) throw new Error('[NON-RETRYABLE] client_id missing');
  if (!STATUS_CONTEXT[status]) throw new Error(`[NON-RETRYABLE] unknown status: ${status}`);

  const ctx = STATUS_CONTEXT[status];
  const personaPrompt = PERSONA_PROMPTS[persona] || PERSONA_PROMPTS.profesional;

  // Buat prompt kontekstual
  const systemPrompt = `Kamu adalah ${persona} assistant untuk Kasir Solo (pos system + crm).
Tugas: draft pesan WhatsApp singkat (max 3-4 baris) sesuai instruksi di bawah.
${personaPrompt}
PENTING: output HANYA pesan, no header/footer/explanations. Plain text saja.`;

  const userPrompt = `${ctx.prompt}

Konteks:
- Nama usaha: ${namaUsaha}
- Jenis app cocok: ${appType}
- Status: ${status}

Tulis ${variasi} varian draft — pisah dengan '---' antar varian.
HANYA pesan saja, jangan ada "Varian 1:" atau penjelasan.`;

  try {
    // Call AI dengan format messages (OpenAI-compatible)
    const result = await callAI({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });

    const fullText = (result?.text || '').trim();
    if (!fullText) throw new Error('[NON-RETRYABLE] AI returned empty');

    // Split varian
    const varians = fullText.split('---').map((v) => v.trim()).filter((v) => v.length > 0);
    if (varians.length === 0) throw new Error('[NON-RETRYABLE] no varian extracted');

    // Validate & write outputs
    for (let idx = 0; idx < varians.length; idx++) {
      const text = varians[idx];
      
      // Validate: plain text, no markdown, singkat
      if (text.length > 500) throw new Error('[NON-RETRYABLE] draft terlalu panjang');
      if (text.includes('```') || text.includes('**') || text.includes('##')) {
        throw new Error('[NON-RETRYABLE] draft punya markdown');
      }

      const varLabel = varians.length > 1 && idx > 0 ? ` ${String.fromCharCode(65 + idx)}` : '';
      const judul = `Draft${varLabel} — ${ctx.judul} ${namaUsaha}`;

      await putOutput({
        task_id: task.id,
        agent: task.agent, // kolom NOT NULL — dulu null → INSERT selalu 23502
        ref_id: clientId,
        judul,
        jenis: 'draft_klien',
        isi: text,
        model,
        status: 'draft'
      });
    }

    return { ok: true, varian_count: varians.length };
  } catch (e) {
    if (String(e.message || '').startsWith('[NON-RETRYABLE]')) throw e;
    throw new Error(`Draft validation failed: ${e.message}`);
  }
}
