/**
 * CRM WhatsApp composer — pesan manual untuk Klien dan Mitra.
 * WhatsApp tetap dibuka lewat deep-link; tidak ada pengiriman otomatis/server-side.
 */

import { escapeHtml, normalizePhone, formatDate } from './utils.js';
import { showToast } from './toast.js';
import { supabaseFetch } from './api.js';

const TEMPLATES = {
  klien: [
    'Halo {nama}, saya dari Mesin Kasir Solo 👋\n\nMau cek kabar {usaha}. Kalau ada kendala aplikasi atau butuh bantuan soal fitur, langsung balas pesan ini ya. Kami siap bantu.',
    'Halo {nama} 😊 Semoga usahanya lancar. Saya dari Mesin Kasir Solo ingin memastikan aplikasi {produk} berjalan baik di {kota}. Ada yang ingin ditanyakan atau dibantu?',
  ],
  mitra: [
    'Halo {nama} 👋 Saya dari Mesin Kasir Solo. Terima kasih sudah bergabung sebagai mitra{kode}. Ada yang bisa kami bantu terkait program referral atau portal mitra?',
    'Halo {nama} 😊 Mau menyapa dan memastikan semuanya lancar sebagai mitra Mesin Kasir Solo. Kalau ada pertanyaan soal kode referral, poin, atau pencairan, silakan kabari ya.',
  ],
};

const CONTEXT_LABEL = { klien: 'Klien', mitra: 'Mitra' };
let current = null;

function fillTemplate(template, data, context = '') {
  const extra = String(context || '').trim().slice(0, 500);
  const result = template
    .replaceAll('{nama}', data.nama || 'Kak')
    .replaceAll('{usaha}', data.usaha || data.nama || 'usaha Kakak')
    .replaceAll('{produk}', data.produk || 'Kasol')
    .replaceAll('{kota}', data.kota || 'tempat Kakak')
    .replaceAll('{kode}', data.kode ? ` dengan kode referral ${data.kode}` : '');
  return extra ? `${result}\n\nCatatan untuk pesan ini: ${extra}` : result;
}

function historyFilter() {
  if (!current) return '';
  const key = current.kind === 'mitra' ? 'partner_id' : 'client_id';
  const id = current.kind === 'mitra' ? current.partnerId : current.clientId;
  return id ? `&${key}=eq.${encodeURIComponent(id)}` : '';
}

async function loadHistory() {
  const host = document.getElementById('crmWhatsAppHistory');
  if (!host) return;
  if (!current?.clientId && !current?.partnerId) {
    host.innerHTML = '<div class="crm-wa-history-empty">Riwayat belum tersedia untuk kontak ini.</div>';
    return;
  }
  host.innerHTML = '<div class="crm-wa-history-loading">⏳ Memuat riwayat pesan…</div>';
  const res = await supabaseFetch(`/rest/v1/crm_whatsapp_messages?select=id,phone_e164,message_text,opened_whatsapp,created_at&order=created_at.desc&limit=50${historyFilter()}`);
  if (!res.ok) {
    host.innerHTML = '<div class="crm-wa-history-error">Riwayat pesan gagal dimuat.</div>';
    return;
  }
  const rows = Array.isArray(res.data) ? res.data : [];
  if (!rows.length) {
    host.innerHTML = '<div class="crm-wa-history-empty">Belum ada pesan yang dibuka dari Control.</div>';
    return;
  }
  host.innerHTML = rows.map((row) => `
    <article class="crm-wa-history-item">
      <div class="crm-wa-history-head">
        <span>${escapeHtml(formatDate(row.created_at))}</span>
        <span class="badge green">${row.opened_whatsapp ? 'Dibuka di WhatsApp' : 'Dicatat'}</span>
      </div>
      <div class="crm-wa-history-phone mono">${escapeHtml(row.phone_e164 || current.phone)}</div>
      <div class="crm-wa-history-text">${escapeHtml(row.message_text || '')}</div>
    </article>`).join('');
}

function renderMessagePanel() {
  const d = current.data;
  const kind = current.kind;
  const label = CONTEXT_LABEL[kind] || 'Kontak';
  return `
    <div class="field">
      <label class="field-label" for="crmWhatsAppContext">Konteks tambahan (opsional)</label>
      <textarea id="crmWhatsAppContext" rows="2" maxlength="500" placeholder="Contoh: tawarkan bantuan setup printer">${escapeHtml(current.context || '')}</textarea>
      <div class="crm-wa-label-row">
        <label class="field-label" for="crmWhatsAppText">Pesan WhatsApp <span class="oc-note-hint" id="crmWhatsAppHint">Template ${label.toLowerCase()} — varian 1</span></label>
        <div class="oc-wa-tools">
          <button type="button" class="btn btn-outline btn-sm crm-wa-icon-btn" id="crmWhatsAppRegenerate" aria-label="Generate ulang" title="Generate ulang">↻</button>
          <button type="button" class="btn btn-ghost btn-sm crm-wa-icon-btn" id="crmWhatsAppReset" aria-label="Kembalikan" title="Kembalikan">↺</button>
        </div>
      </div>
      <textarea id="crmWhatsAppText" rows="7" placeholder="Tulis pesan…">${escapeHtml(fillTemplate(TEMPLATES[kind][0], d, current.context))}</textarea>
      <p class="oc-wa-note">WhatsApp terbuka dengan pesan sudah terisi — tinggal tekan kirim di sana.</p>
    </div>
    <div class="btn-block-row">
      <button type="button" class="btn btn-outline" id="crmWhatsAppClose">Tutup</button>
      <button type="button" class="btn btn-primary" id="crmWhatsAppSend">💬 Kirim via WhatsApp</button>
    </div>`;
}

