/**
 * Admin Marketing KASIRSOLO — Settings Module
 * Manage admin business info, landing page content, backup/restore, danger zone
 */

import { getState, setState, subscribe } from './app-state.js';
import { getAll, put, getByKey, del, clear, putMany } from './storage.js';
import { showToast } from './toast.js';
import { escapeHtml } from './utils.js';

const SETTINGS_KEYS = {
  BIZ: 'admin_biz',
  LANDING: 'admin_landing'
};

const DEFAULT_BIZ = {
  namaUsaha: 'KASIRSOLO',
  namaPemilik: 'Admin',
  noWhatsapp: '081234567890',
  alamat: 'Jl. Contoh No. 123, Jakarta',
  tagline: 'Solusi POS Terbaik untuk UMKM Indonesia'
};

const DEFAULT_LANDING = {
  heroTitle: 'Kelola Usaha Lebih Mudah dengan KASIRSOLO',
  heroSubtitle: 'Aplikasi POS lengkap untuk berbagai jenis usaha. Transaksi cepat, laporan otomatis, sinkron cloud.',
  features: [
    { icon: '⚡', title: 'Transaksi Cepat', desc: 'Antrian tidak panjang, bayar lancar' },
    { icon: '📊', title: 'Laporan Otomatis', desc: 'Lihat omset & stok real-time' },
    { icon: '☁️', title: 'Sinkron Cloud', desc: 'Data aman & bisa diakses dimana saja' },
    { icon: '🔒', title: 'Lisensi Fleksibel', desc: 'Bulanan, tahunan, atau seumur hidup' }
  ],
  ctaText: 'Mulai Gratis 30 Hari',
  ctaLink: '#daftar',
  footerText: '© 2025 KASIRSOLO. All rights reserved.'
};

export async function initSettings() {
  await loadSettings();
  renderForms();
  window.addEventListener('screen:change', (e) => {
    if (e.detail?.screen === 'settings') renderForms();
  });
}

async function loadSettings() {
  // Load from storage or use defaults
  const [biz, landing] = await Promise.all([
    getByKey('settings', SETTINGS_KEYS.BIZ),
    getByKey('settings', SETTINGS_KEYS.LANDING)
  ]);

  if (!biz) {
    await put('settings', { key: SETTINGS_KEYS.BIZ, value: DEFAULT_BIZ });
  }
  if (!landing) {
    await put('settings', { key: SETTINGS_KEYS.LANDING, value: DEFAULT_LANDING });
  }
}

function renderForms() {
  renderBizForm();
  renderLandingForm();
  renderBackupActions();
  renderDangerActions();
}

function renderBizForm() {
  const host = document.getElementById('settingsBizForm');
  getByKey('settings', SETTINGS_KEYS.BIZ).then(({ value = DEFAULT_BIZ }) => {
    host.innerHTML = `
      <div class="field"><label class="field-label" for="setNamaUsaha">Nama Usaha</label><input type="text" id="setNamaUsaha" value="${escapeHtml(value.namaUsaha)}"></div>
      <div class="field"><label class="field-label" for="setNamaPemilik">Nama Pemilik</label><input type="text" id="setNamaPemilik" value="${escapeHtml(value.namaPemilik)}"></div>
      <div class="field"><label class="field-label" for="setNoWhatsapp">No. WhatsApp</label><input type="tel" id="setNoWhatsapp" value="${escapeHtml(value.noWhatsapp)}"></div>
      <div class="field field-span-2"><label class="field-label" for="setAlamat">Alamat</label><input type="text" id="setAlamat" value="${escapeHtml(value.alamat)}"></div>
      <div class="field field-span-2"><label class="field-label" for="setTagline">Tagline</label><input type="text" id="setTagline" value="${escapeHtml(value.tagline)}"></div>
      <div class="field field-span-2"><button class="btn btn-primary" onclick="saveBizSettings()">💾 Simpan Info Admin</button></div>
    `;
  });
}

