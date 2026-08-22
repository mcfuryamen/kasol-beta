import { readFileSync, writeFileSync } from 'node:fs';
let html = readFileSync('index.html', 'utf8');
let count = 0;
function rep(from, to) {
  const n = html.split(from).length - 1;
  if (n === 0) return;
  html = html.split(from).join(to);
  count += n;
  console.log(`  ${n}x: ${from.substring(0,60)}... → ${to.substring(0,60)}...`);
}

// 1. Setting icon backgrounds (12x) — kelas sudah ada
rep('style="background:var(--orange-bg)"', 'class="kbg-orange"');
rep('style="background:var(--green-bg)"', 'class="kbg-green"');
rep('style="background:var(--blue-bg)"', 'class="kbg-blue"');
rep('style="background:var(--red-bg)"', 'class="kbg-red"');

// 2. Required marker (7x) — perlu kelas .kreq
rep('style="color:var(--red);font-weight:700"', 'class="kreq"');

// 3. Hidden elements (3x)
rep('style="display:none"', 'class="khide"');

// 4. Header subtitle (1x)
rep('style="font-size:12px;font-weight:400;opacity:.85"', 'class="kfs12 kfw400 kop85"');

// 5. Text-decoration none (2x)
rep('style="text-decoration:none"', 'class="kno-underline"');

// 6. justify-content:center (1x — di footer, sisanya sudah kflex-wrap)
rep('style="justify-content:center"', 'class="kjc-center"');

// 7. Modal head (3x — flex-between + mb12)
rep('style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"', 'class="kflex-between-mb12"');

// 8. Cart modal total row (1x)
rep('style="display:flex;justify-content:space-between;margin-bottom:6px"', 'class="kflex-between kmb8"');

// 9. Font-weight 600 + text2 (2x)
rep('style="font-weight:600;color:var(--text2)"', 'class="kfw600 ktext2"');
rep('style="font-weight:800;font-size:20px;color:var(--primary)"', 'class="kfw800 kfs20 kprimary"');

// 10. Cart modal section divider (1x)
rep('style="border-top:2px solid var(--border);margin-top:12px;padding-top:12px"', 'class="kdivider"');

// 11. Grid 2 col (1x — payment)
rep('style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;margin-bottom:12px"', 'class="kgrid-2col-gap12"');

// 12. Grid 4 col preset (1x)
rep('style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px"', 'class="kgrid-4col kmb12"');

// 13. kembalianBox (1x — complex, semantic)
rep('style="background:var(--green-bg);border-radius:12px;padding:14px 16px;text-align:center;display:flex;align-items:center;justify-content:center"', 'class="kkembalian-box"');

// 14. flex-direction:column (1x)
rep('style="display:flex;flex-direction:column"', 'class="kflex-col"');

// 15. Kembalian value (1x)
rep('style="font-size:20px;font-weight:800;color:var(--green)"', 'class="kfs20 kfw800 kgreen"');

// 16. Close button in modal headers (2x)
rep('style="padding:8px;width:40px;height:40px;border-radius:8px;flex-shrink:0"', 'class="kclose-btn"');

// 17. Modal grid 2col gap8 (1x — trx detail buttons)
rep('style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px"', 'class="kgrid-2col-gap8 kmt16"');

// 18. font-size:14px + text2 + line-height (1x — bantuan)
rep('style="font-size:14px;color:var(--text2);line-height:1.6"', 'class="kfs14 ktext2 klh16"');

// 19. font-size:13px (1x — sync diag)
rep('style="font-size:13px"', 'class="kfs13"');

// 20. Gate onboarding (kompleks — buat semantik)
rep('style="max-width:440px;width:100%;text-align:center"', 'class="kgate-box"');
rep('style="width:80px;height:80px;margin-bottom:8px"', 'class="kwh80"');
rep('style="font-size:22px;font-weight:800;margin-bottom:4px"', 'class="kfs22 kfw800 kmb8"');
rep('style="font-size:14px;color:var(--text2);margin-bottom:16px"', 'class="kfs14 ktext2 kmb16"');
rep('style="font-size:15px;color:var(--text2);margin-bottom:18px;line-height:1.5"', 'class="kfs15 ktext2 kmb16 klh15"');
rep('style="text-align:left"', 'class="kleft"');
rep('style="display:none;color:var(--red);font-size:13px;margin-bottom:10px;text-align:left"', 'class="khide kred kfs13 kmb8 kleft"');
rep('style="background:var(--green-bg);border-radius:16px;padding:16px;margin-bottom:16px"', 'class="kgreen-box"');
rep('style="font-size:15px;font-weight:700;color:var(--green)"', 'class="kfs15 kfw700 kgreen"');
rep('style="font-size:13px;color:var(--text2);margin-top:6px"', 'class="kfs13 ktext2 kmt8"');
rep('style="margin-top:12px"', 'class="kmt12"');
rep('style="font-size:12px;color:var(--text3);margin-top:8px"', 'class="kfs12 ktext3 kmt8"');
rep('style="display:none;max-width:440px;width:100%;text-align:center"', 'class="khide kgate-box"');

// 21. Sheet titles (2x)
rep('style="font-size:18px;font-weight:800"', 'class="kfs18 kfw800"');

// 22. Lock overlay (3x)
rep('style="font-size:40px"', 'class="kfs40"');
rep('style="font-size:20px;margin-top:6px"', 'class="kfs20 kmt8"');
rep('style="text-align:center"', 'class="kcenter"');

// 23. TC modal (biarkan — terlalu kompleks & jarang dipakai)
// 24. updateOkBtn (1x)
rep('style="width:100%;margin-top:16px;font-size:16px"', 'class="kw-full kmt16 kfs16"');

// 25. margin-top:14px (1x)
rep('style="margin-top:14px"', 'class="kmt14"');

// 26. margin-top:8px (1x)
rep('style="margin-top:8px"', 'class="kmt8"');

writeFileSync('index.html', html);
console.log(`\n✅ Total: ${count} inline style diganti`);
console.log(`Sisa: ${(html.match(/style="[^"]*"/g) || []).length} inline style`);
