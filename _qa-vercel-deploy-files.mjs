// QA read-only: isi file deployment Vercel + proteksi project.
import fs from 'node:fs';

const root = 'C:\\Users\\Admin\\Documents\\kasol';
const env = fs.readFileSync(root + '\\.env.local', 'utf8');
let token = '';
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/vercel token:\s*(vcp_[A-Za-z0-9]+)/i);
  if (m) { token = m[1]; break; }
}
if (!token) { console.error('Token tidak ditemukan'); process.exit(1); }

const H = { Authorization: 'Bearer ' + token };
const api = async (path) => {
  const r = await fetch('https://api.vercel.com' + path, { headers: H });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, body: j, raw: t };
};

const TEAM = 'team_VPDFCbDl3nLlG8rmsam7Px7H';
const PID = 'prj_i1KsXAEGk4uTqUTDIUGgcR5uHqln';
const DID = 'dpl_8g8RZ79QtLrMWtbXrvPZTyDxx4U8';

const run = async () => {
  const files = await api(`/v13/deployments/${DID}/files?teamId=${TEAM}`);
  const list = files.body?.files || [];
  console.log('=== FILES DEPLOYMENT (' + list.length + ') ===');
  const want = list.filter((f) => /adm-masjid|web-masjid|vercel\.json|sw\.js|manifest/i.test(f.name || ''));
  for (const f of want.slice(0, 40)) {
    console.log(` - ${f.name}  ${f.size} B  sha=${(f.hash || '').slice(0, 12)}`);
  }
  if (!want.length) {
    console.log('(tidak ada file yang cocok; 10 pertama: ' + list.slice(0, 10).map((f) => f.name).join(', ') + ')');
  }

  const prot = await api(`/v9/projects/${PID}/protection?teamId=${TEAM}`);
  console.log('\n=== PROTECTION ===');
  console.log('status=' + prot.status);
  if (prot.body) {
    console.log(JSON.stringify(prot.body, null, 1).slice(0, 900));
  } else console.log(prot.raw.slice(0, 300));

  const al = await api(`/v4/aliases?projectId=${PID}&teamId=${TEAM}&limit=20`);
  console.log('\n=== ALIASES ===');
  for (const a of al.body?.aliases || []) console.log(` - ${a.alias} -> ${a.target}`);
};

run().catch((e) => { console.error('GAGAL', e.message); process.exit(1); });
