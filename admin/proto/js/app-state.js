/**
 * Admin Marketing KASIRSOLO — App State
 * Shared state management for the admin dashboard
 */

// Global app state
export const AppState = {
  // Auth
  isLoggedIn: false,
  loginTime: null,

  // Data
  products: [],
  serials: [],
  clients: [],
  leads: [],
  settings: {
    biz: {},
    landing: {}
  },

  // UI state
  currentScreen: 'dashboard',
  sidebarOpen: false,
  loading: false,

  // License state
  license: {
    status: 'unknown',
    expiresAt: null,
    product: null,
    maxDevices: 1
  },

  // Device info
  deviceCode: null,
  installId: null
};

// State listeners
const listeners = new Map();

export function setState(path, value) {
  const keys = path.split('.');
  let obj = AppState;
  for (let i = 0; i < keys.length - 1; i++) {
    obj = obj[keys[i]];
  }
  obj[keys[keys.length - 1]] = value;
  notify(path, value);
}

export function getState(path) {
  const keys = path.split('.');
  let obj = AppState;
  for (const key of keys) {
    if (obj === undefined || obj === null) return undefined;
    obj = obj[key];
  }
  return obj;
}

export function subscribe(path, callback) {
  if (!listeners.has(path)) listeners.set(path, new Set());
  listeners.get(path).add(callback);
  return () => listeners.get(path).delete(callback);
}

function notify(path, value) {
  if (listeners.has(path)) {
    listeners.get(path).forEach(cb => cb(value));
  }
  // Also notify parent paths
  const parts = path.split('.');
  for (let i = parts.length - 1; i > 0; i--) {
    const parent = parts.slice(0, i).join('.');
    if (listeners.has(parent)) {
      listeners.get(parent).forEach(cb => cb(getState(parent)));
    }
  }
}

// Initialize from localStorage
export function initState() {
  try {
    const saved = localStorage.getItem('admin_state');
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.assign(AppState, parsed);
    }
  } catch (e) {
    console.warn('Failed to load app state:', e);
  }
  // Ensure arrays exist
  AppState.products = AppState.products || [];
  AppState.serials = AppState.serials || [];
  AppState.clients = AppState.clients || [];
  AppState.leads = AppState.leads || [];
  AppState.settings = AppState.settings || { biz: {}, landing: {} };
}

// Persist to localStorage
export function persistState() {
  try {
    localStorage.setItem('admin_state', JSON.stringify(AppState));
  } catch (e) {
    console.warn('Failed to persist app state:', e);
  }
}

// Debounced persist
let persistTimer = null;
export function schedulePersist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persistState, 500);
}