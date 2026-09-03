// ============================================================================
// generate-license — Supabase Edge Function (Deno)
// Server-side license generation (salt TIDAK di browser).
// Algorithm identik dgn admin/js/license-core.js & client license.js:
//   HMAC-SHA256, key = salt, message = salt + deviceCode(8) + exp(2)
//   signature = base32(digest) ambil 6 char.
// expCode '99' = seumur hidup.
// ============================================================================

const BASE32 = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

// app_type -> prefix salt (HARUS sama dgn PRODUCT_SALT di tiap app klien)
const SALT_BY_APP = {
  kaki5:   { prefix: 'KK5', salt: 'KASIRSOLO-KAKI5-HMAC-V2' },
  rosok:   { prefix: 'KSR', salt: 'KASIRSOLO-ROSOK-HMAC-V2' },
  gerobak: { prefix: 'GBK', salt: 'KASIRSOLO-GEROBAK-HMAC-V2' },
  retail:  { prefix: 'RTL', salt: 'KASIRSOLO-RETAIL-HMAC-V2' },
};

const SB_URL = Deno.env.get('SUPABASE_URL') || '';
const SB_KEY = Deno.env.get('SERVICE_ROLE_KEY') || '';
// Auth endpoint ini: header x-admin-key harus cocok dengan secret ADMIN_API_KEY.
// Fail-closed: tanpa secret terpasang, semua request ditolak (503) — jangan
// sampai endpoint generate lisensi bisa dipanggil siapa pun yang tahu URL.
const ADMIN_KEY = Deno.env.get('ADMIN_API_KEY') || '';

/**
 * Constant-time string comparison (timing-safe) — sama dengan pola di admin/api/_gate.js.
 * Mencegah timing side-channel attack pada ADMIN_API_KEY.
 */
function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function b32Encode(bytes, length = 6) {
  let bits = 0, value = 0, out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5 && out.length < length) {
      out += BASE32[(value >> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  while (out.length < length) {
    if (bits >= 5) { out += BASE32[(value >> (bits - 5)) & 31]; bits -= 5; }
    else { value <<= (5 - bits); out += BASE32[value & 31]; bits = 0; }
  }
  return out;
}

function normalizeDeviceCode(input) {
  return String(input || '').toUpperCase()
    .replace(/[^A-Z0-9]/g, '').slice(0, 8).padEnd(8, 'X');
}

async function hmacSignature(salt, data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(salt + data));
  return b32Encode(new Uint8Array(sig), 6);
}

async function generateSerial(appType, deviceCodeRaw) {
  const meta = SALT_BY_APP[appType];
  if (!meta) throw new Error(`unknown app_type: ${appType}`);
  const salt = await resolveSalt(appType);
  const deviceCode = normalizeDeviceCode(deviceCodeRaw);
  const exp = '99'; // seumur hidup
  const sig = await hmacSignature(salt, deviceCode + exp);
  return `${meta.prefix}-${deviceCode.slice(0,4)}-${deviceCode.slice(4,8)}-${exp}-${sig}`;
}

// SATU SUMBER KEBENARAN SALT (2026-09-04): products.salt (kartu produk di UI
// admin) didahulukan; SALT_BY_APP di bawah hanya fallback historis — selama
// kolom salt kosong, keluarannya identik dengan sebelumnya. Selaras dgn app
// klien yang memvalidasi pakai fetchProductSalt (products.salt juga).
async function resolveSalt(appType) {
  const meta = SALT_BY_APP[appType];
  if (!meta) return '';
  try {
    const rows = await sbQuery(
      `products?select=salt&kode_produk=eq.${encodeURIComponent(meta.prefix)}&app_type=eq.${encodeURIComponent(appType)}&limit=1`
    );
    const dbSalt = Array.isArray(rows) && rows[0] && rows[0].salt ? String(rows[0].salt) : '';
    if (dbSalt) return dbSalt;
  } catch (e) {
    console.warn('resolveSalt: products.salt tak terbaca — fallback konstanta:', e?.message || e);
  }
  return meta.salt;
}

async function sbQuery(path, method = 'GET', body = null) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(method === 'PATCH' ? { Prefer: 'return=representation' } : {}),
    },
    body: body ? JSON.stringify(body) : null,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`sb ${method} ${path}: ${res.status} ${txt.slice(0,200)}`);
  }
  return res.status === 204 ? null : res.json();
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
    if (!ADMIN_KEY) return json({ ok: false, error: 'ADMIN_API_KEY secret belum dipasang' }, 503);
    if (!timingSafeCompare(req.headers.get('x-admin-key') || '', ADMIN_KEY)) {
      return json({ ok: false, error: 'unauthorized' }, 401);
    }
    const { unit_id, app_type, device_code } = await req.json();
    if (!unit_id || !app_type || !device_code) {
      return json({ error: 'unit_id, app_type, device_code required' }, 400);
    }

    const serial = await generateSerial(app_type, device_code);

    // 1) update clients.license_* utk unit ini (device-bound session punya RLS,
    //    tapi di sini service_role yg nulis — status lisensi jadi server-verified)
    await sbQuery(`clients?unit_id=eq.${encodeURIComponent(unit_id)}`, 'PATCH', {
      license_status: 'aktif',
      license_serial: serial,
      license_expires_at: null, // seumur hidup
    });

    // 2) tandai pembelian milik unit ini (yang menunggu) sebagai aktif
    await sbQuery(`pembelian?unit_id=eq.${encodeURIComponent(unit_id)}&status=eq.menunggu_verifikasi`, 'PATCH', {
      status: 'aktif',
      serial,
      activated_at: new Date().toISOString(),
      license_status: 'aktif',
    });

    return json({ ok: true, app_type, unit_id, serial, exp: '99' });
  } catch (e) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
});

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
