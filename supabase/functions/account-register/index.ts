// ============================================================================
// account-register — Supabase Edge Function (Deno)
// Daftar AKUN KASOL (akun universal lintas app) dengan WhatsApp + PIN 6 digit.
// ============================================================================
// Kontrak (lihat docs/ACCOUNT-KASOL.md):
//   POST /functions/v1/account-register
//   body  { wa: string, pin: string, nama: string }
//   201   { ok: true, gid, wa, nama, licenses_attached }
//   400   { ok: false, code: 'invalid_wa'|'invalid_pin'|'invalid_nama', reason }
//   409   { ok: false, code: 'already_registered', reason }  → suruh MASUK
//   429   { ok: false, code: 'rate_limited', reason }
//   500   { ok: false, code: 'server_error' }
//
// Kenapa harus Edge Function (bukan dari browser):
//   membuat auth user WAJIB service_role. Key itu tidak boleh ada di bundle
//   mitra. Klien (mitra) memanggil endpoint ini dengan anon key, lalu sesi
//   login dibuat sendiri lewat Supabase Auth (signInWithPassword).
//
// Tanpa OTP, kepemilikan nomor BELUM terbukti → akun dicatat `pending`
// (phone_verified_at NULL). Verifikasi WA menyusul fase berikutnya.
//
// ENV WAJIB:
//   SUPABASE_URL                (otomatis di Supabase)
//   SUPABASE_SERVICE_ROLE_KEY   (otomatis / set manual)
//   ACCOUNT_CORS_ORIGIN         (mis. "https://mitra.kasirsolo.com,https://mitrabeta.vercel.app,http://localhost:13132")
// ============================================================================

const SB_URL = Deno.env.get('SUPABASE_URL') || '';
const SB_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
// Origin klien resmi yang SELALU diizinkan. Env `ACCOUNT_CORS_ORIGIN` MENAMBAH,
// bukan menggantikan — supaya origin yang sudah berjalan tidak hilang hanya
// karena secret di-rotate/tertimpa (fix 2026-11-09: Daftar dari rosok diblokir
// CORS sebab origin-nya belum ada di secret, padahal fungsi gagal-closed).
const BASELINE_ORIGINS = [
  // mitra (Akun Kasol)
  'https://mitra.kasirsolo.com',
  'https://mitrabeta.vercel.app',
  'http://localhost:13132',
  // kaki5
  'https://kaki5.kasirsolo.com',
  'https://kq5beta.vercel.app',
  'http://localhost:8086',
  'http://127.0.0.1:8086',
  // rosok
  'https://rosok.kasirsolo.com',
  'https://rosok-beta.vercel.app',
  'http://localhost:8084',
  'http://127.0.0.1:8084',
];
const ALLOWED_ORIGINS = Array.from(new Set([
  ...BASELINE_ORIGINS,
  ...(Deno.env.get('ACCOUNT_CORS_ORIGIN') || '')
    .split(',').map((s) => s.trim()).filter(Boolean),
]));

const EMAIL_DOMAIN = 'accounts.kasirsolo.local';
const MIN_PIN = 6;

function corsHeaders(origin: string | null): HeadersInit {
  // Fail-closed: origin tak terdaftar tidak mendapat izin CORS.
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : '';
  const h: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  if (allow) h['Access-Control-Allow-Origin'] = allow;
  return h;
}

const json = (body: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });

/** Normalisasi WA: 08xx / 8xx / +62xx → 62xx (sama dengan partner_norm_wa). */
function normWa(input: string): string | null {
  let v = String(input || '').replace(/[^0-9]/g, '');
  if (!v) return null;
  if (v.startsWith('0')) v = '62' + v.slice(1);
  else if (v.startsWith('8')) v = '62' + v;
  if (v.length < 9 || v.length > 15) return null;
  return v;
}

function emailFor(wa: string): string {
  return `${wa}@${EMAIL_DOMAIN}`;
}

/** RPC PostgREST pakai service_role (fungsi account_* hanya untuk service_role). */
async function rpc<T = Record<string, unknown>>(fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SB_SERVICE,
      Authorization: `Bearer ${SB_SERVICE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`rpc ${fn} gagal: ${res.status} ${text.slice(0, 200)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

/** Admin API: buat auth user + app_metadata.gid (server-only, tidak bisa dipalsukan). */
async function createAuthUser(email: string, pin: string, nama: string, gid: string): Promise<string> {
  const res = await fetch(`${SB_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SB_SERVICE,
      Authorization: `Bearer ${SB_SERVICE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password: pin,
      email_confirm: true,
      app_metadata: { gid, app_key: null, provider: 'email' },
      user_metadata: { nama },
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`createUser gagal: ${res.status} ${text.slice(0, 200)}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  const data = JSON.parse(text) as { id?: string };
  if (!data.id) throw new Error('createUser tidak mengembalikan id');
  return data.id;
}

async function deleteAuthUser(id: string): Promise<void> {
  try {
    await fetch(`${SB_URL}/auth/v1/admin/users/${id}`, {
      method: 'DELETE',
      headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` },
    });
  } catch { /* best-effort rollback */ }
}

