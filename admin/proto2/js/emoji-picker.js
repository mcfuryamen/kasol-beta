/**
 * Admin Marketing KASIRSOLO — Emoji Picker
 * Diadaptasi dari rosok/js/onboard.js
 * 
 * Fitur:
 * - Grid emoji 8 kolom
 * - Click outside to close
 * - Escape key to close
 * - Multiple picker instances support
 * - Accessible (ARIA labels)
 */

// Daftar emoji yang tersedia (unik, no duplicates)
const EMOJI_PICKER_LIST = [
  // Bisnis & Retail
  '🛍️','🏪','🏬','🏭','🏢','🏦','🏨','🏫',
  // Food & Beverage
  '🍜','🍲','🍱','🍛','🍣','🍤','🍔','🍕','🌮','🌯',
  // Services
  '🔧','🛠️','💇','💈','🏥','💊','🩺','🕌','📖','🎓',
  // Tech & Digital
  '💻','📱','🖥️','📺','🎮','🎵','📷','🔌','⚡','🔋',
  // General
  '📦','🗞️','📰','📚','🧾','📄','🧻','📁','📂','🗂️',
  // Transportation
  '🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐',
  // Nature & Elements
  '🌟','✨','⚡','🔥','💧','🌈','☀️','🌙','⭐','🌸',
  // People & Emotions
  '👋','🤝','👍','👏','🙏','💪','🎉','🎊','❤️','💕',
  // Money & Shopping
  '💰','💵','💴','💶','💷','🪙','💳','🛒','🏷️'
];

let emojiPickerBuilt = false;

/**
 * Build emoji picker grid
 * @param {HTMLElement} inputElement - The input element that triggered the picker
 */
function buildEmojiPicker(inputElement) {
  if (emojiPickerBuilt) return;
  
  const grid = document.getElementById('emojiPickerGrid');
  if (!grid) return;
  
  grid.innerHTML = EMOJI_PICKER_LIST.map((e, i) => 
    `<button type="button" 
              class="emoji-btn" 
              data-emoji="${e}" 
              aria-label="Pilih emoji ${e}"
              onclick="window.pickEmoji(this, '${inputElement.id}')">${e}</button>`
  ).join('');
  
  emojiPickerBuilt = true;
  
  // Close picker when clicking outside
  document.addEventListener('click', handleOutsideClick);
  
  // Close picker when pressing Escape
  document.addEventListener('keydown', handleKeyDown);
}

/**
 * Handle click outside picker
 */
function handleOutsideClick(ev) {
  const picker = document.querySelector('.emoji-picker');
  if (picker && !picker.contains(ev.target)) {
    hideEmojiPicker();
  }
}

/**
 * Handle keyboard events
 */
function handleKeyDown(ev) {
  if (ev.key === 'Escape') {
    hideEmojiPicker();
  }
}

/**
 * Show emoji picker
 * @param {HTMLElement} inputElement - The input element to populate
 */
function showEmojiPicker(inputElement) {
  const input = inputElement || document.getElementById('catIcon');
  if (!input) return;
  
  buildEmojiPicker(input);
  const g = document.getElementById('emojiPickerGrid');
  if (g) g.classList.add('show');
}

/**
 * Hide emoji picker
 */
function hideEmojiPicker() {
  const g = document.getElementById('emojiPickerGrid');
  if (g) g.classList.remove('show');
}

/**
 * Pick emoji and set to input
 * @param {HTMLElement} btn - The clicked emoji button
 * @param {string} inputId - The ID of the target input
 */
function pickEmoji(btn, inputId) {
  const input = document.getElementById(inputId);
  if (input) {
    input.value = btn.dataset.emoji;
    hideEmojiPicker();
  }
}

// Expose to window for onclick handlers
window.showEmojiPicker = showEmojiPicker;
window.hideEmojiPicker = hideEmojiPicker;
window.pickEmoji = pickEmoji;
