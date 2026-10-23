/**
 * GlobalState: Simple reactive state manager for cross-component communication
 * Works with vanilla JS - no framework needed
 */
const stores = {};

export function createStore(name, initialState = {}) {
  if (stores[name]) return stores[name];
  const state = { ...initialState };
  const listeners = [];

  stores[name] = {
    getState() { return { ...state }; },
    setState(updater) {
      const prev = { ...state };
      if (typeof updater === 'function') {
        Object.assign(state, updater(state));
      } else {
        Object.assign(state, updater);
      }
      listeners.forEach(fn => fn({ prev, curr: { ...state } }));
    },
    subscribe(fn) {
      listeners.push(fn);
      return () => { const i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1); };
    }
  };
  return stores[name];
}

// Pre-built stores
export const appStore = createStore('app', {
  loading: false,
  toasts: [],
  sidebarOpen: false,
  activeModal: null,
  currentPage: 'dashboard'
});

export const dataStore = createStore('data', {
  students: [],
  teachers: [],
  classes: [],
  schedules: [],
  attendance: [],
  hafalan: []
});

// Convenience helpers
export function setLoading(v) { appStore.setState({ loading: v }); }
export function addToast(msg, type = 'info', duration = 3000) {
  const id = Date.now();
  appStore.setState(s => ({ toasts: [...s.toasts, { id, msg, type }] }));
  if (duration > 0) setTimeout(() => removeToast(id), duration);
}
export function removeToast(id) {
  appStore.setState(s => ({ toasts: s.toasts.filter(t => t.id !== id) }));
}
export function toggleSidebar(v) { appStore.setState({ sidebarOpen: v ?? !appStore.getState().sidebarOpen }); }

// Subscribe to store changes and re-render targeted elements
export function bindState(storeName, selector, element, renderFn) {
  const store = stores[storeName];
  if (!store) return;
  store.subscribe(({ curr }) => {
    const relevant = selector(curr);
    if (relevant !== undefined) {
      if (typeof element === 'string') {
        const el = document.querySelector(element);
        if (el) el.textContent = renderFn(relevant);
      } else if (element instanceof HTMLElement) {
        element.textContent = renderFn(relevant);
      }
    }
  });
}
