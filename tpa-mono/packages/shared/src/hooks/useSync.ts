import { useState, useEffect, useCallback } from 'preact/hooks';
import { syncEngine, SyncOptions } from '../db/sync';
import { useOffline } from './useOffline';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export function useSync(options?: SyncOptions) {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const { isOnline } = useOffline();

  const sync = useCallback(async () => {
    if (!options || !isOnline) return;
    setStatus('syncing');
    try {
      await syncEngine.startSync(options);
      setStatus('synced');
      setLastSync(new Date());
    } catch {
      setStatus('error');
    }
  }, [options, isOnline]);

  useEffect(() => {
    const handler = () => sync();
    window.addEventListener('app:sync', handler);
    return () => window.removeEventListener('app:sync', handler);
  }, [sync]);

  useEffect(() => {
    if (isOnline && options) sync();
    return () => syncEngine.stopSync();
  }, [isOnline]);

  return { status, lastSync, sync };
}
