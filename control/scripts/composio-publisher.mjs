/**
 * Kasir Solo — Composio Omnichannel Publisher Script
 * =============================================================================
 * Menghubungkan antrian social_posts di Supabase dengan konektor Composio yang aktif:
 * - Facebook (ca_S3YSwhPcwDY- / Amin Maghfuri)
 * - Instagram (ca_A8zax1S7uu5T / papi.rt13)
 * - Pinterest (ca_J6kCTLPC5TCA / mcfuryamen)
 * - YouTube (ca_0HhO6k66M4Mi / mcfury)
 * - WhatsApp (ca_12RobRIhew5k / Amin Maghfuri)
 *
 * Pemakaian:
 *   node control/scripts/composio-publisher.mjs --list   → daftar post 'approved'
 *       yang jatuh tempo (manifest JSON utk runner Cline)
 *
 * Catatan eksekusi: kredensial platform HIDUP di Composio (lingkungan Cline),
 * bukan di skrip ini. Skrip ini cuma pembaca manifest + updater status.
 * Runner Cline yang memanggil tool Composio (FACEBOOK_CREATE_POST,
 * INSTAGRAM_POST_IG_USER_MEDIA, PINTEREST_CREATE_PIN, dst.) berdasarkan
 * manifest, lalu menandai hasilnya lewat updatePostStatus().
 * =============================================================================
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../../.secure.env');

function loadEnv(file) {
  try {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][\w]*)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  } catch { /* optional */ }
}

loadEnv(resolve(__dirname, '../.env.local'));
loadEnv(resolve(__dirname, '../../.secure.env'));

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('[Composio Publisher] Error: SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum terpasang.');
  process.exit(1);
}

const base = SUPABASE_URL.replace(/\/$/, '');

async function sb(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      ...(method !== 'GET' ? { 'Content-Type': 'application/json', Prefer: 'return=representation' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`supabase_${res.status}: ${errText.slice(0, 200)}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/**
 * Daftar status konektor Composio yang aktif
 */
export const COMPOSIO_CONNECTIONS = {
  facebook: {
    accountId: 'ca_S3YSwhPcwDY-',
    user: 'Amin Maghfuri',
    toolSlug: 'FACEBOOK_CREATE_POST',
  },
  instagram: {
    accountId: 'ca_A8zax1S7uu5T',
    user: 'papi.rt13',
    toolSlug: 'INSTAGRAM_POST_IG_USER_MEDIA',
  },
  pinterest: {
    accountId: 'ca_J6kCTLPC5TCA',
    user: 'mcfuryamen',
    toolSlug: 'PINTEREST_CREATE_PIN',
  },
  youtube: {
    accountId: 'ca_0HhO6k66M4Mi',
    user: 'mcfury',
    toolSlug: 'YOUTUBE_UPDATE_VIDEO',
  },
  whatsapp: {
    accountId: 'ca_12RobRIhew5k',
    user: 'Amin Maghfuri',
    toolSlug: 'WHATSAPP_SEND_MESSAGE',
  },
};

/**
 * Mengambil post yang jatuh tempo atau siap diterbitkan
 */
export async function getDuePosts() {
  const now = new Date().toISOString();
  return await sb(`/rest/v1/social_posts?status=eq.approved&scheduled_at=lte.${encodeURIComponent(now)}&order=scheduled_at.asc&limit=10`);
}

/**
 * Update status post setelah diproses
 */
export async function updatePostStatus(id, { status, remoteId, remoteUrl, error }) {
  const patch = {
    status,
    posted_at: status === 'posted' ? new Date().toISOString() : undefined,
    remote_id: remoteId || null,
    remote_url: remoteUrl || null,
    last_error: error || null,
  };
  return await sb(`/rest/v1/social_posts?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: patch,
  });
}

console.log('[Composio Publisher] Siap melayani omnichannel posting untuk Kasir Solo.');
// CLI handler
const arg = process.argv[2] || '';
if (arg === '--list') {
  try {
    const due = await getDuePosts();
    const manifest = (due || []).map((p) => ({
      id: p.id,
      platform: p.platform || 'facebook',
      via: COMPOSIO_CONNECTIONS[p.platform]?.toolSlug || 'GRAPH_API',
      konten: p.konten,
      link: p.link || null,
      media_url: p.media_url || null,
      scheduled_at: p.scheduled_at,
    }));
    console.log(JSON.stringify({ ok: true, due: manifest.length, manifest }, null, 2));
  } catch (e) {
    console.error(JSON.stringify({ ok: false, error: String(e?.message || e).slice(0, 300) }, null, 2));
    process.exit(1);
  }
}

