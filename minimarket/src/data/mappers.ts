const CAMEL_RE = /_([a-z0-9])/g;

function snakeKey(key: string): string {
  return key.replace(/[A-Z]/g, c => "_" + c.toLowerCase());
}

function camelKey(key: string): string {
  return key.replace(CAMEL_RE, (_, c: string) => c.toUpperCase());
}

/** Konversi rekursif camelCase (aplikasi) -> snake_case (kolom Supabase). */
export function toSnake<T>(value: T): any {
  if (Array.isArray(value)) return value.map(toSnake);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as Record<string, any>)) {
      out[snakeKey(k)] = toSnake(v);
    }
    return out;
  }
  return value;
}

/** Konversi rekursif snake_case (kolom Supabase) -> camelCase (aplikasi). */
export function toCamel<T>(value: T): any {
  if (Array.isArray(value)) return value.map(toCamel);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as Record<string, any>)) {
      out[camelKey(k)] = toCamel(v);
    }
    return out;
  }
  return value;
}
