/* =========================================================================
   KASIR SOLO - ROSOK
   onboard.js — Onboarding & emoji picker. Imports: utils, state, license.
   ========================================================================= */
import { setSetting, toast, closeSheet, getSetting } from './utils.js';
import { SETTINGS, setSETTINGS, loadSettingsIntoState } from './app-state.js';
import { checkLicenseGate } from './license.js';


export async function finishOnboarding(){
  const name = document.getElementById('onbBizName').value.trim();
  if(!name){ toast('Isi nama usaha dulu ya'); return; }
  await setSetting('bizName', name);
  await setSetting('ownerName', document.getElementById('onbOwnerName').value.trim());
  await setSetting('bizPhone', document.getElementById('onbPhone').value.trim());
  await setSetting('setupDone', true);
  await setSetting('trialStart', new Date().toISOString());
  await loadSettingsIntoState();
  closeSheet('sheetOnboarding');
  toast('Selamat datang! Masa coba 7 hari dimulai 🎉');
  checkLicenseGate();
}

// Emoji picker
const EMOJI_PICKER_LIST = [
  '♻️','📦','🗞️','📄','🧾','📚','📰','🧻','🥤','🧴','🫙','🍾','🥫','🧃','🍶','🧊',
  '🔩','⚙️','🔧','🔗','⛓️','🪙','🟠','🥉','🔌','🔋','💡','📱','💻','🖥️','📺','🔦',
  '👕','👖','👟','🧢','🧦','🧤','🧣','👜','🛏️','🪑','🪟','🚪','🧱','🪵','🛢️','🪣',
  '🪫','🧲','🎧','📻','⏰','🕰️','📷','🎮','🚲','🛴','🏍️','🚗','⚡','🌟','✨','🗑️'
];

let emojiPickerBuilt = false;

export function buildEmojiPicker(){
  if(emojiPickerBuilt) return;
  const grid = document.getElementById('emojiPickerGrid');
  if(!grid) return;
  grid.innerHTML = EMOJI_PICKER_LIST.map(e=>
    `<button type="button" onclick="window.pickEmoji(this)">${e}</button>`
  ).join('');
  emojiPickerBuilt = true;
  document.addEventListener('click', function(ev){
    const picker = document.querySelector('.emoji-picker');
    if(picker && !picker.contains(ev.target)) hideEmojiPicker();
  });
}

export function showEmojiPicker(){ buildEmojiPicker(); const g = document.getElementById('emojiPickerGrid'); if(g) g.classList.add('show'); }
export function hideEmojiPicker(){ const g = document.getElementById('emojiPickerGrid'); if(g) g.classList.remove('show'); }
export function pickEmoji(btn){ const input = document.getElementById('katFormEmoji'); if(input) input.value = btn.textContent; hideEmojiPicker(); }

// Global bare — dipanggil oleh onclick/onfocus di index.html
window.showEmojiPicker = showEmojiPicker;
window.hideEmojiPicker = hideEmojiPicker;
window.pickEmoji = pickEmoji;
// Alias kompatibel (_ksr_ prefix)
window._ksr_showEmojiPicker = showEmojiPicker;
window._ksr_hideEmojiPicker = hideEmojiPicker;
window._ksr_pickEmoji = pickEmoji;
window._ksr_finishOnboarding = finishOnboarding;
