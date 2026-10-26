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
 * Blok `m.*` = navigasi + halaman baru di app ini (daftar, portal, link referal).
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
  'm.nav.portal': 'Portal',
  'm.nav.masuk': 'Partner Login',
  'm.tab.beranda': 'Home',
  'm.tab.program': 'Program',
  'm.tab.portal': 'Portal',
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
  'm.footer.daftar': 'Sign Up',
  'm.footer.portal': 'Partner Portal',
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
    'Fill in the form, hit send, and WhatsApp opens with the message already written. Just send it — done.',
  'mitra.fNama': 'Name',
  'mitra.fWa': 'WhatsApp Number',
  'mitra.fKota': 'City',
  'mitra.fCatatan': 'Notes (optional)',
  'mitra.fSubmit': 'Send Registration',
  'mitra.fNote':
    'Registration goes straight into the database — your referral code and portal link are ready in seconds, no chatting needed. One code covers <b>all Kasir Solo products</b>. The details also land in our WhatsApp so we can help you later.',
  'mitra.fNamaPh': 'Your name',
  'mitra.fWaPh': '628xxxxxxxxxx',
  'mitra.fKotaPh': 'Your city',
  'mitra.fKodeRef': 'Referral Code (optional)',
  'mitra.fKodeRefPh': 'MKS-XXXXXX',
  'mitra.fKodeRefNote':
    'Got a code from the partner who invited you? Enter it — they get the commission, you get a discount for your first purchase.',
  'mitra.fCatatanPh': 'Tell us a bit — why do you want to join the program?',

  // ── Hasil pendaftaran (mitra jadi) ──
  'mitra.regOkBadge': "You're In",
  'mitra.regOkTitle': 'You are officially a partner',
  'mitra.regOkSub':
    'Your referral code is ready, and it works for <b>all Kasir Solo products</b>. Share it anywhere — every purchase through your code counts as your commission.',
  'mitra.regCodeLabel': 'Your referral code',
  'mitra.regCopy': 'Copy code',
  'mitra.regCopyOk': 'Copied!',
  'mitra.regLinkLabel': 'Your partner portal link',
  'mitra.regOpenPortal': 'Open portal',
  'mitra.regSendWa': 'Send to my WhatsApp',
  'mitra.regNote':
    'Save your portal link — that is your access to your code, points, and payouts.',
  'mitra.regNoteWA':
    'Your registration details also land in our WhatsApp, so we know you are in and can help if anything breaks.',

  // ── Kode referal di form daftar (voucher untuk pembelian pertama) ──
  'mitra.refVoucherLabel': 'Discount code for your first purchase',
  'mitra.refMeta': '{d} off · minimum spend {m} · valid until {e}',
  'mitra.refInvalid': "That referral code didn't work — but your registration still went through.",

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
  'm.portalCta': 'Open the Partner Portal',
  'm.portalNote':
    'The portal currently runs on sample data. Once the database is live, everything is real — your code, your balance, your payout history.',

  // ── Halaman pendaftaran ──
  'm.daftarBadge': 'Sign Up',
  'm.daftarTitle': 'Join as a <span class="hl">Partner</span>',
  'm.daftarSub':
    'Fill in the form, hit send, and your referral code plus portal link appear right away.',
  'm.daftarAfterTitle': 'What Happens After You Sign Up',
  'm.daftarAfter1':
    'Your referral code is issued right away — no waiting, no approval queue.',
  'm.daftarAfter2':
    'Your partner portal link shows up on your screen. Save it — that is your access to codes, points, and payouts.',
  'm.daftarAfter3': 'Share your code. Every sale through it counts as your referral.',
  'm.daftarKembali': 'Back to the program',

  // ── Halaman portal (dashboard P0) ──
  'm.pHalo': 'Welcome back',
  'm.pMock': 'Sample data',
  'm.pKodeTitle': 'Your Code',
  'm.pKodeDesc': 'Share this code. Anyone who buys through it becomes your referral.',
  'm.pSaldoTitle': 'Points & Balance',
  'm.pSaldoReady': 'Ready to withdraw',
  'm.pSaldoPending': 'In payout cycle',
  'm.pSaldoTotal': 'Total earned',
  'm.pKonversi': '1 point = Rp 1,000',
  'm.pSiklus': 'Payout cycle',
  'm.pNext': 'Next payout',
  'm.pRiwayatTitle': 'Referral History',
  'm.pKlienTitle': 'My Clients',
  'm.pPencairanTitle': 'Request a Payout',
  'm.pPencairanDesc': 'Minimum Rp 50,000. Our team processes the payout manually.',
  'm.pJumlah': 'Amount',
  'm.pJumlahPh': '50000',
  'm.pPoin': 'Points',
  'm.pRekening': 'Bank Account',
  'm.pRekeningPh': 'Bank name, account number, account holder',
  'm.pKirim': 'Send Payout Request',
  'm.pKirimNote': 'Payout requests are processed manually by our team.',
  'm.pSalin': 'Copy',
  'm.pSalinOk': 'Copied!',
  'm.pShareWa': 'Share to WhatsApp',
  'm.pRiwayatEmpty': 'No referrals yet. Share your code to get started.',
  'm.pPayoutEmpty': 'No payouts yet.',
  'm.pStatusPaid': 'Bought a license',
  'm.pStatusFree': 'Hasn’t bought yet',
  'm.pStatusPending': 'Waiting',
  'm.pOutSelesai': 'Paid',
  'm.pOutDiproses': 'Processing',
  'm.pOutDitolak': 'Rejected',
  'm.pLoginNote': 'Access goes through a token link sent over WhatsApp.',
  'm.pTierLicensed': 'You hold a license',
  'm.pTierReferralOnly': 'Referral only',
  'm.pJumlahKlien': 'Clients',
  'm.pKonversiLabel': 'Convert to cash',
  'm.pStatusAktif': 'Active',
  'm.pStatusTertunda': 'Awaiting verification',
  'm.pHari': 'days',
  'm.pKolNama': 'Name',
  'm.pKolKota': 'City',
  'm.pKolProduk': 'Product',
  'm.pKolTanggal': 'Date',
  'm.pKolStatus': 'Status',
  'm.pKolPoin': 'Points',
  'm.pPayoutTitle': 'Payout History',
  'm.pLinkRef': 'Referral link',
  'm.pPoinTersedia': 'Available points',
  'm.pOke': 'Request sent. We will transfer it to your account.',
  'm.pKosongKlien': 'No clients have bought a license through your code yet.',

  // ── Halaman link referal (/r/[code]) ──
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
};
