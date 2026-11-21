/* =========================================================================
   KASIR SOLO - ROSOK
   onboard.js — Emoji picker (dipakai form Jenis Rosok).
   Onboarding wizard dihapus: aplikasi langsung tampil beranda saat boot,
   identitas usaha diisi belakangan di Pengaturan (pola kaki5).
   ========================================================================= */

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
