/**
 * minimarket/src/logic/services/license/db.ts
 * Dexie IndexedDB — KasirSolo Minimarket
 * Schema v1: settings, cache
 */
import Dexie from 'dexie';

interface SettingRow { key: string; value: unknown }

class KasirSoloDB extends Dexie {
  settings!: Dexie.Table<SettingRow, string>;
  cache!: Dexie.Table<SettingRow, string>;
}

export const db = new KasirSoloDB('KasirSoloMinimarket');

db.version(1).stores({
  settings: 'key',
  cache: 'key'
});

export async function getSetting(key: string, defaultValue: unknown = null): Promise<unknown> {
  try {
    const row = await db.settings.get(key);
    return row ? row.value : defaultValue;
  } catch {
    return defaultValue;
  }
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}
