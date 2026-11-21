/**
 * Adapter referral — halaman `/r/<kode>` (pihak yang DIREKOMENDASIKAN).
 * =============================================================================
 * Kontrak RPC (semua `SECURITY DEFINER`, dipanggil pakai anon key):
 *
 *   partner_claim_referral(p_code, p_nama, p_wa, p_kota, p_app_type)
 *     → { ok, code, voucher_code, discount, min_purchase, points, expires_at }
 *
 * Catatan (2026-11-04): registrasi mitra pindah ke Akun Kasol (/akun). RPC
 * `partner_register` + helper `registerPartner()` DIHAPUS; halaman /daftar
 * dan komponen FormDaftar.astro sudah dibuang.
 *
 * BERSIHAN AUDIT 2026-11-18: seluruh jalur TOKEN portal (`partner_session`,
 * `partner_my_balance`, `partner_referrals`, `partner_payouts`, `payout_request`,
 * `partner_my_apps`, `partner_create_activation_code`) + fallback `mock.ts`
 * dihapus — dashboard mitra kini 100% sesi Akun Kasol (`src/lib/account.ts`).
 * Yang tersisa di file ini cuma alur klaim diskon untuk halaman /r.
 *
 * Sifatnya: kalau RPC-nya belum ada / gagal → `claimReferral` mengembalikan
 * null, dan UI menampilkan pesan gagal yang ramah (bukan crash).
 */
import { currentLang } from '../i18n/client';

/** Panggil RPC PostgREST. Return null kalau RPC belum ada / gagal (bukan error fatal). */
async function rpc<T>(fn: string, params: Record<string, unknown>): Promise<T | null> {
  if (!url || !anon) return null;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data ?? null) as T | null;
  } catch {
    return null;
  }
}

/* ── Kredensial Supabase untuk sisi browser ─────────────────────────────────
 * Dua sumber, berurutan:
 *   1. `__MKS_SUPABASE_*` — di-inject `astro.config.mjs` saat build (konektor
 *      Supabase di Vercel sync `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY`/
 *      `SUPABASE_ANON_KEY`, yang BUKAN env berawalan `PUBLIC_`).
 *   2. `import.meta.env.PUBLIC_SUPABASE_*` — env manual / dev lokal.
 * `SUPABASE_SECRET_KEY` / service-role TIDAK PERNAH dipakai di sini. */
declare const __MKS_SUPABASE_URL__: string;
declare const __MKS_SUPABASE_ANON_KEY__: string;

const buildUrl = typeof __MKS_SUPABASE_URL__ === 'undefined' ? '' : __MKS_SUPABASE_URL__;
const buildAnon =
  typeof __MKS_SUPABASE_ANON_KEY__ === 'undefined' ? '' : __MKS_SUPABASE_ANON_KEY__;

const url = (
  buildUrl ||
  (import.meta.env.PUBLIC_SUPABASE_URL as string | undefined) ||
  ''
).replace(/\/$/, '');
const anon = buildAnon || (import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined) || '';

/** Bahasa aktif — aman dipanggil di mana pun (fallback ID). */
function activeLang(): 'id' | 'en' {
  try {
    return currentLang() === 'en' ? 'en' : 'id';
  } catch {
    return 'id';
  }
}

/**
 * Susun pesan dari kode + nilai. Teksnya disusun di sini (bukan dari server)
 * supaya ikut bahasa aktif. Kalau kodenya nggak dikenal → pakai fallback
 * (biasanya pesan Bahasa Indonesia dari server).
 */
function localizeMsg(
  map: Record<string, { id: string; en: string }>,
  code?: string,
  value?: string | number,
  fallback?: string
): string {
  const msg = code ? map[code] : undefined;
  if (!msg) return fallback ?? '';
  const lang = activeLang();
  let text = msg[lang];
  if (text.includes('{v}')) {
    const num = Number(value);
    const shown = Number.isFinite(num)
      ? num.toLocaleString(lang === 'en' ? 'en-US' : 'id-ID')
      : String(value ?? '');
    text = text.replace('{v}', shown);
  }
  return text;
}

