/**
 * Adapter data mitra — portal P0.
 * =============================================================================
 * Kontrak RPC (semua `SECURITY DEFINER`, dipanggil pakai anon key):
 *
 *   partner_session(p_token text)
 *     → { ok, partner_id, client_id, code, status, tier, has_license,
 *         payout_cycle_days, next_payout_date, nama, kota }
 *     `has_license` = mitra punya lisensi aktif → payout per 7 hari
 *                    | referral-only                → payout per 30 hari
 *     (`tier` = bronze/silver/gold — level mitra, beda dari siklus payout)
 *
 *   partner_my_balance(p_token text)
 *     → { points_ready, points_pending, points_total, rupiah_balance, withdrawable }
 *
 *   partner_referrals(p_token text)   → [{ name, city, product, status, points, date }]
 *   partner_payouts(p_token text)     → [{ id, date, points, amount, status, note }]
 *   payout_request(p_token text, p_points int, p_amount numeric,
 *                  p_type text, p_bank_info text)
 *     → { ok, id, amount, points, status, message } | { ok: false, reason }
 *
 * CATATAN KONTRAK: semua RPC portal berbasis TOKEN, bukan partner_id —
 * kalau parameternya bebas, siapa pun bisa nunjuk wallet mitra orang lain.
 * Token dicek di dalam fungsi. Lihat docs/ADR-VOUCHER-REFERRAL.md §5.
 *
 * Sifatnya:kalau RPC-nya belum ada (Fase 1 belum jalan), PostgREST balas 404
 * → adapter jatuh ke MOCK. Nggak ada error, nggak ada banner merah — UI cuma
 * nampilin badge "data contoh". Begitu RPC-nya live, sumber data otomatis
 * berubah tanpa ada yang perlu diedit di halaman.
 */
import { mockPartner, type PartnerData } from './mock';
import { site } from '../data/site';
import { currentLang } from '../i18n/client';

/**
 * Kredensial Supabase untuk sisi browser.
 *
 * Dua sumber, berurutan:
 *   1. `__MKS_SUPABASE_*` — di-inject `astro.config.mjs` saat build. Istilahnya
 *      yang bikin Vite bisa meng-inline nilai yang nama env-nya BUKAN `PUBLIC_`
 *      (konektor Supabase di Vercel sync `SUPABASE_URL` +
 *      `SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_ANON_KEY`).
 *   2. `import.meta.env.PUBLIC_SUPABASE_*` — env manual / dev lokal.
 *
 * `SUPABASE_SECRET_KEY` / service-role TIDAK pernah dipakai di sini — itu
 * server-side, dan bocor ke bundle = anybody bisa nulis DB.
 */
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
const anon =
  buildAnon || (import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined) || '';

const hasCreds = Boolean(url && anon);