function renderLandingForm() {
  const host = document.getElementById('settingsLandingForm');
  getByKey('settings', SETTINGS_KEYS.LANDING).then(({ value = DEFAULT_LANDING }) => {
    const featuresHtml = (value.features || DEFAULT_LANDING.features).map((f, i) => `
      <div class="card" style="margin-bottom:8px;padding:12px;">
        <div style="display:flex;gap:8px;align-items:flex-start;">
          <input type="text" class="input-mono" style="width:40px;" value="${f.icon}" id="featIcon${i}" maxlength="4">
          <div style="flex:1;">
            <input type="text" placeholder="Judul fitur" value="${escapeHtml(f.title)}" id="featTitle${i}" style="width:100%;margin-bottom:4px;">
            <input type="text" placeholder="Deskripsi" value="${escapeHtml(f.desc)}" id="featDesc${i}" style="width:100%;">
          </div>
          <button class="btn btn-sm btn-danger" onclick="removeFeature(${i})" style="min-width:auto;padding:6px 10px;">Hapus</button>
        </div>
      </div>
    `).join('');

    host.innerHTML = `
      <div class="field"><label class="field-label" for="setHeroTitle">Hero Title</label><input type="text" id="setHeroTitle" value="${escapeHtml(value.heroTitle)}"></div>
      <div class="field field-span-2"><label class="field-label" for="setHeroSubtitle">Hero Subtitle</label><textarea id="setHeroSubtitle" rows="2">${escapeHtml(value.heroSubtitle)}</textarea></div>
      <div class="section-label mt12">Fitur (max 6)</div>
      <div id="landingFeatures">${featuresHtml}</div>
      <div class="btn-row mt8"><button class="btn btn-outline" onclick="addFeature()">➕ Tambah Fitur</button></div>
      <div class="field"><label class="field-label" for="setCtaText">CTA Text</label><input type="text" id="setCtaText" value="${escapeHtml(value.ctaText)}"></div>
      <div class="field"><label class="field-label" for="setCtaLink">CTA Link</label><input type="text" id="setCtaLink" value="${escapeHtml(value.ctaLink)}"></div>
      <div class="field field-span-2"><label class="field-label" for="setFooterText">Footer Text</label><input type="text" id="setFooterText" value="${escapeHtml(value.footerText)}"></div>
      <div class="field field-span-2"><button class="btn btn-primary" onclick="saveLandingSettings()">💾 Simpan Landing Page</button></div>
    `;
  });
}

let featureCounter = 0;
window.addFeature = function() {
  const container = document.getElementById('landingFeatures');
  const idx = featureCounter++;
  const div = document.createElement('div');
  div.className = 'card';
  div.style.marginBottom = '8px';
  div.style.padding = '12px';
  div.innerHTML = `
    <div style="display:flex;gap:8px;align-items:flex-start;">
      <input type="text" class="input-mono" style="width:40px;" value="✨" id="featIcon${idx}" maxlength="4">
      <div style="flex:1;">
        <input type="text" placeholder="Judul fitur" value="" id="featTitle${idx}" style="width:100%;margin-bottom:4px;">
        <input type="text" placeholder="Deskripsi" value="" id="featDesc${idx}" style="width:100%;">
      </div>
      <button class="btn btn-sm btn-danger" onclick="removeFeature(${idx})" style="min-width:auto;padding:6px 10px;">Hapus</button>
    </div>
  `;
  container.appendChild(div);
};

window.removeFeature = function(idx) {
  const el = document.getElementById(`featIcon${idx}`)?.closest('.card');
  if (el) el.remove();
};

window.saveBizSettings = async function() {
  const value = {
    namaUsaha: document.getElementById('setNamaUsaha').value.trim(),
    namaPemilik: document.getElementById('setNamaPemilik').value.trim(),
    noWhatsapp: document.getElementById('setNoWhatsapp').value.trim(),
    alamat: document.getElementById('setAlamat').value.trim(),
    tagline: document.getElementById('setTagline').value.trim()
  };
  await put('settings', { key: SETTINGS_KEYS.BIZ, value });
  showToast('✅ Info admin disimpan', 2000, 'success');
};

