// ============================================================
// RxDB <-> Supabase Sync Engine
// ============================================================

import { getSupabase } from './supabase';

export interface SyncOptions {
  table: string;
  collection: any; // RxCollection
  locationId?: string;
  batchSize?: number;
}

export class SyncEngine {
  private syncActive = false;
  private subscriptions: Array<() => void> = [];

  async pullFromSupabase(options: SyncOptions): Promise<void> {
    const { table, collection, locationId, batchSize = 100 } = options;
    const supabase = getSupabase();

    let query = supabase.from(table).select('*').order('updated_at', { ascending: false }).limit(batchSize);
    if (locationId) {
      query = query.eq('location_id', locationId);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) return;

    await collection.bulkUpsert(data.map((row: any) => ({
      ...row,
      _deleted: false,
    })));
  }

  async pushToSupabase(options: SyncOptions): Promise<void> {
    const { table, collection } = options;
    const supabase = getSupabase();

    const dirtyDocs = await collection.find({ selector: { _dirty: true } }).exec();

    for (const doc of dirtyDocs) {
      const data = doc.toJSON();
      delete data._dirty;
      delete data._deleted;
      delete data._rev;

      const { error } = await supabase.from(table).upsert(data);
      if (error) {
        console.error(`Sync error for ${table}:`, error);
        continue;
      }

      await doc.incrementalPatch({ _dirty: false });
    }
  }

  subscribeToRealtime(table: string, locationId: string, callback: (payload: any) => void) {
    const supabase = getSupabase();
    const channel = supabase
      .channel(`${table}_changes`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table,
        filter: locationId ? `location_id=eq.${locationId}` : undefined,
      }, callback)
      .subscribe();

    this.subscriptions.push(() => channel.unsubscribe());
    return channel;
  }

  async startSync(options: SyncOptions): Promise<void> {
    this.syncActive = true;
    await this.pullFromSupabase(options);

    this.subscribeToRealtime(options.table, options.locationId || '', async (payload) => {
      if (!this.syncActive) return;
      if (payload.eventType === 'DELETE') {
        const doc = await options.collection.findOne(payload.old.id).exec();
        if (doc) await doc.remove();
      } else {
        await options.collection.upsert({ ...payload.new, _deleted: false });
      }
    });
  }

  stopSync(): void {
    this.syncActive = false;
    this.subscriptions.forEach(unsub => unsub());
    this.subscriptions = [];
  }
}

export const syncEngine = new SyncEngine();
