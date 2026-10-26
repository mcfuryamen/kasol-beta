/**
 * kasol/js/quota.offline.js
 * Offline transaction quota dengan HMAC seal
 * Pure functions — tidak ada DOM, tidak ada network
 *
 * Didasarkan dari kaki5/js/quota.offline.js
 * Salt: OFFLINE_SALT dari license-core.js
 */
import { hmacSignature } from './license-core.js';
import { OFFLINE_SALT } from './license-core.js';

// ── Constants ─────────────────────────────────────────────────────────────────
const BUDGET_KEY = 'offline_budget_v1';

/**
 * Parse JSON dengan safe fallback
 * @param {string} raw
 * @param {any} fallback
 * @returns {any}
 */
function safeJson(raw, fallback) {
  try { return JSON.parse(raw); }
  catch { return fallback; }
}

// ── HMAC Seal/Unseal ─────────────────────────────────────────────────────────
/**
 * Buat HMAC seal untuk meta budget
 * @param {object} meta
 * @returns {Promise<string>}
 */
async function sealMeta(meta) {
  const json = JSON.stringify(meta);
  const sig = await hmacSignature(OFFLINE_SALT, json);
  return `${json}::${sig}`;
}

/**
 * Verify dan parse sealed meta
 * @param {string} sealed
 * @returns {Promise<object|null>}
 */
async function unsealMeta(sealed) {
  if (!sealed) return null;
  const idx = sealed.lastIndexOf('::');
  if (idx < 0) return null;
  const json = sealed.slice(0, idx);
  const sig = sealed.slice(idx + 2);
  const expected = await hmacSignature(OFFLINE_SALT, json);
  if (sig !== expected) return null;
  return safeJson(json, null);
}

// ── Budget Operations ────────────────────────────────────────────────────────
/**
 * Ambil budget dari localStorage
 * @returns {Promise<{used:number, limit:number, sealedMeta:string}>}
 */
export async function quotaGetBudget() {
  const raw = localStorage.getItem(BUDGET_KEY);
  if (!raw) return { used: 0, limit: 100, sealedMeta: '' };
  const data = safeJson(raw, null);
  if (!data) return { used: 0, limit: 100, sealedMeta: '' };
  return data;
}

/**
 * Simpan budget ke localStorage
 * @param {{used:number, limit:number, sealedMeta:string}} budget
 * @returns {Promise<void>}
 */
async function quotaSaveBudget(budget) {
  const meta = { used: budget.used, limit: budget.limit, ts: Date.now() };
  const sealedMeta = await sealMeta(meta);
  const toSave = { ...budget, sealedMeta };
  localStorage.setItem(BUDGET_KEY, JSON.stringify(toSave));
}

/**
 * Pastikan budget ada dan belum kedaluwarsa (30 hari)
 * @param {number} [defaultLimit=100]
 * @returns {Promise<{used:number, limit:number}>}
 */
export async function quotaEnsure(defaultLimit = 100) {
  const budget = await quotaGetBudget();
  if (!budget.sealedMeta) {
    // First time — seal with defaults
    const meta = { used: 0, limit: defaultLimit, ts: Date.now() };
    const sealedMeta = await sealMeta(meta);
    const fresh = { used: 0, limit: defaultLimit, sealedMeta };
    localStorage.setItem(BUDGET_KEY, JSON.stringify(fresh));
    return { used: 0, limit: defaultLimit };
  }
  // Verify seal
  const meta = await unsealMeta(budget.sealedMeta);
  if (!meta) {
    // Corrupt — reset
    return { used: 0, limit: defaultLimit };
  }
  const ageDays = (Date.now() - meta.ts) / (1000 * 60 * 60 * 24);
  if (ageDays > 30) {
    // Older than 30 days — reset
    return { used: 0, limit: defaultLimit };
  }
  return { used: meta.used, limit: budget.limit };
}

/**
 * Catat 1 transaksi offline
 * @param {number} [defaultLimit=100]
 * @returns {Promise<{used:number, limit:number, allowed:boolean}>}
 */
export async function quotaTickTx(defaultLimit = 100) {
  const { used, limit } = await quotaEnsure(defaultLimit);
  const newUsed = used + 1;
  const meta = { used: newUsed, limit, ts: Date.now() };
  const sealedMeta = await sealMeta(meta);
  localStorage.setItem(BUDGET_KEY, JSON.stringify({ used: newUsed, limit, sealedMeta }));
  return { used: newUsed, limit, allowed: true };
}

/**
 * Tandai budget sebagai online (reset counter)
 * @param {number} [defaultLimit=100]
 * @returns {Promise<void>}
 */
export async function quotaMarkOnline(defaultLimit = 100) {
  const meta = { used: 0, limit: defaultLimit, ts: Date.now() };
  const sealedMeta = await sealMeta(meta);
  localStorage.setItem(BUDGET_KEY, JSON.stringify({ used: 0, limit: defaultLimit, sealedMeta }));
}

/**
 * Cek status budget
 * @param {number} [defaultLimit=100]
 * @returns {Promise<{used:number, limit:number, remaining:number, percentUsed:number}>}
 */
export async function quotaBudgetStatus(defaultLimit = 100) {
  const { used, limit } = await quotaEnsure(defaultLimit);
  const remaining = Math.max(0, limit - used);
  const percentUsed = limit > 0 ? Math.round((used / limit) * 100) : 0;
  return { used, limit, remaining, percentUsed };
}
