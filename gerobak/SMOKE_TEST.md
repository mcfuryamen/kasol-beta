# 🧪 Smoke Test Script - Copy ke Browser Console

Buka `<INTERNAL_URL_REDACTED> F12 → Console tab, lalu copy-paste script di bawah ini:

---

## TEST 1: Basic App Load
```javascript
console.log('=== TEST 1: Basic App Load ===');
const app = document.getElementById('app');
console.log('App container exists:', !!app);
console.log('Dexie loaded:', typeof Dexie !== 'undefined');
console.log('App JS loaded:', typeof window.__KG_NAV__ !== 'undefined');
```

## TEST 2: Navigation
```javascript
console.log('=== TEST 2: Navigation ===');
console.log('Current view:', window.currentView || 'unknown');
window.__KG_NAV__('menu');
setTimeout(() => {
  console.log('After navigate to menu, view:', window.currentView);
  window.__KG_NAV__('dashboard');
}, 1000);
```

## TEST 3: Database Connection
```javascript
console.log('=== TEST 3: Database ===');
db.version().then(v => {
  console.log('DB Version:', v);
  return db.menuCategories.count();
}).then(count => {
  console.log('Menu categories count:', count);
  return db.menuItems.count();
}).then(count => {
  console.log('Menu items count:', count);
}).catch(err => {
  console.error('DB Error:', err);
});
```

## TEST 4: Service Worker
```javascript
console.log('=== TEST 4: Service Worker ===');
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    console.log('SW Registrations:', regs.length);
    regs.forEach(reg => {
      console.log('  Scope:', reg.scope);
      console.log('  State:', reg.active ? reg.active.state : 'no active worker');
    });
  });
} else {
  console.log('SW not supported');
}
```

## TEST 5: PWA Manifest
```javascript
console.log('=== TEST 5: PWA Manifest ===');
fetch('./manifest.json')
  .then(r => r.json())
  .then(manifest => {
    console.log('Manifest loaded:', !!manifest);
    console.log('Name:', manifest.name);
    console.log('Start URL:', manifest.start_url);
    console.log('Scope:', manifest.scope);
  })
  .catch(err => console.error('Manifest error:', err));
```

## TEST 6: CSS Loaded
```javascript
console.log('=== TEST 6: CSS ===');
const stylesheets = document.styleSheets;
console.log('Stylesheets loaded:', stylesheets.length);
let cssLoaded = false;
for (let sheet of stylesheets) {
  if (sheet.href && sheet.href.includes('style.css')) {
    cssLoaded = true;
    console.log('style.css loaded:', true);
  }
}
if (!cssLoaded) console.log('WARNING: style.css not loaded!');
```

## TEST 7: Simulasi Offline
```javascript
console.log('=== TEST 7: Offline Simulation ===');
console.log('To test offline:');
console.log('1. Go to DevTools → Network tab');
console.log('2. Check "Offline" box');
console.log('3. Refresh page');
console.log('4. App should still load from SW cache');
```

---

**COPY-PASTE TIAP TEST KE CONSOLE, LALU KASIH TAU GUE HASILNYA!** 🚀
