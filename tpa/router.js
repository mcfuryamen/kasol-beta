/**
 * Router: Hash-based SPA router
 * Usage: import { initRouter } from './router.js'; initRouter(routes);
 * Routes: { path: string, component: () => HTMLElement }
 */
import { el } from './db/init.js';

const listeners = [];

export function initRouter(routes, defaultRoute = '/') {
  function getRoute() {
    const hash = window.location.hash.slice(1) || defaultRoute;
    // Try exact match first, then pattern match with params
    let route = routes[hash];
    if (route) return { path: hash, component: route };
    // Try dynamic routes like /student/:id
    for (const [pattern, handler] of Object.entries(routes)) {
      if (pattern.includes(':')) {
        const patternParts = pattern.split('/');
        const hashParts = hash.split('/');
        if (patternParts.length === hashParts.length) {
          const params = {};
          let match = true;
          for (let i = 0; i < patternParts.length; i++) {
            if (patternParts[i].startsWith(':')) {
              params[patternParts[i].slice(1)] = hashParts[i];
            } else if (patternParts[i] !== hashParts[i]) {
              match = false;
              break;
            }
          }
          if (match) return { path: hash, component: handler, params };
        }
      }
    }
    return { path: hash, component: routes[defaultRoute] || (() => el('div', { text: '404 Not Found' })) };
  }

  function render() {
    const { path, component, params } = getRoute();
    const main = document.getElementById('router-view') || document.getElementById('main-content') || document.getElementById('app');
    if (main) {
      main.innerHTML = '';
      const result = component({ path, params });
      if (result instanceof HTMLElement) {
        main.appendChild(result);
      } else if (typeof result === 'string') {
        main.innerHTML = result;
      }
    }
    listeners.forEach(fn => fn({ path, params }));
  }

  window.addEventListener('hashchange', render);
  render();

  return {
    navigate(path) {
      window.location.hash = path;
    },
    getCurrentPath() {
      return window.location.hash.slice(1) || defaultRoute;
    },
    onChange(fn) {
      listeners.push(fn);
      return () => { const i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1); };
    }
  };
}

export function navigate(path) {
  window.location.hash = path;
}
