// QA read-only: status project & deployment Vercel untuk app masjid.
// Token dibaca dari .env.local root saat runtime (tidak pernah dicetak).
import fs from 'node:fs';

const root = 'C:\\Users\\Admin\\Documents\\kasol';
const env = fs.readFileSync(root + '\\.env.local', 'utf8');
let token = '';
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/vercel token:\s*(vcp_[A-Za-z0-9]+)/i);
  if (m) { token = m[1]; break; }
}
if (!token) { console.error('Token Vercel tidak ditemukan di .env.local'); process.exit(1); }

const H = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
const api = async (path) => {
  const r = await fetch('https://api.vercel.com' + path, { headers: H });
  const t = await r.text();
  let j = null;
  try { j = JSON.parse(t); } catch {}
  return { status: r.status, body: j, raw: t };
};

const run = async () => {
  const teams = await api('/v2/teams?limit=20');
  console.log('=== TEAMS ===');
  const teamList = teams.body?.teams || [];
  for (const t of teamList) console.log(` - ${t.slug} (${t.id}) member=${t.membership?.role}`);
  if (!teamList.length) { console.log(teams.raw.slice(0, 300)); return; }
  const teamId = teamList[0].id;

  const proj = await api(`/v9/projects?teamId=${teamId}&limit=100`);
  console.log('\n=== PROJECTS (' + (proj.body?.projects?.length ?? '?') + ') ===');
  const projects = proj.body?.projects || [];
  for (const p of projects) {
    const name = p.name || '';
    if (!/masjid|masool|masj|adm/i.test(name + ' ' + (p.framework || ''))) continue;
    console.log(` - ${name} id=${p.id} framework=${p.framework || '-'} created=${new Date(p.createdAt).toISOString().slice(0, 10)}`);
    console.log(`   rootDirectory=${p.rootDirectory || '(root)'}`);
    console.log(`   targets=${JSON.stringify(p.targets || null)}`);
    console.log(`   git: repo=${p.link?.repo || p.link?.type || '-'} branch=${p.link?.productionBranch || '-'} dir=${p.link?.dir || '-'}`);
    console.log(`   latestDeploy=${p.latestDeployment ? JSON.stringify({ url: p.latestDeployment.url, state: p.latestDeployment.state, created: new Date(p.latestDeployment.created).toISOString(), meta: p.latestDeployment.meta }) : 'NONE'}`);

    const dep = await api(`/v13/deployments?projectId=${p.id}&teamId=${teamId}&limit=8`);
    const deps = dep.body?.deployments || [];
    console.log(`   deployments (${deps.length}):`);
    for (const d of deps) {
      console.log(`     - ${d.state} ${d.url || '-'} sha=${(d.meta?.githubCommitSha || d.meta?.gitlabCommitSha || '-').slice(0, 8)} branch=${d.meta?.githubCommitRef || d.meta?.gitlabCommitRef || '-'} at=${new Date(d.created).toISOString().slice(0, 16)}`);
    }
    // Project settings: root dir + git connection
    const det = await api(`/v9/projects/${p.id}?teamId=${teamId}`);
    if (det.status === 200 && det.body) {
      console.log('   settings.rootDirectory=' + (det.body.rootDirectory || '(root)'));
      console.log('   settings.link=' + JSON.stringify(det.body.link || null));
      console.log('   settings.gitDeploymentEnabled=' + JSON.stringify(det.body.gitDeployment?.enabled ?? det.body.gitDeployment ?? null));
      console.log('   settings.envs=' + JSON.stringify((det.body.env || []).map((e) => e.key)));
    }
  }
};

run().catch((e) => { console.error('GAGAL', e.message); process.exit(1); });
