/**
 * i18n — kamus bahasa untuk app MITRA (Program Mitra / referral & afiliasi).
 * =============================================================================
 * Bahasa KANONIK = Indonesia (HTML yang ditulis). EN adalah override opsional:
 * hanya key yang punya entri di `EN` yang berubah saat user pindah ke English.
 * Nilai boleh berisi markup (span/br) — dipakai lewat innerHTML oleh client.
 *
 * Cara pakai: beri atribut data-i18n="kunci" pada elemen (teks/innerHTML),
 * data-i18n-aria="kunci" untuk aria-label, data-i18n-ph="kunci" untuk
 * placeholder.
 *
 * Blok `mitra.*` = narasi halaman program (dipindah dari app `company/`
 * tanpa diubah isinya — sumber aslinya docs/ADR-VOUCHER-REFERRAL.md §14.4).
 * Blok `m.*` = navigasi, section portal di landing, dan halaman link referal
 * (halaman daftar/portal lama sudah dihapus — pendaftaran lewat /akun).
 */

export const LANGS = ['id', 'en'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'id';
export const STORAGE_KEY = 'mks-lang';

/** Override English. Key tanpa entri = tetap bahasa Indonesia. */
export const EN: Record<string, string> = {
  // ── Navigasi app mitra ──
  'nav.aria.lang': 'Switch language / Ganti bahasa',
  'nav.aria.top': 'Back to top',
  'tab.aria.utama': 'Main navigation',
  'm.nav.program': 'Program',
  'm.nav.cara': 'How It Works',
  'm.nav.faq': 'FAQ',
  'm.nav.akun': 'Account',
  'm.nav.masuk': 'Partner Login',
  'm.tab.beranda': 'Home',
  'm.tab.program': 'Program',
  'm.tab.daftar': 'Sign Up',

  // ── Footer ──
  'm.footer.tagline':
    'Partner program for anyone who recommends our POS apps. Point people to us, they get a discount, you get commission.',
  'm.footer.kantorLegal': 'LEGAL OFFICE',
  'm.footer.kantorOps': 'OPERATIONS OFFICE',
  'm.footer.whatsapp': 'WHATSAPP',
  'm.footer.chatFounder': 'Chat with the Founder',
  'm.footer.privasi': 'Privacy',
  'm.footer.syarat': 'Terms & Conditions',
  'm.footer.program': 'Partner Program',
  'm.footer.akun': 'Kasol Account',
  'm.footer.kasir': 'Our POS Apps',
  'm.footer.hardware': 'Hardware',
  'm.footer.tentang': 'About Us',
  'm.footer.portfolio': 'Clients & Portfolio',
  'm.footer.area': 'Service Area',
  'm.footer.hubungi': 'Contact Us',
  'm.footer.situsUtama': 'Main site',

  // ── Halaman program (dipindah dari company/mitra.astro) ──
  'mitra.heroBadge': 'Partner Program',
  'mitra.heroTitle': 'You Point, They Buy, <span class="accent">You Earn.</span>',
  'mitra.heroSub':
    'No reselling, no stock, no capital. Just tell whoever needs a POS system — they get a discount, you get a commission you can cash out.',
  'mitra.heroCta': 'Sign Up as a Partner',
  'mitra.heroCta2': 'How It Works',
  'mitra.whyBadge': 'Why It’s Worth It',
  'mitra.whyTitle': 'You Only <span class="hl">Point</span>, Not Sell Merchandise',
  'mitra.whySub':
    'No stock to keep, no capital to spend, nothing to ship. Just a recommendation — and it costs you nothing.',
  'mitra.adv1T': 'No Capital, No Stock',
  'mitra.adv1D':
    'All you do is share your code over WhatsApp. No upfront capital, nothing to keep in stock, nothing to ship. If nobody buys, you lose nothing.',
  'mitra.adv2T': 'Commission Runs Itself',
  'mitra.adv2D':
    'The moment someone buys a license through your code, your commission shows up. You can check it yourself: how many signed up, how many paid, how much you earned.',
  'mitra.adv3T': 'Cash Out, or Offset a License',
  'mitra.adv3D':
    'Your commission can be withdrawn to your bank account, or deducted from the price of your own license. Pick whatever makes more sense for you.',
  'mitra.winBadge': 'Everybody Wins',
  'mitra.winTitle': 'Not <span class="hl">Zero-Sum</span>',
  'mitra.winSub':
    'Not a zero-sum game — not one person profiting while another loses. The moment someone buys a license through your code, they get a discount and you get a commission. Everybody wins: you add a sale, and that commission lands straight in your balance.',
  'mitra.winYou': 'For You (The Partner)',
  'mitra.winThem': 'For Them (The Buyer)',
  'mitra.winL1': 'Commission on every sale',
  'mitra.winR1': 'A discount on their first license',
  'mitra.winL2': 'Your own personal referral code',
  'mitra.winR2': 'Instant license activation, no waiting',
  'mitra.winL3': 'You can check your history and balance yourself',
  'mitra.winR3': 'Pay once, use it for life',
  'mitra.winL4': 'Withdraw to bank or offset a license',
  'mitra.winR4': 'WhatsApp support, all in one place',
  'mitra.stepsBadge': 'Three Steps',
  'mitra.stepsTitle': 'Dead <span class="hl">Simple</span>',
  'mitra.stepsSub': 'Two minutes to sign up, then just share your code.',
  'mitra.step1T': 'Sign Up',
  'mitra.step1D':
    'Name, WhatsApp number, city. Two minutes and you’re done. You don’t need a license to start recommending.',
  'mitra.step2T': 'Get Your Code',
  'mitra.step2D':
    'Once your WhatsApp is verified, your referral code is issued. You also get a ready-made share template, so you don’t have to write anything.',
  'mitra.step3T': 'Share and Collect',
  'mitra.step3D':
    'Send it to your WhatsApp group, your store, or neighbors who need a POS. Anyone who buys through your code earns you a commission. No limit on how many.',
  'mitra.faqBadge': 'FAQ',
  'mitra.faqTitle': 'Still <span class="hl">Curious</span>?',
  'mitra.faqSub': 'The things people ask most before signing up.',
  'mitra.faq1Q': 'Do I really not need any capital?',
  'mitra.faq1A':
    'Really. No upfront capital, no stock, no shipping. You just point people to our app. If nobody buys, you lose nothing.',
  'mitra.faq2Q': 'What if the person I referred doesn’t buy?',
  'mitra.faq2A':
    'Your code stays valid and isn’t used up — you can keep sharing it with anyone else. That person just isn’t counted as your sale, so there’s no commission for them. The rest of your code keeps working.',
  'mitra.faq3Q': 'How do I cash out my commission?',
  'mitra.faq3A':
    'Your commission goes into your balance and accumulates, but the timing depends on your status. If you hold a license — a client who also gives referrals — you can cash out every 7 days. If you only refer people and hold no license at all, your commission comes in every 30 days. Request a payout, minimum Rp 50,000, and I’ll transfer it straight to your account.',
  'mitra.faq4Q': 'Does one code cover every app?',
  'mitra.faq4A':
    'Yes. Your referral code works across all our POS apps. So you only share one link, and anyone who buys through it still adds to your commission.',
  'mitra.clearTitle': 'So There’s <span class="hl">No Confusion</span>',
  'mitra.clearL1':
    '<b>In this program</b> — a partner is someone who recommends us. You don’t need a license for that: it can be an affiliate/reseller focused on selling, or an existing <b>client</b> who recommends on the side.',
  'mitra.clearL2':
    '<b>On the home page</b> — “Mitra Mesin Kasir” is the label for the people who use our POS app.',
  'mitra.clearNote':
    'Both can be true at once. You can use the app yourself and still recommend us for commission.',
  'mitra.formBadge': 'Sign Up',
  'mitra.formTitle': 'Sign Up <span class="hl">Now</span>',
  'mitra.formSub':
    'Sign-up is via <strong>Akun Kasol</strong>: one account for all apps. Enter your WhatsApp number + PIN, then activate the partnership from your account dashboard.',
  'mitra.formCtaAkun': 'Create Account / Sign In',

  // ── Section portal (khusus app terpisah) ──
  'm.portalBadge': 'Partner Portal',
  'm.portalTitle': 'Everything in <span class="hl">One Dashboard</span>',
  'm.portalSub':
    'Your code, your balance, your payout — all in one place. No need to chat the founder every time you want to check.',
  'm.portalF1T': 'Your Code',
  'm.portalF1D': 'One code, works across every app. Copy it, share it to WhatsApp, done.',
  'm.portalF2T': 'Points & Balance',
  'm.portalF2D': 'See points ready to withdraw and points still in the payout cycle. Real-time, no guessing.',
  'm.portalF3T': 'Request a Payout',
  'm.portalF3D':
    'Request a payout once your cycle completes. Minimum Rp 50,000, transferred straight to your account.',
  'm.portalCta': 'Open Akun Kasol',

  // ── Halaman link referal (/r/[code]) ──
  'm.pSalinOk': 'Copied!',
  'm.refTitle': 'You’ve Been Referred',
  'm.refSub': 'Use this code to get a discount on your first license.',
  'm.refCode': 'Referral code',
  'm.refCopy': 'Copy',
  'm.refPilih': 'Choose your app',
  'm.refCta': 'Get the Discount',
  'm.refNote':
    'The code applies automatically when you redeem it inside the app. One code works for every app.',
  'm.refDari': 'Referred by',
  'm.refInvalid': 'This code is not valid',
  'm.refInvalidSub':
    'Check the link again. If it still does not work, ask your partner for the code directly.',
  'm.refMasuk': 'See the Partner Program',

  // ── Klaim diskon dari kode referral (/r/<kode>) ──
  'm.claimTitle': 'Claim your discount',
  'm.claimSub':
    'Fill in your name and WhatsApp — your discount code is ready right away, and you join the partner program of whoever referred you.',
  'm.claimNama': 'Name',
  'm.claimWa': 'WhatsApp Number',
  'm.claimKota': 'City',
  'm.claimApp': 'Product you want to buy',
  'm.claimAppSemua': 'All apps',
  'm.claimBtn': 'Get my discount code',
  'm.claimSudah': 'You already claimed this code. Keep it safe.',
  'm.claimOkTitle': 'Your discount code is ready!',
  'm.claimVoucher': 'Your discount code',
  'm.claimValue': 'Discount value',
  'm.claimMin': 'Minimum purchase',
  'm.claimExpiry': 'Valid until',
  'm.claimNote':
    'Save this code and show it to our team when you buy a license — the discount comes straight off the price.',
  'm.claimNamaPh': 'Your name',
  'm.claimWaPh': '628xxxxxxxxxx',
  'm.claimKotaPh': 'Your city',

  // ── Halaman Akun Kasol (/akun) — funnel + dashboard (i18n audit 2026-11-18) ──
  'ak.back': '← Partner Program',
  'ak.heroTitle': 'One <span class="hl">Account</span>, Every App',
  'ak.heroSub':
    'Use your WhatsApp number + PIN. From this account you can see active licenses, buy licenses for other apps, and become a partner — no separate accounts.',
  'ak.notReady': 'Accounts are not available on this server yet. Contact admin.',
  'ak.tabMasuk': 'Sign In',
  'ak.tabDaftar': 'Sign Up',
  'ak.fWa': 'WhatsApp Number',
  'ak.fPin': 'PIN',
  'ak.btnMasuk': 'Sign In',
  'ak.fNama': 'Name',
  'ak.fPin6': 'PIN (6 digits)',
  'ak.fPinUlang': 'Repeat PIN',
  'ak.btnCreate': 'Create Account',
  'ak.daftarHint':
    'Your WhatsApp number is not automatically verified at this stage. Do not use someone else’s number — the account can be frozen.',
  'ak.btnLogout': 'Log Out',
  'ak.tabProfil': 'Profile',
  'ak.tabLic': 'Licenses',
  'ak.tabRef': 'Referral',
  'ak.statLic': 'Active licenses',
  'ak.statDev': 'Devices',
  'ak.statRef': 'Referrals',
  'ak.statPoin': 'Points ready',
  'ak.profilTitle': 'Personal Data',
  'ak.profilNote':
    'Display name & domicile help us process commission payouts. Changes here also sync to your app client data. Your WhatsApp number is your login identity — it cannot be changed here.',
  'ak.fDisplayName': 'Display name',
  'ak.fotoJudul': 'Profile Photo',
  'ak.fotoNote':
    'This photo appears in the top-right corner of the apps. JPG or PNG format.',
  'ak.btnPilihFoto': 'Choose Photo',
  'ak.btnHapusFoto': 'Delete Photo',
  'ak.fProv': 'Province',
  'ak.fKota': 'Regency/City',
  'ak.fKec': 'District',
  'ak.fDesa': 'Village',
  'ak.fAddr': 'Detailed address',
  'ak.btnSave': 'Save Changes',
  'ak.secTitle': 'Security',
  'ak.secNote': 'Your PIN is used to sign in to every Kasol app. Never share it with anyone.',
  'ak.fPinNew': 'New PIN (6 digits)',
  'ak.fPinNew2': 'Repeat new PIN',
  'ak.btnSavePin': 'Save PIN',
  'ak.helpTitle': 'Help',
  'ak.helpNote':
    'Forgot PIN, registered the wrong number, or need to move devices? Chat admin — replies during working hours.',
  'ak.btnChatAdmin': '💬 Chat admin on WhatsApp',
  'ak.refTitle': 'Referral Code',
  'ak.refNote':
    'Active since you signed up — <strong>universal</strong>, works across all Kasol apps. Friends who use this code get a discount, you get a commission. Use it or not, up to you.',
  'ak.btnCopy': 'Copy',
  'ak.btnShareWa': '💬 Share to WhatsApp',
  'ak.saldoTitle': 'Commission Balance',
  'ak.saldoReady': 'Ready to withdraw',
  'ak.saldoPending': 'Pending (awaiting cycle)',
  'ak.saldoRupiah': 'Cash balance',
  'ak.btnRequestPayout': 'Request Withdrawal',
  'ak.refLastTitle': 'Recent Referrals',
  'ak.refEmpty': 'No referrals yet.',
  'ak.refEmptyShare': 'No referrals yet. Share your code to get started.',
  'ak.payoutHistTitle': 'Withdrawal History',
  'ak.payoutEmpty': 'No withdrawals yet.',
  'ak.modalTitle': 'Request Withdrawal',
  'ak.btnClose': 'Close',
  'ak.payoutHint': 'Minimum Rp 50,000 · 1 point = Rp 1,000 · 1 request per cycle.',
  'ak.fPoints': 'Points to withdraw',
  'ak.fAmount': 'Amount (Rp)',
  'ak.fBank': 'Destination bank account',
  'ak.licTitle': 'My Apps',
  'ak.licLoading': 'Loading licenses...',
  'ak.licEmpty':
    'No licenses linked to this account yet. Buy one in the app and the license will appear here automatically.',
  'ak.devTitle': 'Device Management',
  'ak.devNote':
    'Do not have a license yet? Buy one in the app — once the license is active, its card appears above with the <strong>+ Add device</strong> button (10-minute activation code per device). Logging out of all devices ends this account session everywhere — you will need to sign in again on each app.',
  'ak.btnLogoutAll': 'Log out of all devices',
  'ak.sideTitle': 'After you have an account',
  'ak.ben1T': 'All licenses on one screen',
  'ak.ben1D': 'Kaki Lima, Rosok, Laundry — status, active devices, and remaining quota.',
  'ak.ben2T': 'Buy other apps, keep one account',
  'ak.ben2D': 'No need to re-register for each app. The same WhatsApp number = the same account.',
  'ak.ben3T': 'Activate partnership anytime',
  'ak.ben3D': 'Universal referral code, commission from every recommendation that converts.',
  'ak.sideNoteT': 'Used a Kasir Solo app before?',
  'ak.sideNoteD':
    'Sign in or register with the same WhatsApp number — active licenses appear automatically, no device switching needed.',
  'ak.btnForgotPin': '💬 Forgot PIN? Chat admin',

  // ── Konten /akun yang di-inject JS (render lisensi, referral, pencairan) ──
  'ak.btnAddDev': '+ Add device',
  'ak.capFull': 'Device quota full',
  'ak.btnOpenApp': 'Open app',
  'ak.btnOpen': 'Open',
  'ak.chipActive': 'Active',
  'ak.chipExpired': 'Expired',
  'ak.devEmpty': 'No active devices recorded yet.',
  'ak.codeTitle': 'Activation code for a new device',
  'ak.codeDesc':
    'Open the app on the new device → License menu → “Have an activation code?” → enter this code. Valid for <strong>10 minutes</strong>.',
  'ak.pointsWord': 'points',
  'ak.stPaid': 'Paid',
  'ak.stFree': 'Free',
  'ak.stPending': 'Pending',
  'ak.stDone': 'Completed',
  'ak.stProcessing': 'Processing',
  'ak.stRejected': 'Rejected',
};
