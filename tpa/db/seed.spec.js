import assert from 'node:assert/strict';
import { seedDemoData } from './seed.js';

const originalLocation = globalThis.location;
delete globalThis.location;
delete globalThis.__TPA_DEMO_MODE__;
await assert.rejects(() => seedDemoData(), error => error.message === 'demo_mode_required');
globalThis.location = originalLocation;
console.log('TPA demo seed guard tests: PASS');
