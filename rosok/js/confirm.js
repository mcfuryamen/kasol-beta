/* =========================================================================
   KASIR SOLO - ROSOK
   confirm.js — Dialog konfirmasi in-app (port kaki5 confirm.js; API Promise).
   ALASAN: confirm() native TIDAK bisa diandalkan di webview tertanam —
   insiden 2026-09-05: browser internal ZCode gagal memuat preload
   embeddedBrowserJavaScriptDialog → dialog native bisa mengembalikan nilai
   bohong, dan semua alur destruktif (hapus/void/pulihkan/hapus-semua/tutup
   buku) jadi diam-diam batal. Pelajaran kaki5 (bug 2026-08-25): jangan
   null-kan callback/resolver SEBELUM aksi dieksekusi — di sini resolver
   Promise ditahan closure tombol, aman dari urutan cleanup.
   Pemakaian: `if(!(await showConfirm({icon,text,okLabel}))) return;`
   ========================================================================= */
let _active = null;   // { finish(v) } — satu dialog pada satu waktu
const _queue = [];    // panggilan bersamaan diantre, tidak saling timpa

export function showConfirm({ icon = '⚠️', text = '', okLabel = 'Ya', cancelLabel = 'Batal' } = {}){
  if(_active) return new Promise(res => _queue.push(() => res(run())));
  return run();

  function run(){
    return new Promise(resolve => {
      const el = document.getElementById('confirmModal');
      if(!el){ resolve(window.confirm(text)); return; } // jaring pengaman: markup hilang
      document.getElementById('confirmIcon').textContent = icon;
      document.getElementById('confirmText').textContent = text;
      const okBtn = document.getElementById('confirmOkBtn');
      const noBtn = document.getElementById('confirmCancelBtn');
      okBtn.textContent = okLabel;
      noBtn.textContent = cancelLabel;
      const finish = (v) => {
        document.removeEventListener('keydown', esc);
        okBtn.onclick = null; noBtn.onclick = null;
        el.classList.remove('show');
        _active = null;
        resolve(v);                       // resolve TERAKHIR — closure sudah memegang ref
        const next = _queue.shift(); if(next) next();
      };
      const esc = (e) => { if(e.key === 'Escape') finish(false); };
      okBtn.onclick = () => finish(true);
      noBtn.onclick = () => finish(false);
      el.classList.add('show');
      document.addEventListener('keydown', esc);
      try { okBtn.focus(); } catch (_) {}
      _active = { finish };
    });
  }
}