function render() {
  const body = document.getElementById('crmWhatsAppBody');
  if (!body || !current) return;
  const d = current.data;
  const kind = current.kind;
  const label = CONTEXT_LABEL[kind] || 'Kontak';
  body.innerHTML = `
    <div class="oc-sh">
      <div class="oc-ava oc-ava--lg oc-ava--teal" aria-hidden="true">${escapeHtml((d.nama || '?').slice(0, 2).toUpperCase())}</div>
      <div class="oc-sh-id">
        <div class="oc-sh-name">${escapeHtml(d.nama || 'Kontak')}</div>
        <div class="oc-sub"><span class="mono">${escapeHtml(current.phone)}</span>${d.kota ? ' · ' + escapeHtml(d.kota) : ''}</div>
      </div>
      <span class="badge teal">${escapeHtml(label)}</span>
    </div>
    <div class="content-tabs crm-wa-tabs" role="tablist" aria-label="Konten WhatsApp">
      <button type="button" class="content-tab active" id="crmWaTabMessage" role="tab" aria-selected="true">Pesan</button>
      <button type="button" class="content-tab" id="crmWaTabHistory" role="tab" aria-selected="false">Riwayat pesan</button>
    </div>
    <div id="crmWhatsAppMessagePanel">${renderMessagePanel()}</div>
    <div id="crmWhatsAppHistory" hidden></div>`;

  const ta = document.getElementById('crmWhatsAppText');
  const contextEl = document.getElementById('crmWhatsAppContext');
  contextEl?.addEventListener('input', () => { current.context = contextEl.value.slice(0, 500); });
  ta?.addEventListener('input', () => { current.dirty = true; });
  document.getElementById('crmWhatsAppRegenerate')?.addEventListener('click', () => {
    current.variant = (current.variant + 1) % TEMPLATES[kind].length;
    current.dirty = false;
    ta.value = fillTemplate(TEMPLATES[kind][current.variant], d, current.context);
    document.getElementById('crmWhatsAppHint').textContent = `Template ${label.toLowerCase()} — varian ${current.variant + 1}`;
  });
  document.getElementById('crmWhatsAppReset')?.addEventListener('click', () => {
    current.dirty = false;
    ta.value = fillTemplate(TEMPLATES[kind][current.variant], d, current.context);
  });
  document.getElementById('crmWhatsAppClose')?.addEventListener('click', () => window.closeCrmWhatsApp());
  document.getElementById('crmWhatsAppSend')?.addEventListener('click', async () => {
    const text = (ta?.value || '').trim();
    if (!text) { showToast('Pesan masih kosong', 1800, 'error'); return; }
    if (!current.phone || !/^62\d{8,13}$/.test(current.phone)) {
      showToast('Nomor WhatsApp tidak valid', 2200, 'error'); return;
    }
    const sent = { ...current };
    window.open(`https://wa.me/${sent.phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    const data = {
      client_id: sent.clientId || null,
      partner_id: sent.partnerId || null,
      contact_type: sent.kind,
      phone_e164: sent.phone,
      message_text: text,
      source: 'crm_composer',
      opened_whatsapp: true,
    };
    const res = await supabaseFetch('/rest/v1/crm_whatsapp_messages', { method: 'POST', data });
    if (res.ok) showToast('WhatsApp dibuka & riwayat disimpan', 2000, 'success');
    else showToast('WhatsApp dibuka, tetapi riwayat gagal disimpan', 2800, 'warning');
    current = null;
    window.closeSheet('sheetCrmWhatsApp');
  });
  document.getElementById('crmWaTabMessage')?.addEventListener('click', () => {
    document.getElementById('crmWhatsAppMessagePanel').hidden = false;
    document.getElementById('crmWhatsAppHistory').hidden = true;
    document.getElementById('crmWaTabMessage').classList.add('active');
    document.getElementById('crmWaTabHistory').classList.remove('active');
  });
  document.getElementById('crmWaTabHistory')?.addEventListener('click', async () => {
    document.getElementById('crmWhatsAppMessagePanel').hidden = true;
    document.getElementById('crmWhatsAppHistory').hidden = false;
    document.getElementById('crmWaTabHistory').classList.add('active');
    document.getElementById('crmWaTabMessage').classList.remove('active');
    await loadHistory();
  });
}

window.openCrmWhatsApp = function (payload) {
  const data = payload && typeof payload === 'object' ? payload : {};
  const phone = normalizePhone(data.phone || data.no_whatsapp || data.wa || '');
  if (!phone || !/^62\d{8,13}$/.test(phone)) {
    showToast('Kontak belum memiliki nomor WhatsApp yang valid', 2400, 'error');
    return;
  }
  const kind = data.kind === 'mitra' ? 'mitra' : 'klien';
  current = { kind, data, phone, clientId: data.clientId || null, partnerId: data.partnerId || null, variant: 0, dirty: false, context: '' };
  render();
  window.openSheet('sheetCrmWhatsApp');
};

window.closeCrmWhatsApp = function () {
  current = null;
  window.closeSheet('sheetCrmWhatsApp');
};
