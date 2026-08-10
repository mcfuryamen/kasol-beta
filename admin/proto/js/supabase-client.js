/**
 * Admin Marketing KASIRSOLO — Supabase Client
 * Simple wrapper for Supabase REST API with service_role key
 * Uses window.SUPABASE_URL and window.SUPABASE_SERVICE_KEY from env-loader
 */

function getConfig() {
  return {
    url: window.SUPABASE_URL || 'https://hhywrvedlwljawgxzpkq.supabase.co',
    key: window.SUPABASE_SERVICE_KEY || ''
  };
}

function headers(contentType = true) {
  const { key } = getConfig();
  const h = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Prefer: 'return=representation'
  };
  if (contentType) h['Content-Type'] = 'application/json';
  return h;
}

export async function sbGet(table, query = '') {
  const { url } = getConfig();
  const res = await fetch(`${url}/rest/v1/${table}${query}`, {
    headers: headers(false)
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function sbPost(table, data) {
  const { url } = getConfig();
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function sbPatch(table, id, data) {
  const { url } = getConfig();
  const res = await fetch(`${url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function sbDelete(table, id) {
  const { url } = getConfig();
  const res = await fetch(`${url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: headers(false)
  });
  if (!res.ok && res.status !== 204) throw new Error(`${res.status} ${res.statusText}`);
  return true;
}

export async function sbUpsert(table, data, onConflict = 'id') {
  const { url } = getConfig();
  const res = await fetch(`${url}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: {
      ...headers(),
      Prefer: 'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// Real-time subscription helper (requires WebSocket)
export function subscribeToTable(table, callback, filter = {}) {
  // This would use Supabase Realtime in production
  // For now, polling fallback
  let lastData = null;
  const interval = setInterval(async () => {
    try {
      let query = '?order=updated_at.desc';
      if (filter.id) query += `&id=eq.${filter.id}`;
      const data = await sbGet(table, query);
      if (JSON.stringify(data) !== JSON.stringify(lastData)) {
        lastData = data;
        callback(data);
      }
    } catch (e) {
      console.error('Subscription error:', e);
    }
  }, 5000);

  return () => clearInterval(interval);
}

// Test connection
export async function testConnection() {
  try {
    await sbGet('clients', '?limit=1');
    return true;
  } catch {
    return false;
  }
}