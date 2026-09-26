/**
 * Organism: Footer (Landing Page)
 */
import { el } from '../../db/init.js';

export function Footer() {
  const footer = el('footer', { class: 'landing-footer' });
  footer.innerHTML = `
    <div class="footer-inner">
      <div class="footer-brand">
        <h3>&#127774; TPA Al-Hikmah</h3>
        <p>Taman Pendidikan Al-Quran untuk generasi qurani.</p>
      </div>
      <div class="footer-links">
        <div class="footer-col">
          <h4>TPA</h4>
          <a href="index.html">Masuk</a>
          <a href="index.html#register">Daftar</a>
        </div>
        <div class="footer-col">
          <h4>Bantuan</h4>
          <a href="#">Instagram</a>
          <a href="#">WhatsApp</a>
          <a href="#">YouTube</a>
        </div>
        <div class="footer-col">
          <h4>Ikuti Kami</h4>
          <a href="#">Instagram</a>
          <a href="#">WhatsApp</a>
          <a href="#">YouTube</a>
        </div>
      </div>
      <div class="footer-bottom">
        <p>&copy; ${new Date().getFullYear()} TPA Al-Hikmah. Hak cipta dilindungi.</p>
      </div>
    </div>
  `;
  return footer;
}
