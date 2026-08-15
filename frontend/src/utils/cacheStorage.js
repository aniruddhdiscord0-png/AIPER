import { get, set, del } from 'idb-keyval';

// ── Which keys go to IndexedDB vs sessionStorage ──
// Large, volatile data → IndexedDB (no size limit)
// Small, stable data → sessionStorage (fast sync access)
const IDB_KEYS = new Set([
  'aiper_jobs',
  'aiper_instances',
  'aiper_my_tasks',
  'aiper_transfers_in',
  'aiper_transfers_out',
]);

/**
 * Read a value from the appropriate storage backend.
 * Returns the parsed object, or null if not found.
 */
export async function cacheGet(key) {
  if (IDB_KEYS.has(key)) {
    try {
      const val = await get(key);
      return val ?? null;
    } catch {
      return null;
    }
  }
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}

/**
 * Write a value to the appropriate storage backend.
 * Handles serialization automatically.
 */
export async function cacheSet(key, value) {
  if (IDB_KEYS.has(key)) {
    try {
      await set(key, value);
    } catch (e) {
      console.warn(`[IDB] Write failed for "${key}"`, e);
    }
    return;
  }
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`[SS] Write failed for "${key}", clearing.`, e.name);
    sessionStorage.removeItem(key);
  }
}

/**
 * Delete one or more keys from the appropriate storage backend.
 */
export async function cacheDel(...keysToDelete) {
  for (const key of keysToDelete) {
    if (IDB_KEYS.has(key)) {
      try { await del(key); } catch { /* ignore */ }
    } else {
      sessionStorage.removeItem(key);
    }
  }
}

/**
 * Synchronously check if a key is cached.
 * Returns true only for sessionStorage keys (sync check).
 * For IDB keys, always returns false — the async read in fetchWithCache handles it.
 */
export function isCached(key) {
  if (IDB_KEYS.has(key)) return false;
  return sessionStorage.getItem(key) !== null;
}
