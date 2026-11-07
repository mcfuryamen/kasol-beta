/**
 * Mock data mitra.
 * =============================================================================
 * Dipakai selama tabel `referral_partners` + RPC belum ada (Fase 1 belum mulai).
 * Begitu RPC-nya live, `src/lib/api.ts` otomatis pakai data live dan mock ini
 * nggak kepakai lagi — tidak ada yang perlu diedit di halaman.
 *
 * Angka-angka di sini MEWAKILI bentuk data yang akan dikirim RPC, supaya
 * transisi mock → live cuma ganti sumber data, bukan ganti markup.
 */

export type ReferralStatus = 'paid' | 'free' | 'pending';

export interface ReferralRow {
  /** Nama toko / calon pembeli (disamarkan di mock). */
  name: string;
  city: string;
  product: string;
  status: ReferralStatus;
  /** Poin yang diperoleh dari referral ini. */
  points: number;
  /** ISO date. */
  date: string;
}

export interface PayoutRow {
  id: string;
  date: string;
  points: number;
  amount: number;
  status: 'selesai' | 'diproses' | 'ditolak';
  note?: string;
}

export interface PartnerData {
  /** Sumber data — UI nampilin badge "data contoh" kalau masih mock. */
  source: 'live' | 'mock';
  name: string;
  city: string;
  /** 'licensed' = mitra punya lisensi (siklus payout 7 hari). */
  tier: 'licensed' | 'referral_only';
  status: 'aktif' | 'pending';
  /** Kode referal milik mitra. */
  code: string;
  /** Poin siap dicairkan. */
  pointsReady: number;
  /** Poin yang masih nunggu siklus payout. */
  pointsPending: number;
  /** Akumulasi seumur hidup. */
  pointsTotal: number;
  /** Jumlah orang yang pernah pakai kode. */
  referralCount: number;
  /** Jumlah yang beli lisensi (tier paid). */
  referralPaid: number;
  /** Siklus payout aktif, ikut status lisensi mitra. */
  payoutCycleDays: number;
  /** Tanggal payout berikutnya (ISO). */
  nextPayoutDate: string;
  referrals: ReferralRow[];
  payouts: PayoutRow[];
}

export const mockPartner: PartnerData = {
  source: 'mock',
  name: 'Warung Bu Tanti',
  city: 'Sukoharjo',
  tier: 'licensed',
  status: 'aktif',
  code: 'MKS-8F2K',
  pointsReady: 175,
  pointsPending: 25,
  pointsTotal: 200,
  referralCount: 4,
  referralPaid: 3,
  payoutCycleDays: 7,
  nextPayoutDate: '2026-11-02',
  referrals: [
    {
      name: 'Warung Sembako Jaya',
      city: 'Klaten',
      product: 'Kaki5',
      status: 'paid',
      points: 50,
      date: '2026-10-21',
    },
    {
      name: 'Toko Berkah 2',
      city: 'Sukoharjo',
      product: 'Rosok',
      status: 'paid',
      points: 50,
      date: '2026-10-18',
    },
    {
      name: 'Ruko Mama Readers',
      city: 'Karanganyar',
      product: 'Laundry',
      status: 'paid',
      points: 50,
      date: '2026-10-11',
    },
    {
      name: 'Warung Pak Anto',
      city: 'Sragen',
      product: 'Kaki5',
      status: 'free',
      points: 5,
      date: '2026-10-05',
    },
  ],
  payouts: [
    {
      id: 'PO-2412',
      date: '2026-10-19',
      points: 100,
      amount: 100000,
      status: 'selesai',
      note: 'Transfer BCA a.n. Tanti',
    },
    {
      id: 'PO-2308',
      date: '2026-10-05',
      points: 75,
      amount: 75000,
      status: 'selesai',
      note: 'Transfer BCA a.n. Tanti',
    },
  ],
};
