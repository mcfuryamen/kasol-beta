// ============================================================
// Sync Queue - Track pending changes for Supabase sync
// Follows kak5 ecosystem offline-first pattern
// ============================================================

import { db, type SyncTable, type StudentRecord, type TeacherRecord, type ClassRecord, type AttendanceRecord, type SessionRecord } from '../db/dexie';
import { getSupabase } from '../db/supabase';

export type SyncAction = 'create' | 'update' | 'delete';

export interface QueuedChange {
  id: string;
  table: SyncTable;
  action: SyncAction;
  record_id: string;
  data: any;
  created_at: string;
}

function generateId(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

// ============================================================
// Queue a change for later sync
// ============================================================

export async function queueChange(
  table: SyncTable,
  action: SyncAction,
  recordId: string,
  data: any
): Promise<void> {
  const entry: QueuedChange = {
    id: generateId(),
    table: table as SyncTable,
    action,
    record_id: recordId,
    data,
    created_at: now(),
  };
  await db.sync_queue.add(entry);
}

export async function getPendingChanges(): Promise<QueuedChange[]> {
  return db.sync_queue.orderBy('created_at').toArray();
}

export async function clearSyncedChanges(ids: string[]): Promise<void> {
  await db.sync_queue.bulkDelete(ids);
}

// ============================================================
// Push local changes to Supabase (when online)
// ============================================================

export async function pushToSupabase(): Promise<{ pushed: number; failed: number }> {
  const pending = await getPendingChanges();
  if (pending.length === 0) return { pushed: 0, failed: 0 };

  const supabase = getSupabase();
  let pushed = 0;
  let failed = 0;
  const syncedIds: string[] = [];

  for (const change of pending) {
    try {
      switch (change.table) {
        case 'students':
          if (change.action === 'delete') {
            await supabase.from('students').update({ _deleted: true }).eq('id', change.record_id);
          } else {
            const { error } = change.action === 'create'
              ? await supabase.from('students').insert(change.data)
              : await supabase.from('students').update(change.data).eq('id', change.record_id);
            if (error) throw error;
          }
          break;

        case 'teachers':
          if (change.action === 'delete') {
            await supabase.from('teachers').update({ _deleted: true }).eq('id', change.record_id);
          } else {
            const { error } = change.action === 'create'
              ? await supabase.from('teachers').insert(change.data)
              : await supabase.from('teachers').update(change.data).eq('id', change.record_id);
            if (error) throw error;
          }
          break;

        case 'classes':
          if (change.action === 'delete') {
            await supabase.from('classes').update({ _deleted: true }).eq('id', change.record_id);
          } else {
            const { error } = change.action === 'create'
              ? await supabase.from('classes').insert(change.data)
              : await supabase.from('classes').update(change.data).eq('id', change.record_id);
            if (error) throw error;
          }
          break;

        case 'attendances':
          if (change.action === 'delete') {
            await supabase.from('attendances').delete().eq('id', change.record_id);
          } else {
            const { error } = change.action === 'create'
              ? await supabase.from('attendances').insert(change.data)
              : await supabase.from('attendances').update(change.data).eq('id', change.record_id);
            if (error) throw error;
          }
          break;

        case 'sessions':
          if (change.action === 'delete') {
            await supabase.from('class_sessions').update({ _deleted: true }).eq('id', change.record_id);
          } else {
            const { error } = change.action === 'create'
              ? await supabase.from('class_sessions').insert(change.data)
              : await supabase.from('class_sessions').update(change.data).eq('id', change.record_id);
            if (error) throw error;
          }
          break;
      }

      syncedIds.push(change.id);
      pushed++;
    } catch (err) {
      console.error('[SyncQueue] Failed to push:', change.table, change.record_id, err);
      failed++;
    }
  }

  if (syncedIds.length > 0) {
    await clearSyncedChanges(syncedIds);
  }

  return { pushed, failed };
}

// ============================================================
// Pull remote data from Supabase into Dexie
// ============================================================

export async function pullFromSupabase(locationId: string): Promise<void> {
  const supabase = getSupabase();

  const [studentsRes, teachersRes, classesRes, sessionsRes] = await Promise.all([
    supabase.from('students').select('*').eq('location_id', locationId).eq('_deleted', false),
    supabase.from('teachers').select('*').eq('location_id', locationId).eq('_deleted', false),
    supabase.from('classes').select('*').eq('location_id', locationId).eq('_deleted', false),
    supabase.from('class_sessions').select('*').eq('location_id', locationId).eq('_deleted', false),
  ]);

  const nowStr = now();

  if (studentsRes.data) {
    const students: StudentRecord[] = studentsRes.data.map((s: any) => ({ ...s, _synced_at: nowStr }));
    await db.students.bulkPut(students);
  }

  if (teachersRes.data) {
    const teachers: TeacherRecord[] = teachersRes.data.map((t: any) => ({ ...t, _synced_at: nowStr }));
    await db.teachers.bulkPut(teachers);
  }

  if (classesRes.data) {
    const classes: ClassRecord[] = classesRes.data.map((c: any) => ({ ...c, _synced_at: nowStr }));
    await db.classes.bulkPut(classes);
  }

  if (sessionsRes.data) {
    const sessions: SessionRecord[] = sessionsRes.data.map((s: any) => ({ ...s, _synced_at: nowStr }));
    await db.sessions.bulkPut(sessions);
  }

  console.log('[SyncQueue] Pulled from Supabase:', {
    students: studentsRes.data?.length || 0,
    teachers: teachersRes.data?.length || 0,
    classes: classesRes.data?.length || 0,
    sessions: sessionsRes.data?.length || 0,
  });
}

// ============================================================
// Online/offline sync trigger
// ============================================================

let syncTimeout: ReturnType<typeof setTimeout> | null = null;

export function scheduleSyncOnReconnect(): void {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    const pending = await getPendingChanges();
    if (pending.length > 0) {
      console.log('[SyncQueue] Syncing', pending.length, 'pending changes...');
      await pushToSupabase();
    }
  }, 2000);
}
