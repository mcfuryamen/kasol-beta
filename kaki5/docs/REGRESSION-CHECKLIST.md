# Anti-Regression Checklist (P4)

Manual + automated guardrails so past silent regressions never come back.
Created 2026-08-11 as part of the P1–P7 repair plan.

---

## 1. Why this exists

The app has a recurring bug class: a `render*()` function grabs an element by id,
it fails to find it, and the code's **null-safe guard** swallows the error — so the
feature silently disappears with no crash and no log. Two instances have hit users:

- **`#licenseInfoCard`** — the Settings license card simply stopped rendering.
- **`#syncStatusText`** — the sync status line went quiet.

This checklist + the automated lint (`test-html-refs.js`) make that class of
regression loud instead of silent.

---

## 2. Rule: every `getElementById` must resolve

Any id passed to `document.getElementById('...')` **must** exist in one of two places:

1. **Statically** in `index.html` (`id="..."`), OR
2. **Dynamically injected before first use** (an `id="..."` inside a template
   string, or `el.id = '...'` in a module that runs earlier).

If you remove an element from `index.html`, either:
- Remove every `getElementById` that references it, **or**
- Null-guard the access (`const el = ...; if (!el) return;`).

### Critical ids (have regressed historically — treat with extra care)

| id | Owned by | Feature |
|----|----------|---------|
| `#licenseInfoCard` | license.ui.js | Settings license status card |
| `#syncStatusText` | settings.ui.js | Settings sync status line |
| `#licUnit` | settings.ui.js | License unit identifier |
| `#installBanner` | pwa.js | PWA install prompt banner |
| `#licenseGate` / `#gateLicenseBlock` | app.js | Activation gate / block |

> **Order-of-operations trap:** dynamically-injected ids (`#gateSerial`,
> `#gateLicMsg`, `#platCarouselRoot`, `#platTrack`, `#buktiInput`,
> `#buktiPreview`, `#submitPurchaseBtn`, `#customStartInput`, `#customEndInput`)
> are only present **after** their injecting function runs. Never reference one
> before its injector has executed.

---

## 3. Rule: version / cache bumps must travel together

The app uses **one source of truth** for the version — `js/version.js`:

```
export const APP_VERSION  = '1.0.0';        // UI label + semantic version
export const CACHE_BUST   = 'v1';           // app.js script/link query string
```

A second, independent constant lives in the service worker:

```
// sw.js
const CACHE_NAME = 'kasir-solo-kaki5-v41';  // must match the pattern below
```

### When you ship ANY change to assets (js, css, html, icons)

Bump **all three** in lockstep, or users get stale cached code:

1. `js/version.js` → `APP_VERSION` (and `CACHE_BUST`).
2. `sw.js` → `CACHE_NAME` version suffix (`v41`, `v42`, …).
3. `index.html` → the cache-busting `?v=`/`?v=` on `<script>`/`<link>` tags.
4. `README.md` → the documented `?v=` value (it documents what users should see).

> **Where they live today:** `CACHE_BUST = 'v1'` in version.js drives app.js URLs;
> `sw.js` `CACHE_NAME` is `v41`. If either moves, update BOTH and this doc's table.

### Cache version bump checklist (SW precache)

- [ ] New `CACHE_NAME` suffix (**strictly greater** than the previous).
- [ ] New/modified assets actually appear in the precache `assetsToCache` list
      (e.g. the modular CSS under `assets/css/` — a past MAJOR finding).
- [ ] Cache-bust query param on every `<script>`/`<link>` in `index.html`.
- [ ] Old-cache cleanup still works (`caches.keys().filter(k => k !== CACHE_NAME)`
      in the activate handler deletes prior versions).

---

## 4. Automated guards (run before every release)

```bash
# Syntax + real ESM import of every module (catches the stray-catch false-pass)
node test-modules.js          # exit 1 on ANY module failure

# Every getElementById resolves (this lint) — quick:
node test-html-refs.js        # exit 1 on orphaned refs

# Full suite:
node test-imports.js          # 37/37 module imports
node test_validate.js         # license/serial validation
node test_pos.js              # POS math/change
```

Add `node test-html-refs.js` to your pre-commit hook / CI after `test-modules.js`.

---

## 5. What to do when you hit a regression

1. **Run the lint** — `node test-html-refs.js` names the orphaned id + file:line.
2. Re-add the element to `index.html` **or** inject it before first use.
3. Confirm the owning `render*()` function now finds it (visually in the app).
4. Bump the cache version trio (§3) so the fix actually reaches users.
