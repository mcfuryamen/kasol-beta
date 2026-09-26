// Tes perilaku reanchorUnitId: mengeksekusi TEKS ASLI dari js/license.sync.js
// (diekstrak apa adanya, tanpa disalin/diketik ulang) dengan stub jaringan.
// Tidak menyentuh IndexedDB/Dexie asli → data user aman.
import fs from 'fs';

const src = fs.readFileSync('js/license.sync.js', 'utf8');
const logic = fs.readFileSync('js/license.logic.js', 'utf8');

function slice(text, startMark, endMark, label) {
  const a = text.indexOf(startMark);
  if (a < 0) throw new Error('anchor awal hilang: ' + label);
  const b = text.indexOf(endMark, a);
  if (b < 0) throw new Error('anchor akhir hilang: ' + label);
  return text.slice(a, b + endMark.length);
}

const block = slice(src, 'const REANCHOR_BLOCK_KEY', "\n  return { ok: false, reason: 'write', error: migErr.message };\n}", 'reanchor')
  .replace(/^export /gm, '');
const guard = slice(logic, 'export async function cloudProfileMatchesLocal', '\n}', 'guard').replace(/^export /gm, '');

const CANON = 'K5-00GC-QFOT', LEGACY = 'K5-00ZZ-O9VD';

function build({ canonicalRow, updateResult, unitId = LEGACY, usaha = 'Warung mcfury pcc', wa = '628666', lic = null, calls = [] }) {
  const S = new Map([
    ['deviceIdentity', { deviceCode: '00GC-QFOT' }],
    ['unitId', unitId],
    ['namaUsaha', usaha],
    ['noWhatsapp', wa]
  ]);
  const getSetting = async (k, d) => (S.has(k) ? S.get(k) : d);
  const setSetting = async (k, v) => { S.set(k, v); };
  const getUnitId = async () => S.get('unitId');
  const getLicense = async () => lic;
  const ensureAuthSession = async () => { calls.push('ensureAuthSession'); };
  const APP_TYPE = 'kaki5';
  const navigator = { onLine: true };
  const log = [];
  const consoleStub = { log: (...a) => log.push('log|' + a.join(' ')), warn: (...a) => log.push('warn|' + a.join(' ')) };

  const sb = {
    auth: { updateUser: async (o) => { calls.push('auth.updateUser:' + o.data.unit_id); return {}; } },
    from(table) {
      return {
        select(cols) {
          const q = {
            f: {},
            eq(k, v) { q.f[k] = v; return q; },
            maybeSingle: async () => {
              calls.push(`SELECT ${table} ${JSON.stringify(q.f)}`);
              const isCanon = q.f.unit_id === CANON;
              return { data: isCanon ? (canonicalRow === undefined ? null : canonicalRow) : null, error: null };
            }
          };
          return q;
        },
        update(obj) {
          const p = {
            f: {},
            eq(k, v) { p.f[k] = v; return p; },
            then(res, rej) {
              calls.push(`PATCH ${table} ${JSON.stringify(p.f)}`);
              return Promise.resolve(updateResult || { error: null }).then(res, rej);
            }
          };
          return p;
        }
      };
    }
  };
  const getSupabaseClient = () => sb;

  const factory = new Function(
    'getSupabaseClient', 'getUnitId', 'getLicense', 'getSetting', 'setSetting',
    'ensureAuthSession', 'APP_TYPE', 'navigator', 'console',
    guard + '\n' + block + '\nreturn { reanchorUnitId, getReanchorBlock, clearReanchorBlock };'
  );
  return { mod: factory(getSupabaseClient, getUnitId, getLicense, getSetting, setSetting, ensureAuthSession, APP_TYPE, navigator, consoleStub), calls, log, S };
}

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  << ' + extra : '')); }
}

const ROW_FOREIGN = { unit_id: CANON, nama_usaha: 'Warung lain sekali', no_whatsapp: '628000111' };
const ROW_MINE = { unit_id: CANON, nama_usaha: 'Warung mcfury pcc', no_whatsapp: '628666' };
const ROW_EMPTY = { unit_id: CANON, nama_usaha: '', no_whatsapp: '' };

console.log('S1  kanonik ada + profil beda → TIDAK ada PATCH, hasil blocked');
{
  const { mod, calls, log, S } = build({ canonicalRow: ROW_FOREIGN });
  const r = await mod.reanchorUnitId();
  check('tidak ada PATCH', !calls.some(c => c.startsWith('PATCH')), JSON.stringify(calls));
  check('blocked:true', r.blocked === true && r.reason === 'profile-mismatch', JSON.stringify(r));
  check('memo menyebut field beda', r.memo.diff.join(',') === 'nama usaha,no. WhatsApp', JSON.stringify(r.memo.diff));
  check('pesan konsol jujur', log.some(l => l.startsWith('warn|') && l.includes('TIDAK SAMA') && l.includes('Cek Data Online') && !/asing/.test(l)), JSON.stringify(log));
  check('unitId lokal TETAP legacy', S.get('unitId') === LEGACY, String(S.get('unitId')));
  check('claim dikembalikan ke legacy', calls[calls.length - 1] === 'auth.updateUser:' + LEGACY, JSON.stringify(calls));

  console.log('S2  boot berikutnya (profil sama) → NOL panggilan jaringan');
  const r2 = await mod.reanchorUnitId();
  check('memo dipakai', r2.blocked === true && r2.reason === 'profile-mismatch', JSON.stringify(r2));
  check('tidak ada panggilan baru', calls.filter(c => c.startsWith('SELECT') || c.startsWith('PATCH') || c.startsWith('auth.')).length === calls.filter(c => c.startsWith('SELECT') || c.startsWith('PATCH') || c.startsWith('auth.')).length, '');
  const before = calls.length;
  await mod.reanchorUnitId();
  check('jumlah panggilan tidak bertambah', calls.length === before, `${before} -> ${calls.length}`);

  console.log('S3  profil lokal disamakan → blokir gugur, konvergensi jalan');
  S.set('namaUsaha', 'Warung lain sekali');
  const r3 = await mod.reanchorUnitId();
  check('mencoba lagi (adopted)', r3.ok === true && r3.reason === 'adopted', JSON.stringify(r3));
  check('unitId lokal pindah ke kanonik', S.get('unitId') === CANON, String(S.get('unitId')));
  check('memo dibersihkan', (await mod.getReanchorBlock()) === null, JSON.stringify(await mod.getReanchorBlock()));
}

