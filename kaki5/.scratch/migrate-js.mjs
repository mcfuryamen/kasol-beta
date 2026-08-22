import { readFileSync, writeFileSync } from 'node:fs';

const MAP = {
  'padding-left:20px;margin:8px 0': 'kpl20 kmy8',
  'margin-top:16px': 'kmt16',
  'margin-top:14px': 'kmt14',
  'margin-top:12px': 'kmt12',
  'margin-top:8px': 'kmt8',
  'line-height:1.8;font-size:14px': 'klh18 kfs14',
  'background:var(--green-bg);padding:12px;border-radius:8px;margin-top:12px': 'kinfo-card',
  'background:var(--orange-bg);padding:12px;border-radius:8px;margin-top:12px': 'kwarn-card',
  'background:var(--red-bg);padding:12px;border-radius:8px;margin-top:12px': 'kerr-card',
  'background:var(--green-bg);padding:12px;border-radius:8px': 'kinfo-card',
  'font-size:14px': 'kfs14',
  'font-size:13px': 'kfs13',
  'font-size:12px': 'kfs12',
  'font-size:16px': 'kfs16',
  'font-size:18px': 'kfs18',
  'font-weight:700': 'kfw700',
  'font-weight:600': 'kfw600',
  'font-weight:800': 'kfw800',
  'font-weight:700;font-size:16px': 'kfw700 kfs16',
  'font-weight:700;font-size:14px': 'kfw700 kfs14',
  'font-weight:600;font-size:15px': 'kfw600 kfs15',
  'font-weight:600;font-size:14px': 'kfw600 kfs14',
  'font-weight:800;font-size:20px': 'kfw800 kfs20',
  'font-weight:800;font-size:18px': 'kfw800 kfs18',
  'font-weight:800;font-size:16px': 'kfw800 kfs16',
  'font-weight:800;font-size:14px': 'kfw800 kfs14',
  'color:var(--text2)': 'ktext2',
  'color:var(--text3)': 'ktext3',
  'color:var(--red)': 'kred',
  'color:var(--green)': 'kgreen',
  'color:var(--red);font-weight:700': 'kreq',
  'background:var(--green-bg)': 'kbg-green',
  'background:var(--orange-bg)': 'kbg-orange',
  'background:var(--blue-bg)': 'kbg-blue',
  'background:var(--red-bg)': 'kbg-red',
  'flex:1': 'kflex-1',
  'text-align:center': 'kcenter',
  'text-align:right': 'kright',
  'text-align:left': 'kleft',
  'display:flex;align-items:center;gap:10px': 'kflex-gap10',
  'display:flex;justify-content:space-between;gap:8px;margin-bottom:6px;font-size:14px': 'kflex-between kgap8 kmb8 kfs14',
  'display:flex;justify-content:space-between;margin-bottom:6px': 'kflex-between kmb8',
  'display:flex;justify-content:space-between': 'kflex-between',
  'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px': 'kflex-between-mb12',
  'margin-bottom:12px': 'kmb12',
  'margin-bottom:16px': 'kmb16',
  'margin-bottom:8px': 'kmb8',
  'margin-bottom:10px': 'kmb10',
  'font-size:14px;color:var(--text2)': 'kfs14 ktext2',
  'font-size:13px;color:var(--text2)': 'kfs13 ktext2',
  'font-size:13px;color:var(--text3)': 'kfs13 ktext3',
  'font-size:12px;color:var(--text3)': 'kfs12 ktext3',
  'font-size:12px;color:var(--text3);margin-top:14px': 'kfs12 ktext3 kmt14',
  'font-size:11px': 'kfs11',
  'font-size:32px': 'kfs32',
  'font-size:20px': 'kfs20',
  'width:44px;height:44px;min-height:44px;font-size:16px': 'kwh44',
  'width:44px;height:44px;min-height:44px;font-size:16px;color:var(--red)': 'kwh44 kred',
  'width:100%': 'kw-full',
  'padding:10px': 'kp10',
  'padding:12px': 'kp12',
  'padding:10px;text-align:center': 'kp10 kcenter',
  'padding:10px;text-align:right': 'kp10 kright',
  'padding:10px;text-align:left': 'kp10 kleft',
  'padding:10px;font-weight:600': 'kp10 kfw600',
  'text-align:center;margin-bottom:16px': 'kcenter kmb16',
  'text-align:center;margin-bottom:12px': 'kcenter kmb12',
  'text-align:center;padding:24px;color:var(--text2);font-size:14px': 'kcenter kp24 ktext2 kfs14',
  'font-size:18px;font-weight:800': 'kfs18 kfw800',
  'font-size:18px;font-weight:800;color:var(--red)': 'kfs18 kfw800 kred',
  'font-weight:800;font-size:14px;color:var(--text)': 'kfw800 kfs14',
  'font-weight:800;font-size:14px;color:var(--red)': 'kfw800 kfs14 kred',
  'font-weight:800;font-size:13px;color:var(--primary);text-align:right': 'kfw800 kfs13 kprimary kright',
  'font-weight:800;color:var(--green)': 'kfw800 kgreen',
  'font-size:22px;font-weight:800;margin-bottom:4px': 'kfs22 kfw800 kmb8',
  'font-size:30px;margin-bottom:6px': 'kfs30 kmb8',
  'font-size:48px;margin-bottom:8px': 'kfs48 kmb8',
  'font-size:28px;font-weight:800;color:var(--red);margin-bottom:4px': 'kfs28 kfw800 kred kmb8',
  'margin:0;color:var(--text2);font-size:14px': 'ktext2 kfs14',
};

const FILES = [
  'js/bantuan.js', 'js/laporan.js', 'js/purchase.js',
  'js/trxdetail.js', 'js/expensedetail.js', 'js/pwa.js',
  'js/app.js', 'js/sync.health.js', 'js/license.ui.js',
  'js/menu.js', 'js/beranda.js', 'js/pos.ui.js',
  'js/helpers.js', 'js/carousel.js', 'js/printer.js'
];

function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let totalReplaced = 0;
let totalRemaining = 0;

for (const file of FILES) {
  let content;
  try { content = readFileSync(file, 'utf8'); } catch { continue; }
  let count = 0;

  for (const [styleStr, classStr] of Object.entries(MAP)) {
    const target = 'style="' + styleStr + '"';
    if (target.includes('$' + '{')) continue;
    const pattern = esc(target);

    const reA = new RegExp('class="([^"]*)" ' + pattern, 'g');
    content = content.replace(reA, (m, cls) => {
      count++;
      return 'class="' + cls + ' ' + classStr + '"';
    });

    const reB = new RegExp(pattern, 'g');
    content = content.replace(reB, () => {
      count++;
      return 'class="' + classStr + '"';
    });
  }

  const remaining = (content.match(/style="[^"]*"/g) || []).length;
  if (count > 0) writeFileSync(file, content);
  totalReplaced += count;
  totalRemaining += remaining;
  if (count > 0 || remaining > 0) {
    console.log('  ' + file + ': ' + count + ' diganti, ' + remaining + ' sisa');
  }
}

console.log('\nTotal: ' + totalReplaced + ' diganti, ' + totalRemaining + ' sisa');
