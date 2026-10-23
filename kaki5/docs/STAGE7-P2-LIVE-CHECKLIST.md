# Stage 7 — P2 and live release gates

Status: **prepared only; no beta/live release performed**.

## P2 cloud beta gate

- [ ] Run cloud save/restore only against a dedicated Supabase staging project or QA unit.
- [ ] Snapshot the QA unit's local fixture and cloud object listing before testing.
- [ ] Verify private `backups` bucket owner-prefix RLS.
- [ ] Verify anonymous access is denied.
- [ ] Verify unit A cannot list, download, overwrite, or delete unit B objects.
- [ ] Verify envelope format, unit binding, payload hash, wrong-unit rejection, mutation rejection, and malformed-object rejection.
- [ ] Verify legacy cloud objects are visibly `untrusted` and require explicit confirmation.
- [ ] Observe restore success/failure telemetry without logging token, signature, or raw cloud response.
- [ ] Record rollback: stop new uploads, retain prior objects, and revert candidate only after snapshot confirmation.
- [ ] Wait for explicit command before P2 beta publication.

## Live release gate

- [ ] P1 beta evidence is stable across the agreed observation window.
- [ ] P2 beta evidence is stable across the agreed observation window.
- [ ] Full diff is separated into P1/P2/quota/sync/receipt/recovery changes.
- [ ] Six version slots match exactly.
- [ ] Applied RLS/Storage migration is reviewed and independently verified.
- [ ] Backup retention and cleanup behavior is verified with pagination/ordering assumptions documented.
- [ ] Restore rollback and data-safety snapshots are archived.
- [ ] Telemetry dashboard and alert owner are assigned.
- [ ] Release notes and user-facing recovery instructions are ready.
- [ ] Wait for explicit command before live release.

No deploy, tag, push, beta publication, or live publication is authorized by this checklist alone.