/** Pesan error pendaftaran mitra + klaim referral. */
const MITRA_MSG: Record<string, { id: string; en: string }> = {
  invalid_nama: {
    id: 'Nama minimal 2 huruf.',
    en: 'Your name needs at least 2 characters.',
  },
  invalid_wa: {
    id: 'Nomor WhatsApp nggak valid. Contoh: 081234567890.',
    en: 'Invalid WhatsApp number. Example: 081234567890.',
  },
  invalid_input: {
    id: 'Nama dan WhatsApp wajib diisi.',
    en: 'Name and WhatsApp are required.',
  },
  already_active: {
    id: 'Nomor ini sudah terdaftar. Cek link portal di WhatsApp lo.',
    en: 'This number is already registered. Check your portal link in WhatsApp.',
  },
  rate_limited: {
    id: 'Ramai banget nih, coba lagi nanti ya.',
    en: 'Too many signups right now, try again later.',
  },
  invalid_code: {
    id: 'Kode referral nggak ketemu.',
    en: 'Referral code not found.',
  },
  code_expired: {
    id: 'Kode ini udah nggak berlaku.',
    en: 'This code has expired.',
  },
  partner_inactive: {
    id: 'Mitranya lagi nggak aktif.',
    en: 'That partner is not active right now.',
  },
  self_referral: {
    id: 'Nggak bisa pakai kode sendiri.',
    en: "You can't use your own code.",
  },
  already_claimed: {
    id: 'Kode referalnya udah pernah lo pakai.',
    en: 'You have already used this referral code.',
  },
};

/** Pesan error pendaftaran/klaim sesuai bahasa aktif. */
export function localizeMitraError(
  code?: string,
  value?: string | number,
  fallback?: string
): string {
  return localizeMsg(MITRA_MSG, code, value, fallback || 'Gagal diproses. Coba lagi ya.');
}

export interface ClaimPayload {
  code: string;
  nama: string;
  wa: string;
  kota: string;
  appType?: string;
}

export interface ClaimResult {
  ok: boolean;
  /** Kode diskon yang perlu dipakai saat beli lisensi. */
  voucherCode?: string;
  /** Kode referral mitra. */
  code?: string;
  /** Nominal diskon (Rp). */
  discount?: number;
  /** Minimal belanja (Rp). */
  minPurchase?: number;
  /** Poin yang didapat mitra (5 = belum beli lisensi). */
  points?: number;
  expiresAt?: string;
  /** True = ini klaim ulang (sudah pernah). */
  already?: boolean;
  reason?: string;
  errorCode?: string;
}

/**
 * Klaim diskon dari kode referral (halaman /r/<kode>).
 * Catat ledger reward → mitra dapat poin pending; refereenya dapat voucher diskon.
 */
export async function claimReferral(payload: ClaimPayload): Promise<ClaimResult | null> {
  const res = await rpc<{
    ok?: boolean;
    code?: string;
    voucher_code?: string;
    discount?: number;
    min_purchase?: number;
    points?: number;
    expires_at?: string;
    already?: boolean;
    reason?: string;
  }>('partner_claim_referral', {
    p_code: payload.code,
    p_nama: payload.nama,
    p_wa: payload.wa,
    p_kota: payload.kota,
    p_app_type: payload.appType ?? '',
  });

  if (!res) return null;
  if (res.ok) {
    return {
      ok: true,
      voucherCode: res.voucher_code,
      code: res.code,
      discount: res.discount,
      minPurchase: res.min_purchase,
      points: res.points,
      expiresAt: res.expires_at,
      already: res.already,
      reason: res.already ? localizeMitraError('already_claimed') : undefined,
    };
  }
  return {
    ok: false,
    errorCode: res.code,
    reason: localizeMitraError(res.code, undefined, res.reason),
  };
}
