import fs from 'fs';

const JOBS = {
  'README.md': [
    ['`js/license.sync.js:394`', '`js/license.sync.js:541`']
  ],
  'DESIGN.md': [
    ['(`license.sync.js:227,252`)', '(`license.sync.js:367,392`)'],
    ['(`license.sync.js:394`)', '(`license.sync.js:541`)']
  ],
  'docs/DEVELOPER.md': [
    ['`license.sync.js:361`', '`license.sync.js:508`'],
    ['`license.sync.js:365-366`', '`license.sync.js:511-515`'],
    ['`license.sync.js:227`', '`license.sync.js:367`'],
    ['`license.sync.js:252`', '`license.sync.js:392`'],
    ['`license.sync.js:313`', '`license.sync.js:460`'],
    ['`license.sync.js:33,249`', '`license.sync.js:33,324`'],
    ['`license.sync.js:477`', '`license.sync.js:624`'],
    ['`license.sync.js:49,453`', '`license.sync.js:49,600`'],
    ['`license.sync.js:394`', '`license.sync.js:541`']
  ]
};

let fail = 0;
for (const [doc, jobs] of Object.entries(JOBS)) {
  let s = fs.readFileSync(doc, 'utf8');
  for (const [from, to] of jobs) {
    const n = s.split(from).length - 1;
    if (n !== 1) { console.log(`FAIL ${doc}: "${from}" muncul ${n}x`); fail++; continue; }
    s = s.replace(from, to);
    console.log(`ok   ${doc}: ${from}  ->  ${to}`);
  }
  fs.writeFileSync(doc, s, 'utf8');
}
console.log(fail ? `\n${fail} penggantian GAGAL` : '\nsemua rujukan dokumen terkoreksi');
