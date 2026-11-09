/**
 * Control Center Kasir Solo — Grow-Up Omnichannel Connector (Composio Powered)
 * =============================================================================
 * Jembatan antara modul Grow-Up (tab Sosmed) dengan konektor Composio yang
 * aktif di lingkungan Cline. Pola kerjanya:
 *
 *   1. Owner menulis post di Control → pilih platform "via Composio"
 *      (pinterest / youtube / whatsapp) → tekan 🛰️ Kirim ke Composio.
 *   2. Post disimpan ke tabel `social_posts` dengan status 'approved' dan
 *      scheduled_at = sekarang (jatuh tempo).
 *   3. Runner Cline (agent, bukan browser) mengambil post jatuh tempo — via
 *      control/scripts/composio-publisher.mjs atau langsung tool Composio —
 *      lalu menerbitkannya pakai konektor berikut:
 *
 *   platform   | connected_account_id | akun           | tool Composio
 *   -----------+----------------------+----------------+------------------------------
 *   facebook   | ca_S3YSwhPcwDY-      | Amin Maghfuri  | FACEBOOK_CREATE_POST
 *   instagram  | ca_A8zax1S7uu5T      | papi.rt13      | INSTAGRAM_POST_IG_USER_MEDIA
 *   pinterest  | ca_J6kCTLPC5TCA      | mcfuryamen     | PINTEREST_CREATE_PIN
 *   youtube    | ca_0HhO6k66M4Mi      | mcfury         | YOUTUBE_UPLOAD_VIDEO
 *   whatsapp   | ca_12RobRIhew5k      | Amin Maghfuri  | WHATSAPP_SEND_MESSAGE
 *
 * Catatan: kredensial OAuth dikelola Composio server-side — owner TIDAK perlu
 * punya API key platform manapun. Modul ini sengaja TIDAK melakukan fetch ke
 * platform dari browser (beda dengan sosmed.js yang lewat /api/social-fb):
 * eksekusinya ada di sisi runner Cline.
 * =============================================================================
 */

/** Metadata konektor aktif (sumber tunggal utk UI & runner). */
export const COMPOSIO_CONNECTIONS = {
  facebook: { accountId: 'ca_S3YSwhPcwDY-', user: 'Amin Maghfuri', tool: 'FACEBOOK_CREATE_POST', via: 'graph' },
  instagram: { accountId: 'ca_A8zax1S7uu5T', user: 'papi.rt13', tool: 'INSTAGRAM_POST_IG_USER_MEDIA', via: 'graph' },
  threads: { accountId: null, user: null, tool: null, via: 'oauth-meta' },
  pinterest: { accountId: 'ca_J6kCTLPC5TCA', user: 'mcfuryamen', tool: 'PINTEREST_CREATE_PIN', via: 'composio' },
  youtube: { accountId: 'ca_0HhO6k66M4Mi', user: 'mcfury', tool: 'YOUTUBE_UPLOAD_VIDEO', via: 'composio' },
  whatsapp: { accountId: 'ca_12RobRIhew5k', user: 'Amin Maghfuri', tool: 'WHATSAPP_SEND_MESSAGE', via: 'composio' },
};

/** Platform yang diterbitkan langsung oleh runner Composio (bukan Graph API server). */
export const COMPOSIO_PLATFORMS = ['pinterest', 'youtube', 'whatsapp'];

export function isComposioPlatform(platform) {
  return COMPOSIO_PLATFORMS.includes(String(platform || '').toLowerCase());
}

/** Label pintar utk toast/status. */
export function composioLabel(platform) {
  const c = COMPOSIO_CONNECTIONS[platform];
  return c ? `${platform} (${c.user} · via Composio)` : platform;
}

