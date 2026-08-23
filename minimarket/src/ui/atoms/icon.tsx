import { JSX } from "preact";

interface IconProps { size?: number; class?: string; }
type IC = (props: IconProps) => JSX.Element;

const mk = (d: string | string[]): IC => ({ size = 20, class: cls }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={cls}>
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);

const mkC = (children: JSX.Element): IC => ({ size = 20, class: cls }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={cls}>
    {children}
  </svg>
);

export const Icons = {
  Home: mk("m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"),
  ShoppingCart: mkC(<><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></>),
  Package: mk("m7.5 4.27 9 5.15M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"),
  Users: mkC(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>),
  TrendingUp: mk("M22 7 13.5 15.5l-5-5L2 17M22 7h-6M22 7v6"),
  Settings: mkC(<><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></>),
  Bell: mk("M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"),
  Sun: mkC(<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></>),
  Moon: mk("M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"),
  Search: mk("m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0"),
  Plus: mk("M12 5v14M5 12h14"),
  Minus: mk("M5 12h14"),
  X: mk("M18 6 6 18M6 6l12 12"),
  Check: mk("M20 6 9 17l-5-5"),
  ChevronDown: mk("m6 9 6 6 6-6"),
  ChevronUp: mk("m18 15-6-6-6 6"),
  ChevronLeft: mk("m15 18-6-6 6-6"),
  ChevronRight: mk("m9 18 6-6-6-6"),
  Menu: mk("M4 12h16M4 6h16M4 18h16"),
  Logout: mk("M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"),
  Edit: mk("M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"),
  Trash: mk("M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"),
  Eye: mkC(<><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>),
  Filter: mk("M22 3H2l8 9.46V19l4 2v-8.54L22 3z"),
  ArrowUp: mk("m12 19-7-7 7-7M5 12h14"),
  ArrowDown: mk("m12 5 7 7-7 7M19 12H5"),
  RefreshCw: mk("M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M3 3v5h5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M21 21v-5h-5"),
  AlertTriangle: mk("M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"),
  Info: mkC(<><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></>),
  DollarSign: mk("M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"),
  CreditCard: mk("M1 4h22v16H1zM1 10h22"),
  Wallet: mk("M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 2v6M10 2v6M14 2v6"),
  Tag: mk("M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2zM7 7h.01"),
  Clipboard: mk("M8 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-2M8 2a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2M8 2a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2"),
  BarChart: mkC(<><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/><line x1="2" y1="20" x2="22" y2="20"/></>),
  Truck: mk("M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM18.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"),
  Star: mk("M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"),
  Clock: mkC(<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>),
  Calendar: mkC(<><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>),
  Download: mk("M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"),
  Upload: mk("M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"),
  Print: mkC(<><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></>),
  Wifi: mk("M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"),
  WifiOff: mk("M8.53 16.11a6 6 0 0 1 6.95 0M5 12.55a11 11 0 0 1 4.38-2.42M1.42 9a15.91 15.91 0 0 1 4.7-2.88M23 1 1 23"),
  Grid: mk("M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"),
  List: mk("M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"),
  User: mkC(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>),
  Shield: mk("M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"),
  Box: mk("M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.29 7L12 12l8.71-5M12 22V12"),
  Receipt: mk("M4 2h16a2 2 0 0 1 2 2v18l-4-2-4 2-4-2-4 2V4a2 2 0 0 1 2-2zm4 8h8M8 14h8M8 6h4"),
  Zap: mk("M13 2 3 14h9l-1 8 10-12h-9l1-8z"),
  Gift: mk("M20 12v10H4V12M22 7H2v5h20V7zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"),
  Percent: mk("M19 5 5 19M6.5 3.5a3 3 0 0 1 3 3 3 3 0 0 1-3 3 3 3 0 0 1-3-3 3 3 0 0 1 3-3zM17.5 14.5a3 3 0 0 1 3 3 3 3 0 0 1-3 3 3 3 0 0 1-3-3 3 3 0 0 1 3-3z"),
  // NEW icons for minimarket
  Barcode: mkC(<><path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14M21 5v14"/></>),
  Keyboard: mkC(<><rect width="20" height="12" x="2" y="6" rx="2" ry="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/></>),
  Printer2: mkC(<><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></>),
  CashRegister: mkC(<><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20M7 15h.01M12 15h.01M17 15h.01"/></>),
  Scan: mkC(<><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></>),
  Hash: mk("M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"),
  Delete: mkC(<><path d="M20 5H9l-7 7 7 7h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></>),
  ChevronRight2: mk("m9 18 6-6-6-6"),
};
