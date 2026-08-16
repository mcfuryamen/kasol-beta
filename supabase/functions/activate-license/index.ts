// ============================================================================
// activate-license — Supabase Edge Function (Deno)
// Aktivasi lisensi setelah pembayaran diverifikasi.
// Input: { unit_id, app_type }
// Process:
//   1. Generate serial HMAC (salt dari SALT_BY_APP)
//   2. Update clients.license_* (device-bound)
//   3. Update pembelian.status = 'aktif'
//   4. Emit realtime event ke channel license-updates:{unit_id}
// ============================================================================

const BASE32 = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

// app_type -> prefix & salt (HARUS sama dengan PRODUCT_SALT di tiap app klien)
const SALT_BY_APP = {
  kaki5:   { prefix: 'KK5', salt: 'KASIRSOLO-KAKI5-HMAC-V2' },
  rosok:   { prefix: 'KSR', salt: 'KASIRSOLO-ROSOK-HMAC-V2' },
  gerobak: { prefix: 'GBK', salt: 'KASIRSOLO-GEROBAK-HMAC-V2' },
  retail:  { prefix: 'RTL', salt: 'KASIRSOLO-RETAIL-HMAC-V2' },
};

const SB_URL = Deno.env.get('SUPABASE_URL') || '';
const SB_KEY = Deno.env.get('SERVICE_ROLE_KEY') || '';

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
  const deviceCode = normalizeDeviceCode(deviceCodeRaw);
  const exp = '99'; // seumur hidup
  const sig = await hmacSignature(meta.salt, deviceCode + exp);
  return `${meta.prefix}-${deviceCode.slice(0,4)}-${deviceCode.slice(4,8)}-${exp}-${sig}`;
}

async function sbQuery(path, method = 'GET', body = null) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: ***
      Authorization: *** ${SB_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : null,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`sb ${method} ${path}: ${res.status} ${txt.slice(0,200)}`);
  }
  return res.status === 204 ? null : res.json();
}

async function publishEvent(channel, event) {
  // Menggunakan Supabase Realtime dengan mengirimkan payload ke endpoint
  // Catatan: Supabase Edge Functions tidak bisa langsung publish ke channel.
  // Solusi: update clients.license_status yang akan trigger real-time secara otomatis
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
    
    const { unit_id, app_type, device_code } = await req.json();
    
    if (!unit_id || !app_type || !device_code) {
      return json({ 
        ok: false, 
        error: 'unit_id, app_type, device_code required' 
      }, 400);
    }

    // 1. Generate serial
    const serial = await generateSerial(app_type, device_code);
    
    // 2. Update clients.license_* + pipeline (device-bound, service_role bypass RLS)
    await sbQuery(
      `clients?unit_id=eq.${encodeURIComponent(unit_id)}`, 
      'PATCH', 
      {
        license_status: 'aktif',
        license_serial: serial,
        license_expires_at: null, // seumur hidup
        status: 'aktif', // pipeline
        activated_at: new Date().toISOString(),
      }
    );

    // (fase lama: tabel pembelian sudah dikonsolidasi ke clients, tidak lagi di-update)

    // 3. Broadcast via realtime (client akan detect perubahan di clients table)
    // Realtime Supabase akan otomatis broadcast perubahan ini ke subscriber
    
    return json({ 
      ok: true, 
      app_type, 
      unit_id, 
      serial,
      message: 'Lisensi berhasil diaktifkan'
    });
  } catch (e) {
    console.error('activate-license error:', e);
    return json({ 
      ok: false, 
      error: String(e?.message || e) 
    }, 500);
  }
});

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