window.saveLandingSettings = async function() {
  const features = [];
  for (let i = 0; i < featureCounter; i++) {
    const icon = document.getElementById(`featIcon${i}`);
    const title = document.getElementById(`featTitle${i}`);
    const desc = document.getElementById(`featDesc${i}`);
    if (icon && title && desc && (icon.value || title.value || desc.value)) {
      features.push({ icon: icon.value || '✨', title: title.value.trim(), desc: desc.value.trim() });
    }
  }

  const value = {
    heroTitle: document.getElementById('setHeroTitle').value.trim(),
    heroSubtitle: document.getElementById('setHeroSubtitle').value.trim(),
    features,
    ctaText: document.getElementById('setCtaText').value.trim(),
    ctaLink: document.getElementById('setCtaLink').value.trim(),
    footerText: document.getElementById('setFooterText').value.trim()
  };
  await put('settings', { key: SETTINGS_KEYS.LANDING, value });
  showToast('✅ Landing page disimpan', 2000, 'success');
};

function renderBackupActions() {
  const host = document.getElementById('settingsBackupActions');
  host.innerHTML = `
    <button class="btn-backup-action" onclick="exportAllData()">
      <span class="backup-icon">📤</span>
      <span>Ekspor Semua Data</span>
      <small>Produk, Serial, Klien, Leads, Pengaturan</small>
    </button>
    <button class="btn-backup-action" onclick="importAllData()">
      <span class="backup-icon">📥</span>
      <span>Impor Semua Data</span>
      <small>Dari file JSON backup</small>
    </button>
    <button class="btn-backup-action" onclick="resetToDefaults()">
      <span class="backup-icon">🔄</span>
      <span>Reset ke Default</span>
      <small style="color:var(--orange-600);">Hapus semua & mulai dari awal</small>
    </button>
  `;
}

function renderDangerActions() {
  const host = document.getElementById('settingsDangerActions');
  host.innerHTML = `
    <div class="field field-span-2" style="display:flex;gap:12px;align-items:center;">
      <span style="color:var(--red);font-weight:700;">⚠️ Hapus Semua Data Admin</span>
      <button class="btn btn-danger" onclick="confirmNuclear()">Hapus Semua</button>
    </div>
    <small class="hint-small">Ini akan menghapus: produk, serial, klien, leads, pengaturan. TIDAK BISA DIBATALKAN.</small>
  `;
}

window.exportAllData = async function() {
  const stores = ['products', 'serials', 'clients', 'leads', 'settings'];
  const data = {};
  for (const store of stores) {
    data[store] = await getAll(store);
  }
  data.exportedAt = Date.now();
  data.version = '2.0';

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `admin-full-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('✅ Semua data diekspor', 2000, 'success');
};

window.importAllData = function() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      for (const [store, items] of Object.entries(data)) {
        if (Array.isArray(items) && items.length > 0) {
          await putMany(store, items);
        }
      }
      showToast('✅ Semua data diimpor', 2000, 'success');
      renderForms();
    } catch (e) {
      showToast('Gagal impor: file tidak valid', 2000, 'error');
    }
  };
  input.click();
};

window.resetToDefaults = async function() {
  if (!confirm('⚠️ Reset ke default? Semua data akan dihapus & diganti data contoh.')) return;
  if (!confirm('YAKIN? Data saat ini akan hilang permanen.')) return;

  await clear('products');
  await clear('serials');
  await clear('clients');
  await clear('leads');
  await clear('settings');

  // Re-seed
  const { seedIfEmpty } = await import('./storage.js');
  await seedIfEmpty();

  showToast('🔄 Reset selesai, data contoh dimuat', 2000, 'success');
  renderForms();
  // Refresh other modules
  window.dispatchEvent(new CustomEvent('data:reset'));
};

window.confirmNuclear = async function() {
  if (!confirm('⚠️ PERINGATAN TERAKHIR: Ini akan menghapus SEMUA data tanpa sisa. Lanjutkan?')) return;
  if (!prompt('Ketik "HAPUS SEMUA" untuk konfirmasi:') === 'HAPUS SEMUA') return;

  await clear('products');
  await clear('serials');
  await clear('clients');
  await clear('leads');
  await clear('settings');

  showToast('☢️ Semua data dihapus permanen', 2000, 'error');
  renderForms();
  window.dispatchEvent(new CustomEvent('data:reset'));
};