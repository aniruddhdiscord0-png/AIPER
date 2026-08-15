import axios from 'axios';

/**
 * Fetches data from a URL using a Stale-While-Revalidate strategy.
 * - If cached data exists in sessionStorage, it immediately calls `setter` with the cached data (0ms render).
 * - It then fetches fresh data from the server in the background and calls `setter` again with the fresh data.
 * - The fresh data is written back to the cache for the next load.
 *
 * @param {string} url - The API endpoint to fetch from.
 * @param {string} cacheKey - The sessionStorage key to use for caching.
 * @param {Function} setter - A React setState function to update the UI.
 * @param {Object} headers - Optional Axios request headers (e.g., Authorization).
 * @param {Object} options - Options object. Pass { cache: false } to bypass caching.
 */
export async function fetchWithCache(url, cacheKey, setter, headers = {}, { cache = true } = {}) {
  // Step 1: Instantly render from cache if available
  if (cache) {
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed !== null && typeof parsed === 'object') {
          setter(parsed);
        }
      }
    } catch (e) {
      // Silently fail if sessionStorage is unavailable or data is corrupt
      sessionStorage.removeItem(cacheKey);
    }
  }

  // Step 2: Fetch fresh data from the server in the background
  const res = await axios.get(url, { headers });

  // Step 3: Update the UI with fresh data
  if (res.data !== null && typeof res.data === 'object') {
    setter(res.data);

    // Step 4: Write fresh data back to the cache
    if (cache) {
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(res.data));
      } catch (e) {
        // QuotaExceededError — remove this key AND try to free space
        console.warn(`[Cache] Write failed for key "${cacheKey}", clearing stale data.`, e.name);
        sessionStorage.removeItem(cacheKey);
        // Attempt to clear the largest volatile keys to free space
        try {
          ['aiper_jobs', 'aiper_instances', 'aiper_transfers_in', 'aiper_transfers_out'].forEach(k => sessionStorage.removeItem(k));
          // Retry the write once
          sessionStorage.setItem(cacheKey, JSON.stringify(res.data));
        } catch (retryErr) {
          // Still failed — give up gracefully. Next load will be a fresh fetch.
          console.warn(`[Cache] Retry also failed for "${cacheKey}". Operating without cache.`);
        }
      }
    }
  }

  return res.data;
}

/**
 * Removes a specific key from the sessionStorage cache.
 * Call this after any write operation (create, update, delete) to ensure
 * the next fetch retrieves fresh data rather than stale cached data.
 *
 * @param {...string} keys - One or more cache keys to invalidate.
 */
export function invalidateCache(...keys) {
  keys.forEach(key => sessionStorage.removeItem(key));
}

// --- Cache Key Constants ---
// Centralised here so they're never mistyped across multiple files.
export const CACHE_KEYS = {
  JOBS: 'aiper_jobs',
  USERS: 'aiper_users',
  INSTANCES: 'aiper_instances',
  STATS: 'aiper_stats',
  MY_TASKS: 'aiper_my_tasks',
  TRANSFERS_IN: 'aiper_transfers_in',
  TRANSFERS_OUT: 'aiper_transfers_out',
  GROUPS: 'aiper_groups',
  GLOBAL_PARAMS: 'aiper_global_params',
};