// Rate limit ringan per IP (best-effort per instance; Supabase Auth yang jadi
// kontrol utama). 5 percobaan / 10 menit.
const HITS = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const win = 10 * 60 * 1000;
  const arr = (HITS.get(ip) || []).filter((t) => now - t < win);
  arr.push(now);
  HITS.set(ip, arr);
  return arr.length > 5;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, code: 'method_not_allowed' }, 405, origin);
  }
  if (!SB_URL || !SB_SERVICE) {
    console.error('account-register: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY kosong');
    return json({ ok: false, code: 'server_error' }, 500, origin);
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (rateLimited(ip)) {
    return json({ ok: false, code: 'rate_limited', reason: 'terlalu banyak percobaan, coba lagi nanti' }, 429, origin);
  }

  let body: { wa?: string; pin?: string; nama?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, code: 'invalid_body' }, 400, origin);
  }

  const nama = String(body.nama || '').trim();
  const pin = String(body.pin || '').trim();
  const wa = normWa(String(body.wa || ''));

  if (!wa) return json({ ok: false, code: 'invalid_wa', reason: 'nomor WhatsApp nggak valid' }, 400, origin);
  if (nama.length < 2) return json({ ok: false, code: 'invalid_nama', reason: 'nama minimal 2 huruf' }, 400, origin);
  if (!/^[0-9]{6,}$/.test(pin)) {
    return json({ ok: false, code: 'invalid_pin', reason: `PIN minimal ${MIN_PIN} digit angka` }, 400, origin);
  }

  let createdAuthId: string | null = null;
  try {
    const prep = await rpc<{ ok?: boolean; code?: string; reason?: string; gid?: string }>(
      'account_prepare_identity',
      { p_wa: wa, p_nama: nama },
    );
    if (!prep?.ok) {
      if (prep?.code === 'already_registered') {
        return json({ ok: false, code: 'already_registered', reason: 'nomor ini sudah punya akun. Coba masuk ya.' }, 409, origin);
      }
      return json({ ok: false, code: prep?.code || 'prepare_failed', reason: prep?.reason || '' }, 400, origin);
    }

    const gid = String(prep.gid);
    createdAuthId = await createAuthUser(emailFor(wa), pin, nama, gid);

    const bind = await rpc<{ ok?: boolean; code?: string; reason?: string }>(
      'account_bind_auth_user',
      { p_gid: gid, p_auth_user_id: createdAuthId },
    );
    if (!bind?.ok) {
      await deleteAuthUser(createdAuthId);
      createdAuthId = null;
      // Balapan: nomor terdaftar di antara prepare & bind.
      if (bind?.code === 'already_bound' || bind?.code === 'auth_user_taken') {
        return json({ ok: false, code: 'already_registered', reason: 'nomor ini sudah punya akun. Coba masuk ya.' }, 409, origin);
      }
      return json({ ok: false, code: bind?.code || 'bind_failed' }, 500, origin);
    }

    const attach = await rpc<{ ok?: boolean; clients_linked?: number; licenses_attached?: number }>(
      'account_attach_existing_licenses',
      { p_gid: gid },
    );

    // Kode referal OTOMATIS untuk setiap akun (keputusan pemilik 2026-11-03).
    // Gagal di sini TIDAK boleh menggagalkan pendaftaran — akun sudah jadi;
    // dashboard akan mencoba lagi lewat account_ensure_referral().
    let referralCode: string | null = null;
    try {
      const ref = await rpc<{ ok?: boolean; code?: string }>('account_ensure_referral_for_gid', { p_gid: gid });
      if (ref?.ok && ref.code) referralCode = String(ref.code);
    } catch (e) {
      console.error('account-register: pembuatan kode referal gagal (non-fatal):', e);
    }

    return json({
      ok: true,
      gid,
      wa,
      nama,
      referral_code: referralCode,
      licenses_attached: attach?.licenses_attached ?? 0,
      clients_linked: attach?.clients_linked ?? 0,
    }, 201, origin);
  } catch (e) {
    console.error('account-register error:', e);
    if (createdAuthId) await deleteAuthUser(createdAuthId);
    const status = (e as Error & { status?: number }).status;
    if (status === 422 || status === 400) {
      // Supabase Auth menolak (mis. email sudah dipakai / PIN lemah).
      return json({ ok: false, code: 'auth_rejected', reason: 'nomor ini sudah punya akun atau PIN tidak memenuhi syarat. Coba masuk ya.' }, 409, origin);
    }
    return json({ ok: false, code: 'server_error' }, 500, origin);
  }
});