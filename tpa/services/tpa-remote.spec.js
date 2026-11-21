import assert from 'node:assert/strict';
import { normalizeRemoteTeacherRoster } from './tpa-remote-normalize.js';

const classes = [
  { id: 'class-a', name: 'A', is_primary: true },
  { id: 'class-b', name: 'B', is_primary: false }
];
const students = [
  { id: 'student-a', class_id: 'class-a', name: 'Santri A' },
  { id: 'student-b', class_id: 'class-a', name: 'Santri B' },
  { id: 'student-c', class_id: 'class-other', name: 'Bukan kelas guru' }
];
const roster = normalizeRemoteTeacherRoster(classes, students);
assert.deepEqual(roster.map(item => item.student_count), [2, 0]);
assert.equal(roster[0].id, 'class-a');
assert.equal(typeof roster[0].id, 'string');
console.log('TPA remote teacher roster tests: PASS');