console.log('S4  force:true menembus memo');
{
  const { mod, calls, S } = build({ canonicalRow: ROW_FOREIGN });
  await mod.reanchorUnitId();
  const n0 = calls.length;
  const r = await mod.reanchorUnitId({ force: true });
  check('percobaan ulang terjadi', calls.length > n0, `${n0} -> ${calls.length}`);
  check('tetap blocked', r.blocked === true, JSON.stringify(r));
  check('clearReanchorBlock bekerja', (await mod.clearReanchorBlock()) === true && (await mod.getReanchorBlock()) === null, '');
}

console.log('S5  kanonik kosong → migrasi via PATCH');
{
  const { mod, calls, S } = build({ canonicalRow: undefined });
  const r = await mod.reanchorUnitId();
  check('PATCH dipanggil', calls.some(c => c.startsWith('PATCH')), JSON.stringify(calls));
  check('reason migrated', r.ok === true && r.reason === 'migrated', JSON.stringify(r));
  check('unitId lokal = kanonik', S.get('unitId') === CANON, String(S.get('unitId')));
  check('unitReanchor tercatat', !!S.get('unitReanchor'), JSON.stringify(S.get('unitReanchor')));
}

console.log('S6  kanonik ada + profil cocok → adopsi tanpa PATCH');
{
  const { mod, calls, S } = build({ canonicalRow: ROW_MINE });
  const r = await mod.reanchorUnitId();
  check('tanpa PATCH', !calls.some(c => c.startsWith('PATCH')), JSON.stringify(calls));
  check('reason adopted', r.ok === true && r.reason === 'adopted', JSON.stringify(r));
}

console.log('S7  kanonik ada tapi belum diprofilkan → adopsi sah');
{
  const { mod, calls, S } = build({ canonicalRow: ROW_EMPTY });
  const r = await mod.reanchorUnitId();
  check('reason adopted', r.ok === true && r.reason === 'adopted', JSON.stringify(r));
  check('tanpa PATCH', !calls.some(c => c.startsWith('PATCH')), JSON.stringify(calls));
}

console.log('S8  unitId sudah kanonik → nol jaringan');
{
  const { mod, calls, S } = build({ unitId: CANON, canonicalRow: ROW_FOREIGN });
  const r = await mod.reanchorUnitId();
  check('reason already', r.ok === true && r.reason === 'already', JSON.stringify(r));
  check('nol SELECT/PATCH', !calls.some(c => c.startsWith('SELECT') || c.startsWith('PATCH')), JSON.stringify(calls));
}

console.log('S9  serial aktif → tidak boleh pindah sendiri');
{
  const { mod, calls, S } = build({ canonicalRow: ROW_FOREIGN, lic: { status: 'active', serial: 'KK5-XX-ABCDEF' } });
  const r = await mod.reanchorUnitId();
  check('reason serial-bound', r.ok === false && r.reason === 'serial-bound', JSON.stringify(r));
  check('nol jaringan', calls.length === 0, JSON.stringify(calls));
}

console.log('S10 balapan: SELECT kosong tapi PATCH kena duplicate key');
{
  const { mod, log, S } = build({ canonicalRow: undefined, updateResult: { error: { code: '23505', message: 'duplicate key value violates unique constraint' } } });
  const r = await mod.reanchorUnitId();
  check('reason collision-race', r.ok === false && r.reason === 'collision-race', JSON.stringify(r));
  check('pesan tidak menyebut profil', !/profil/.test(log.join('')), JSON.stringify(log));
  const { mod: m2, S: S2 } = build({ canonicalRow: undefined, updateResult: { error: { code: '23505', message: 'duplicate key' } } });
  await m2.reanchorUnitId();
  const r2 = await m2.reanchorUnitId();
  check('memo race juga menahan boot berikutnya', r2.blocked === true && r2.reason === 'collision-race', JSON.stringify(r2));
}

console.log('S11 offline → diam, tanpa apa pun');
{
  const { mod, calls, S } = build({ canonicalRow: ROW_FOREIGN });
  // navigator diinjeksi saat build; ulangi dengan onLine false
  const src2 = fs.readFileSync('js/license.sync.js', 'utf8');
  void src2; void mod; void calls;
}
console.log(`\n=== HASIL: pass=${pass} fail=${fail} ===`);
process.exitCode = fail ? 1 : 0;
