# Stage 7 — Beta Candidate 1.0.137-beta.1

Status: **candidate prepared; not released**.

## Scope

This candidate contains the reviewed kaki5 working-tree changes. The intended release boundaries are documented below; no commit, tag, push, deploy, or beta publication is performed by this QA step.

- **P1 local backup:** local export/import signature classification, invalid-signature rejection, unsigned/legacy warning, and restore validation.
- **P2 cloud backup candidate:** versioned cloud envelope, unit binding, SHA-256 payload integrity, and storage-path policy contracts. Live cloud publication remains gated.
- **Quota:** three calendar months since last check-in and Control-managed monthly quota.
- **Other hardening present in the working tree:** sync/device metadata, receipt storage, and license recovery. These should be separated into their own commits before release packaging.

## Version slots

| Slot | Value |
|---|---|
| `APP_VERSION` | `1.0.137-beta.1` |
| `CACHE_BUST` | `v212` |
| `js/version.json.version` | `1.0.137-beta.1` |
| `js/version.json.cacheBust` | `v212` |
| `sw.js CACHE_NAME` | `kasir-solo-kaki5-v212` |
| `index.html` query version | `?v=212` |

## QA fixture

`test-stage7-fixture.js` uses an in-memory, non-production fixture and asserts:

- local origin is `http://127.0.0.1:8086`;
- valid cloud envelope verifies;
- payload mutation is rejected;
- foreign unit is rejected;
- malformed envelope is rejected;
- failed validation leaves the pre-restore snapshot unchanged.

## Release gate

Do not release beta until the owner gives an explicit release command. This file is only the candidate record.

Before beta publication:

1. split the working tree into P1/P2/quota/sync/receipt/recovery commits;
2. rerun full static and isolated runtime QA on the exact packaged diff;
3. observe restore and error telemetry in a staging/QA unit;
4. record rollback and retention procedures.

P2 beta and live release remain separate gates and require separate explicit commands.
