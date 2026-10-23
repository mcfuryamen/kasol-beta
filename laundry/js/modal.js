// ==================== MODAL ADAPTER (laundry) ====================
// Modul lisensi kaki5 memanggil openModal(id)/closeModal(id) untuk overlay
// lisensi. Elemen yang dipakai modul (id wajib ada di index.html):
//   • #lockOverlay  — overlay kunci lisensi (kartu + halaman revoked)
//   • #sheetLicense — sheet "Status Lisensi"  (#licenseSheetBody)
//   • #sheetPurchase — sheet "Beli Lisensi"   (#purchaseSheetBody)
// Tampilan dikendalikan class 'open' + CSS di index.html (kontrak z-index:
// lockOverlay 600 < toast 620 < sheet 640).

const _selectors = {};

export function registerModalSelector(id, selector){
  _selectors[id] = selector;
}

export async function openModal(id){
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('open');
  try { document.body.style.overflow = 'hidden'; } catch (_){ }
}

export function closeModal(id){
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('open');
  try { document.body.style.overflow = ''; } catch (_){ }
}
