#!/usr/bin/env node
/**
 * QA kuota perangkat (migration-hub-device-quota-configurable.sql).
 * Membuktikan `licenses.max_devices` DIBACA, bukan hardcode 2:
 *   · lisensi max_devices=1 dgn 1 device aktif → perangkat baru DITOLAK (device-limit)
 *   · respons memuat max_devices yang benar
 * SELF-CLEANUP: perangkat uji apa pun yang terlanjur dibuat akan dihapus.
 * Jalankan: node supabase/_qa-device-quota.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = {};
for (const raw of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf-8').split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const eq = line.indexOf('=');
  if (eq <= 0) continue;
  env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
}
const URL = env.SUPABASE_URL.replace(/\/$/, '');
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' };

const UJI = 'QA-QUOTA-' + Date.now();
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + ' ' + extra); } };

async function get(p) {
  const r = await fetch(`${URL}/rest/v1/${p}`, { headers: H });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return t; }
}
async function del(p) { return fetch(`${URL}/rest/v1/${p}`, { method: 'DELETE', headers: H }); }
async function rpc(fn, args) {
  const r = await fetch(`${URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H, body: JSON.stringify(args) });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return t; }
}

try {
  const lics = await get('licenses?select=id,app_type,max_devices,status&status=eq.active');
  const devs = await get('license_devices?select=license_id,device_code,status');
  const aktif = (id) => devs.filter((d) => d.license_id === id && d.status === 'active').length;

  console.log('# Lisensi aktif & perangkatnya:');
  for (const l of lics) console.log(`  ${l.app_type.padEnd(6)} max_devices=${l.max_devices} aktif=${aktif(l.id)}`);

  // Kandidat paling tajam: max_devices=1 dan sudah ada >=1 device aktif.
  const kandidat = lics.find((l) => Number(l.max_devices) === 1 && aktif(l.id) >= 1);
  if (!kandidat) { console.log('SKIP — tidak ada lisensi max_devices=1 dengan device aktif.'); }
  else {
    console.log(`\n== Uji: lisensi max_devices=1 (${kandidat.app_type}, aktif=${aktif(kandidat.id)}) ==`);
    const res = await rpc('license_activate_device', {
      p_license_id: kandidat.id, p_device_code: UJI, p_device_label: 'QA Kuota',
    });
    ok('perangkat ke-2 DITOLAK (device-limit)', res?.ok === false && res?.reason === 'device-limit', JSON.stringify(res));
    ok('respons memuat max_devices=1 (bukan hardcode 2)', Number(res?.max_devices) === 1, JSON.stringify(res));
    ok('pesan menyebut angka 1', typeof res?.message === 'string' && res.message.includes('1 perangkat'), JSON.stringify(res?.message));
  }

  // Kontrol negatif: aktivasi ULANG perangkat yang sudah aktif harus tetap lolos
  // (already-active) walau kuota penuh — perilaku lama dipertahankan.
  if (kandidat) {
    const dev = devs.find((d) => d.license_id === kandidat.id && d.status === 'active');
    if (dev) {
      const res2 = await rpc('license_activate_device', {
        p_license_id: kandidat.id, p_device_code: dev.device_code, p_device_label: 'QA Kuota',
      });
      ok('perangkat yang SUDAH aktif → already-active (tidak diblok kuota)', res2?.ok === true && res2?.reason === 'already-active', JSON.stringify(res2));
    }
  }

  // Kontrol: lisensi max_devices>2 harus mengizinkan >2 (tidak lagi mentok 2).
  const longgar = lics.find((l) => Number(l.max_devices) > 2);
  if (longgar) {
    console.log(`\n== Uji: lisensi max_devices=${longgar.max_devices} (${longgar.app_type}, aktif=${aktif(longgar.id)}) ==`);
    const res3 = await rpc('license_activate_device', {
      p_license_id: longgar.id, p_device_code: UJI, p_device_label: 'QA Kuota',
    });
    if (aktif(longgar.id) < Number(longgar.max_devices)) {
      ok('aktivasi lolos selama di bawah kuota', res3?.ok === true, JSON.stringify(res3));
      ok('respons memuat max_devices sesuai kolom', Number(res3?.max_devices) === Number(longgar.max_devices), JSON.stringify(res3));
    } else {
      console.log('  SKIP — kuota lisensi ini sudah penuh.');
    }
  }
} catch (e) {
  fail++; console.error('❌ ERROR:', e.message);
} finally {
  console.log('\n== Cleanup ==');
  const dl = await del(`license_devices?device_code=eq.${encodeURIComponent(UJI)}`);
  console.log('  hapus perangkat uji:', dl.status);
  const sisa = await get(`license_devices?device_code=eq.${encodeURIComponent(UJI)}&select=id`);
  console.log('  sisa perangkat uji:', JSON.stringify(sisa));
  console.log(`\n=== HASIL: ${pass} PASS / ${fail} FAIL ===`);
  process.exitCode = (fail || (Array.isArray(sisa) && sisa.length)) ? 1 : 0;
}
