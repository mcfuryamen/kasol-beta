#!/usr/bin/env node
/**
 * kw.mjs — generator deep link riset kata kunci (bantuan manual keyword outreach kit 05/07)
 *
 * Usage:
 *   node kw.mjs "kasir pk"
 *   node kw.mjs "umkm solo"
 */
const kw = process.argv.slice(2).join(' ');
if (!kw.trim()) {
  console.log('Usage: node kw.mjs <kata kunci…>');
  console.log('Contoh: node kw.mjs "kasir pk"');
  process.exit(1);
}
const e = encodeURIComponent(kw);
console.log(`Kata kunci: "${kw}"\n`);
console.log('Deep link pencarian (1 klik langsung ke hasil):');
console.log(`  TikTok : https://www.tiktok.com/search?q=${e}`);
console.log(`  X      : https://x.com/search?q=${e}`);
console.log(`  FB post: https://www.facebook.com/search/posts?q=${e}`);
console.log(`  FB grup: https://www.facebook.com/search/groups?q=${e}`);
console.log(`  IG     : (gak ada deep link publik) → buka IG → Search → ketik: ${kw}`);
console.log('\nVariasi yang worth dicoba:');
for (const v of [`${kw} harga`, `${kw} untuk pemula`, `kasir ${kw}`]) {
  console.log(`  ${v}  →  https://www.tiktok.com/search?q=${encodeURIComponent(v)}`);
}
console.log('\nIngat aturan kit 05: komentar = umpan (tanpa link) · link cuma di level pitch C · DM setelah dia balas.');