/** Panggil RPC PostgREST. Return null kalau RPC belum ada / gagal (bukan error fatal). */
async function rpc<T>(fn: string, params: Record<string, unknown>): Promise<T | null> {
  if (!hasCreds) return null;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: anon as string,
        Authorization: `Bearer ${anon as string}`,
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

/** Ambil token akses dari query string — auth portal = token via WA (ADR D3). */
export function tokenFromUrl(): string | null {
  if (typeof location === 'undefined') return null;
  const t = new URLSearchParams(location.search).get('t');
  return t && t.trim() ? t.trim() : null;
}

interface SessionRow {
  ok?: boolean;
  partner_id?: string;
  client_id?: string;
  code?: string;
  status?: string;
  tier?: string;
  has_license?: boolean;
  nama?: string;
  kota?: string;
  payout_cycle_days?: number;
  next_payout_date?: string;
}

interface BalanceRow {
  points_ready?: number;
  points_pending?: number;
  points_total?: number;
  rupiah_balance?: number;
  withdrawable?: number;
}

/**
 * Ambil data portal mitra.
 * Sumber live kalau RPC tersedia; kalau tidak → mock.
 */
export async function getPartner(): Promise<PartnerData> {
  const token = tokenFromUrl();

  if (token) {
    const session = await rpc<SessionRow>('partner_session', { p_token: token });
    if (session?.ok) {
      const [balance, referrals, payouts] = await Promise.all([
        rpc<BalanceRow>('partner_my_balance', { p_token: token }),
        rpc<PartnerData['referrals']>('partner_referrals', { p_token: token }),
        rpc<PartnerData['payouts']>('partner_payouts', { p_token: token }),
      ]);

      if (balance) {
        return {
          source: 'live',
          name: session.nama ?? 'Mitra',
          city: session.kota ?? '',
          tier: session.has_license ? 'licensed' : 'referral_only',
          status: session.status === 'aktif' ? 'aktif' : 'pending',
          code: session.code ?? '',
          pointsReady: balance.points_ready ?? 0,
          pointsPending: balance.points_pending ?? 0,
          pointsTotal: balance.points_total ?? 0,
          referralCount: referrals?.length ?? 0,
          referralPaid: (referrals ?? []).filter((r) => r.status === 'paid').length,
          payoutCycleDays: session.payout_cycle_days ?? 30,
          nextPayoutDate: session.next_payout_date ?? '',
          referrals: referrals ?? [],
          payouts: payouts ?? [],
        };
      }
    }
  }

  return mockPartner;
}

/** Template pesan share ke WhatsApp. */
export function shareText(code: string, name: string): string {
  return [
    `Halo, gue ${name}.`,
    '',
    'Gue pakai aplikasi kasir dari PT Mesin Kasir Solo.',
    `Kalau lo butuh kasir, daftar lewat kode gue: ${code}`,
    '',
    'Cek di https://mitra.kasirsolo.com',
  ].join('\n');
}

/** Minimal pencairan (ADR §7.2 + §7.3). */
export const MIN_PAYOUT = 50000;

export interface PayoutRequest {
  /** Nominal rupiah yang diminta. */
  amount: number;
  /** Poin yang dipakai (1 poin = Rp 1.000). */
  points: number;
  /** Rekening tujuan: bank, nomor, atas nama. */
  bank: string;
  /** Nama mitra (dipakai di pesan WhatsApp). */
  name: string;
  /** Kode referal mitra. */
  code: string;
}

/** Susun pesan request pencairan untuk WhatsApp. */
export function payoutText(req: PayoutRequest): string {
  return [
    'Halo MKS, gue mau request pencairan komisi.',
    '',
    `Nama: ${req.name}`,
    `Kode: ${req.code}`,
    `Jumlah: Rp ${req.amount.toLocaleString('id-ID')} (${req.points} poin)`,
    `Rekening: ${req.bank}`,
    '',
    'Mohon dicek ya, gue tunggu transfernya. Makasih.',
  ].join('\n');
}

export interface PayoutResult {
  /** 'rpc' = request tercatat di database · 'wa' = jatuh ke pesan WhatsApp. */
  via: 'rpc' | 'wa';
  /** Alasan penolakan dari server (kalau live & ditolak) — sudah sesuai bahasa aktif. */
  reason?: string;
}

/**
 * Pesan penolakan pencairan. Server kirim `code` + `value` (angka yg relevan),
 * teksnya disusun di sini supaya ikut bahasa aktif (ID/EN).
 * `reason` dari server (Bahasa Indonesia) dipakai sebagai fallback kalau
 * `code-nya` belum dikenal versi app ini.
 */
const PAYOUT_MSG: Record<string, { id: string; en: string }> = {
  invalid_token: {
    id: 'Token tidak valid atau kedaluwarsa.',
    en: 'Invalid or expired token.',
  },
  not_active: { id: 'Status mitra: {v}.', en: 'Partner status: {v}.' },
  invalid_points: {
    id: 'Jumlah poin harus lebih dari 0.',
    en: 'Point amount must be more than 0.',
  },
  min_payout: { id: 'Minimal pencairan Rp {v}.', en: 'Minimum payout is Rp {v}.' },
  max_payout: {
    id: 'Maksimal pencairan per request Rp {v}.',
    en: 'Maximum payout per request is Rp {v}.',
  },
  amount_mismatch: {
    id: 'Nominal harus sama dengan poin x Rp 1.000.',
    en: 'The amount must match your points x Rp 1,000.',
  },
  cycle: {
    id: 'Sudah ada request pencairan di siklus ini (1x per {v} hari).',
    en: 'You already requested a payout in this cycle (once every {v} days).',
  },
  no_wallet: {
    id: 'Saldo belum diinisialisasi.',
    en: 'Your balance has not been set up yet.',
  },
  insufficient: {
    id: 'Saldo poin belum cukup (tersedia {v} poin).',
    en: 'Not enough points available ({v} points).',
  },
};

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

/** Susun pesan penolakan sesuai bahasa aktif. */
export function localizePayoutError(
  code?: string,
  value?: string | number,
  fallback?: string
): string {
  return localizeMsg(PAYOUT_MSG, code, value, fallback || 'Permintaan pencairan gagal.');
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

/**
 * Request pencairan.
 *
 * Kalau portal-nya live (token valid + RPC `payout_request` ada) → dikirim
 * lewat RPC, hasilnya `rpc`. Kalau belum live / RPC-nya belum ada → dikembalikan
 * `wa`, dan pemanggil yang membuka WhatsApp (popup harus dibuka sinkron di
 * dalam event klik, jadi caller pegang responsibility-nya).
 *
 * Kalau live tapi server MENOLAK (mis. minimal pencairan, saldo kurang,
 * sudah request di siklus ini) → `reason` diisi, caller harus nampilin
 * alasannya — bukan bargeun "sukses".
 *
 * Catatan: pencairan tetap diproses manual oleh tim kami — RPC cuma mencatat
 * request-nya, bukan mentransfer uang (ADR §7.3).
 */
export async function requestPayout(req: PayoutRequest): Promise<PayoutResult> {
  const token = tokenFromUrl();

  if (token) {
    const session = await rpc<SessionRow>('partner_session', { p_token: token });
    if (session?.ok) {
      const res = await rpc<{ ok?: boolean; code?: string; value?: string | number; reason?: string }>(
        'payout_request',
        {
          p_token: token,
          p_points: req.points,
          p_amount: req.amount,
          p_type: 'withdraw',
          p_bank_info: req.bank,
        }
      );
      if (res?.ok) return { via: 'rpc' };
      if (res && (res.code || res.reason)) {
        return { via: 'rpc', reason: localizePayoutError(res.code, res.value, res.reason) };
      }
    }
  }

  return { via: 'wa' };
}

/** Nomor WhatsApp tujuan request pencairan. */
export const WA_NUMBER = site.whatsapp;

/* =============================================================================
 * MODUL REGISTRASI MITRA + PENCATATAN REFERRAL (Fase 2)
 * =============================================================================
 * partner_register(p_nama, p_wa, p_kota, p_provinsi, p_email, p_produk, p_catatan)
 *   → { ok, partner_id, code, nama, kota, portal_token }
 *   · Registrasi TANPA verifikasi WA (keputusan owner 26/10) → langsung aktif,
 *     langsung dapat kode referral + link portal.
 *   · WA yang sudah terdaftar → DITOLAK, token nggak pernah dikasih ulang.
 *
 * partner_claim_referral(p_code, p_nama, p_wa, p_kota, p_app_type)
 *   → { ok, code, voucher_code, discount, min_purchase, points, expires_at }
 *   · Dipakai halaman /r/<kode> (pihak yang direkomendasikan).
 * ============================================================================= */

export interface RegisterPayload {
  nama: string;
  wa: string;
  kota: string;
  catatan: string;
}

export interface RegisterResult {
  ok: boolean;
  /** Kode referral mitra (kalau sukses). */
  code?: string;
  nama?: string;
  /** Token portal — buat link /portal?t=... (sekali, nggak bisa diambil lagi). */
  portalToken?: string;
  /** Alasan penolakan (sudah sesuai bahasa aktif). */
  reason?: string;
  /** Kode error dari server (untuk log/analitik). */
  errorCode?: string;
}

/**
 * Daftar mitra.
 * `null` = RPC-nya belum ada / jaringan gagal → caller fallback ke WhatsApp.
 */
export async function registerPartner(
  payload: RegisterPayload
): Promise<RegisterResult | null> {
  const res = await rpc<{
    ok?: boolean;
    code?: string;
    nama?: string;
    portal_token?: string;
    reason?: string;
  }>('partner_register', {
    p_nama: payload.nama,
    p_wa: payload.wa,
    p_kota: payload.kota,
    p_provinsi: null,
    p_email: null,
    // '*' = semua produk. Kode referral mitra universal (ADR §14.2).
    p_produk: '*',
    p_catatan: payload.catatan,
  });

  if (!res) return null;
  if (res.ok) {
    return {
      ok: true,
      code: res.code,
      nama: res.nama,
      portalToken: res.portal_token,
    };
  }
  return {
    ok: false,
    errorCode: res.code,
    reason: localizeMitraError(res.code, undefined, res.reason),
  };
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
