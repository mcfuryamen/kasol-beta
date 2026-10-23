/**
 * i18n — kamus bahasa untuk chrome situs KASIRSOLO.
 * =============================================================================
 * Bahasa KANONIK = Indonesia (HTML yang ditulis). EN adalah override opsional:
 * hanya key yang punya entri di `EN` yang berubah saat user pindah ke English.
 * Nilai boleh berisi markup (span/br) — dipakai lewat innerHTML oleh client.
 *
 * Cara pakai: beri atribut data-i18n="kunci" pada elemen (teks/innerHTML),
 * data-i18n-aria="kunci" untuk aria-label, data-i18n-ph="kunci" untuk
 * placeholder. Menambah term baru = tambah key di EN + atribut di markup.
 * Data dari CMS (produk, portofolio, artikel) tetap bahasa aslinya.
 */

export const LANGS = ['id', 'en'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'id';
export const STORAGE_KEY = 'mks-lang';

/** Override English. Key tanpa entri = tetap bahasa Indonesia. */
export const EN: Record<string, string> = {
  // ── Header nav ──
  'nav.perusahaan': 'Company',
  'nav.layanan': 'Services',
  'nav.jangkauan': 'Coverage',
  'nav.tanyaFounder': 'Ask the Founder',
  'nav.menu.profil': 'Profile',
  'nav.menu.visiMisi': 'Vision & Mission',
  'nav.menu.rekrutmen': 'Careers',
  'nav.menu.portfolio': 'Portfolio',
  'nav.menu.aplikasi': 'Apps',
  'nav.menu.mesin': 'Hardware',
  'nav.aria.lang': 'Switch language / Ganti bahasa',
  'nav.aria.top': 'Back to top / Kembali ke atas',

  // ── Tab bar mobile ──
  'tab.beranda': 'Home',
  'tab.aplikasi': 'Apps',
  'tab.mesin': 'Hardware',
  'tab.portal': 'Portal',
  'tab.aria.utama': 'Main navigation',

  // ── Footer ──
  'footer.tagline':
    'Trusted technology partner for business digitalization across Indonesia. POS hardware, SaaS software, and web development services since 2015.',
  'footer.solusiDigital': 'Digital Solutions',
  'footer.perusahaan': 'Company & Support',
  'footer.hubungi': 'Contact Us',
  'footer.links.hardware': 'POS Hardware',
  'footer.links.aplikasi': 'App Innovation',
  'footer.links.portalSibos': 'SIBOS Portal',
  'footer.links.portalQalam': 'QALAM & Kitchen Portals',
  'footer.links.tentang': 'About Us',
  'footer.links.area': 'Service Area',
  'footer.links.klien': 'Clients & Portfolio',
  'footer.links.download': 'Download Center',
  'footer.links.hubungi': 'Contact Us',
  'footer.kantorLegal': 'LEGAL OFFICE',
  'footer.kantorOps': 'OPERATIONAL OFFICE',
  'footer.whatsapp': 'WHATSAPP',
  'footer.chatFounder': 'Chat with the Founder',
  'footer.privasi': 'Privacy',
  'footer.syarat': 'Terms & Conditions',

  // ── Home: hero ──
  'home.heroTitle': 'The Biggest <span class="accent">POS Machine</span><br />Hub in Solo.',
  'home.heroSub':
    'Digital assets & POS systems that make your storefront run on autopilot — no need to babysit it every day.',
  'home.ctaBorong': 'Grab a Machine Package →',
  'home.ctaTanya': 'Ask the Founder Directly',
  'home.scroll': 'Scroll',

  // ── Home: trust strip ──
  'home.trust.500': 'POS Partners',
  'home.trust.kirim': 'Shipped',
  'home.trust.uptime': 'Server Uptime',
  'home.trust.support': 'Tech Support',

  // ── Home: section heads ──
  'home.aplikasiKicker': 'POS Apps',
  'home.aplikasiTitle': 'More Than <span class="hl">a Cash Register.</span>',
  'home.aplikasiSub':
    'We build the digital brain of your business — offline-first POS apps that run fully on a phone, no fear of dead internet.',
  'home.mesinKicker': 'Cash Registers',
  'home.mesinTitle': 'Ready-to-Fight <span class="hl">Assembled Packages.</span>',
  'home.mesinSub':
    'Hardware + software, integrated — one goal: grow your business. Measurable payback.',
  'home.detailOrder': 'Details & Order →',
  'home.seeAllHw': 'See All Hardware',
  'home.portalKicker': 'R&D Division',
  'home.portalTitle': "We Don't Just Sell <span class=\"hl\">Metal Registers.</span>",
  'home.portalSub':
    'Industry-specific digital solution portals — each built from scratch for a specific problem.',
  'home.jasaKicker': 'Digital Services',
  'home.jasaTitle': 'Your Online Business, <span class="hl">We Handle It.</span>',
  'home.jasaSub':
    'The three lines most often needed by POS partners — delivered by the same team, never subcontracted.',
  'home.problemTitle': 'Still Taking Notes by Hand? <span class="hl">That Ends Now.</span>',
  'home.problemSub':
    "Realize it? All this time you're not running a business — you're a slave to never-ending store routines.",
  'home.colOld': 'The Old Way (Manual)',
  'home.colNew': 'The Kasir Solo Way (POS)',
  'home.portoKicker': 'Battle Report',
  'home.portoTitle': 'Authentic Proof, <span class="hl">Not Stolen Photos.</span>',
  'home.portoSub':
    'Cafes, retail stores, schools, franchises — all installed and built by us. Check the full arsenal.',
  'home.portoBtn': 'Unpack the Whole Arsenal →',
  'home.testiKicker': 'From the Field',
  'home.testiTitle': "It's Not Me Talking. <span class=\"hl\">It's Your Partners.</span>",
  'home.jangkauanKicker': 'Coverage',
  'home.jangkauanTitle': 'From Solo, <span class="hl">Ready Nationwide.</span>',
  'home.jangkauanSub':
    'Home base — full on-site support. Expansion areas — remote shipping & support.',
  'home.ctaSlots': 'LEFT THIS MONTH: ',
  'home.ctaSlotsOnsite': ' ON-SITE SLOTS · ',
  'home.ctaSlotsDigital': ' DIGITAL PROJECT SLOTS',
  'home.ctaTitle': 'Grab a Machine Package — Pay Once, Yours for Life.',
  'home.ctaSub':
    'Free consultation straight with the founder. Answered by someone who knows the machines, not a salesperson.',
  'home.ctaBtn': 'Secure Your Slot',

  // ── /hardware ──
  'hw.heroSub':
    'Upgrade your business with military-grade equipment. Tough, low-maintenance, ready for thousands of orders.',
  'hw.filter.ALL': 'All Arsenal',
  'hw.filter.ANDROID': 'POS Android',
  'hw.filter.PC': 'Desktop HQ',
  'hw.filter.PERIPHERALS': 'Accessories',
  'hw.more': 'View Details →',
  'hw.order': 'Order via WA',
  'hw.lapanganKicker': 'Field Proof',
  'hw.lapanganTitle': 'Hardware <span class="hl">Installations.</span>',
  'hw.lapanganSub':
    'Machines installed, teams trained, operations running. Real photos from the field — not stock images.',
  'hw.allProjects': 'See All Projects',
  'hw.ctaTitle': 'Not Sure Which Arsenal?',
  'hw.ctaSub':
    'Free consult — tell us about your business and we will assemble the right package. Measurable payback.',
  'hw.ctaBtn': 'Free Consult via WA',
  'hw.worth': "Why It's Worth It?",
  'hw.weight': 'Weight',
  'hw.dim': 'Dimensions',
  'hw.specs': 'Tech Specs',
  'hw.inbox': "What's in the Box",
  'hw.buy': 'Buy Now',
  'hw.nego': 'Negotiate Price',

  // ── /about ──
  'about.heroTitle': 'I Am Not a <span class="accent">Vendor.</span>',
  'about.heroSub':
    'Ordinary vendors only care about selling and then vanish. I care whether your business survives. On this brutal retail battlefield, you need more than a device seller.<br /><strong class="hero-strong">I am Your War Partner.</strong>',
  'about.timelineKicker': 'Timeline',
  'about.timelineTitle': 'From Zero, to the Top, <span class="hl">Back to Zero.</span>',
  'about.timelineSub': 'Four chapters that shaped how we build systems today.',
  'about.hubungiMarkas': 'CONTACT HQ',
  'about.legalTitle': 'I Play Clean.',
  'about.legalSub':
    "Business is about trust. I won't ruin the name I rebuilt from scratch. Here is the legal proof.",
  'about.lcTitle': 'Verify It Yourself',
  'about.lcSub': "You can check our company data on the government site to be sure.",
  'about.kontakKicker': 'Direct Contact',
  'about.kontakTitle': 'Talk to Me Directly.',
  'about.kontakSub': 'No call center, no proxies. You chat, I answer.',
  'about.waLabel': 'WhatsApp — Fastest Reply',
  'about.waNote': 'Mon–Sat, 08.00–21.00 WIB. Consulting & support, free.',
  'about.emailLabel': 'Official Email',
  'about.emailNote': 'For formal offers, invoices, and B2B partnerships.',
  'about.kantorLegal': 'LEGAL OFFICE',
  'about.kantorOps': 'OPERATIONAL OFFICE',

  // ── /visi-misi ──
  'visi.badge': 'Our Battle Map',
  'visi.heroTitle': 'Big Dreams & <span class="accent">Hard Work.</span>',
  'visi.heroSub':
    "I didn't build PT Mesin Kasir Solo just for petty profit. I have a mission to save thousands of small businesses from going bankrupt because they're blind to their own data.",
  'visi.label': 'MY VISION (THE DREAM)',
  'visi.quote':
    '"To become the #1 Digital Defense Fortress for Indonesian small businesses. I want small shops to have systems as advanced as modern minimarkets — without paying a fortune."',
  'visi.misiKicker': 'Daily Mission (The Grind)',
  'visi.misiTitle': 'Four Things <span class="hl">We Grind.</span>',
  'visi.misiSub': 'WHAT OUR TEAM WORKS ON FOR YOU EVERY DAY:',
  'visi.m1T': 'Break the Expensive Myth',
  'visi.m1D': 'Advanced tech should not empty your pockets. We bring enterprise POS machines & software at street prices.',
  'visi.m2T': 'Educate Until Smart',
  'visi.m2D': 'We make sure clients understand what data really is. You get the tools and the skill to read your business numbers.',
  'visi.m3T': 'Innovation Never Sleeps',
  'visi.m3D': 'SIBOS & QALAM keep getting updates. You never worry about software — that is our job.',
  'visi.m4T': 'Support Without Drama',
  'visi.m4D': 'If a machine breaks, I worry — not you. Our technical team backs you up so sales keep running.',
  'visi.dnaKicker': 'Premium Arsenal',
  'visi.dnaTitle': 'MY <span class="hl">DNA</span>',
  'visi.dnaSub': 'Street principles instilled in every member of the team.',
  'visi.d1T': 'Honesty Above All',
  'visi.d1D': "I won't sell you what you don't need just for commission. If a product is bad, I say it's bad. Period.",
  'visi.d2T': 'Steel Mentality',
  'visi.d2D': 'Standing since 2015, surviving covid and repeated server outages. That is what forged our steel.',
  'visi.d3T': "No Whining",
  'visi.d3D': 'Got a problem? Find a solution. Error? Fix it. Design off? Repair it. Fix it, never give up.',
  'visi.d4T': 'You Are the Boss',
  'visi.d4D': 'If your business dies, mine dies with it. So I will fight to the bone to make you succeed.',
  'visi.d5T': 'Fast and Furious',
  'visi.d5D': 'Business is a race. We move fast — chats answered instantly, shipping launched, support on point.',
  'visi.d6T': 'Long Game',
  'visi.d6D': "I'm not here for hit and run. I want to walk with you from a small shop to branches everywhere.",
  'visi.quoteBig': "I DON'T SELL MAGIC TRICKS,<br />I SELL <span class=\"hl\">WAR WEAPONS</span>.\"",
  'visi.quoteCard':
    '"At PT Mesin Kasir Solo, I believe one thing: a business without data is gambling. My job is to make sure you hold the Ace card (System & Data) so you always win in the market."',
  'visi.ctaBtn': 'Meet the Founder',

  // ── /rekrutmen ──
  'rk.heroTitle': 'Not Looking for Employees,<br />Looking for <span class="accent">Fellow Fighters.</span>',
  'rk.heroSub':
    'PT Mesin Kasir Solo is not for those seeking a cozy 9-to-5. This is a headquarters for those who want to build systems that save thousands of small businesses with me.',
  'rk.dnaTitle': 'MY <span class="hl">DNA</span>',
  'rk.dnaSub':
    'I fell as hard as it gets in 2022. Lost a domain, lost assets. I rebuilt alone. If your mentality is soft, you will not survive here.',
  'rk.d1T': 'Battle-Hardened',
  'rk.d1D': 'Technical problems, client complaints, tight deadlines — daily food. I need calm Problem Solvers when the storm hits.',
  'rk.d2T': 'Impact Over Output',
  'rk.d2D': "Don't be proud of just staying late. I only value results. Does your code make transactions faster? That counts.",
  'rk.d3T': 'Empathy for Users',
  'rk.d3D': 'Our clients are market traders & traditional shops. Your system must make their life easier — not a fancy UI only startup kids understand.',
  'rk.warn': "DON'T EVEN TRY TO JOIN IF:",
  'rk.p1': 'Civil-Servant Mentality (Playing Safe)',
  'rk.p2': 'Too Sensitive (Anti-Criticism)',
  'rk.p3': 'Lazy to Learn',
  'rk.p4': 'Working Like a Robot',
  'rk.posisiTitle': 'Battle <span class="hl">Positions</span>',
  'rk.posisiSub': 'If you feel you share the same DNA, grab your weapon and join the ranks.',
  'rk.emptyT': 'No Openings Yet',
  'rk.emptyD': 'Top 1% skill? Force me to hire you through the reckless route.',
  'rk.emptyBtn': 'Upload a Spontaneous CV',

  // ── /portfolio ──
  'por.badge': 'Battle Report',
  'por.heroTitle': 'No Fake <span class="accent">Proof.</span>',
  'por.heroSub':
    'Authentic proof of POS and digital systems we built. Real photos from the field, real clients. See for yourself.',
  'por.terpasang': 'Installed.',
  'por.dikerjakan': 'Delivered.',
  'por.notePhysical': 'Machines installed, teams trained, operations running.',
  'por.noteDigital': 'Web, management systems, and optimization built from scratch.',
  'por.more': 'View Details →',
  'por.ctaTitle': 'Want Your Business Listed Here?',
  'por.ctaSub': "Don't just watch others succeed. It's your turn to upgrade your system.",
  'por.ctaBtn': 'Start a New Project',
};
