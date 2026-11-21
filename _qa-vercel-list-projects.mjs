import fs from 'node:fs';
const root = 'C:\\Users\\Admin\\Documents\\kasol';
const env = fs.readFileSync(root + '\\.env.local', 'utf8');
let token = '';
for (const line of env.split(/\r?\n/)) { const m = line.match(/vercel token:\s*(vcp_[A-Za-z0-9]+)/i); if (m) { token = m[1]; break; } }
const TEAM = 'team_VPDFCbDl3nLlG8rmsam7Px7H';
const r = await fetch(`https://api.vercel.com/v9/projects?teamId=${TEAM}&limit=100`, { headers: { Authorization: 'Bearer ' + token } });
const j = await r.json();
console.log('TOTAL PROJECT: ' + (j.projects || []).length);
for (const p of (j.projects || [])) {
  console.log(` - ${p.name.padEnd(22)} root=${(p.rootDirectory || '(root)').padEnd(16)} link=${p.link?.repo || '-'} private=${p.private} prodAlias=${p.targets?.production?.alias?.join(',') || '-'}`);
}
