/**
 * portfolio.ts — LOADER konten situs (transparan bagi halaman).
 * =============================================================================
 * Sumber kebenaran: Supabase public.site_content (dikelola via Control Center,
 * modul "Konten Web"). Nilai per-key menimpa data lokal src/data/local.ts.
 * Fallback: kalau env tak ada / fetch gagal / key tak ada -> data lokal,
 * sehingga build tetap jalan offline.
 *
 * Env (Vercel project company / .env):
 *   PUBLIC_SUPABASE_URL       -> https://<ref>.supabase.co
 *   PUBLIC_SUPABASE_ANON_KEY  -> anon key (RLS: site_content hanya SELECT utk anon)
 *
 * Kontrak CMS: key = nama koleksi (projects, testimonials, pulseEvents,
 * services, founderSlots, about, site, hardware, apps, portal, problems,
 * solutions, cities, cityInfo). Slug proyek TIDAK dari CMS — digenerate dari
 * client+city (konsisten dengan local.ts).
 */
import * as LOCAL from './local';

export type { Project, ProjectCategory, HardwareItem } from './local';

const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const anon = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

async function fetchRemote(): Promise<Record<string, any> | null> {
  if (!url || !anon) {
    console.warn('[site-content] PUBLIC_SUPABASE_URL/ANON_KEY tidak diset — pakai data lokal');
    return null;
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/site_content?select=key,value`, {
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      console.warn(`[site-content] HTTP ${res.status} — fallback ke data lokal`);
      return null;
    }
    const rows: { key: string; value: any }[] = await res.json();
    const map: Record<string, any> = {};
    for (const r of rows) map[r.key] = r.value;
    console.log(`[site-content] ${Object.keys(map).length} koleksi dimuat dari Supabase`);
    return map;
  } catch (e: any) {
    console.warn('[site-content] gagal fetch —', e?.message || e, '— fallback ke data lokal');
    return null;
  }
}

const remote = await fetchRemote();
const pick = <K extends keyof typeof LOCAL>(key: K) =>
  remote && remote[key] !== undefined ? remote[key] : LOCAL[key];

// ── koleksi dengan transform slug ─────────────────────────────────────────────
const projectsRaw = pick('projects');
export const projects = projectsRaw.map((p: any) => ({
  ...p,
  slug: LOCAL.slugify(`${p.client}-${p.city}`),
}));
export const getProject = (slug: string) => projects.find((p: any) => p.slug === slug);
export const projectsForCity = (citySlug: string) => {
  const aliases = LOCAL.CITY_ALIASES[citySlug] ?? [];
  return projects.filter((p: any) => aliases.includes(p.city));
};

// ── koleksi pas-through (remote menimpa lokal per-key) ────────────────────────
export const site = pick('site');
export const apps = pick('apps');
export const hardware = pick('hardware') as HardwareItem[];
export const hwCategoryLabel = LOCAL.hwCategoryLabel;
export const portal = pick('portal');
export const problems = pick('problems');
export const solutions = pick('solutions');
export const cities = pick('cities');
export const services = pick('services');
export const testimonials = pick('testimonials');
export const pulseEvents = pick('pulseEvents');
export const founderSlots = pick('founderSlots');
export const about = pick('about');
export const cityInfo = pick('cityInfo');

// ── konstanta/logika murni (selalu lokal) ────────────────────────────────────
export const formatRupiah = LOCAL.formatRupiah;
export const categoryLabel = LOCAL.categoryLabel;
export const CITY_ALIASES = LOCAL.CITY_ALIASES;
