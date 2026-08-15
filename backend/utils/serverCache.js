const NodeCache = require('node-cache');

// TTL: 300 seconds (5 minutes), check expired keys every 60 seconds
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

/**
 * Cache middleware factory.
 * Wraps a route handler — returns cached response if available, otherwise
 * calls the handler and caches the response.
 *
 * @param {string} keyPrefix - A unique prefix for this route's cache key.
 *   The final key is: `${keyPrefix}:${req.user._id}:${req.originalUrl}`
 *   This ensures role/user separation and query-string differentiation.
 */
function cacheMiddleware(keyPrefix) {
  return (req, res, next) => {
    const key = `${keyPrefix}:${req.user?._id || 'anon'}:${req.originalUrl}`;
    const cached = cache.get(key);

    if (cached) {
      try {
        return res.json(JSON.parse(cached));
      } catch (e) {
        return res.json(cached); // fallback if it was cached without stringify
      }
    }

    // Override res.json to intercept and cache the response
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // Only cache successful responses (status 2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          // Stringify to avoid node-cache clone errors on complex mongoose objects
          cache.set(key, JSON.stringify(body));
        } catch (err) {
          console.error("Cache serialization error:", err);
        }
      }
      return originalJson(body);
    };

    next();
  };
}

/**
 * Invalidate all cache entries matching a prefix.
 * Call this after any write operation that affects cached data.
 *
 * @param {string} keyPrefix - The prefix used when caching (e.g., 'parameters', 'groups').
 */
function invalidateByPrefix(keyPrefix) {
  const keys = cache.keys().filter(k => k.startsWith(keyPrefix));
  keys.forEach(k => cache.del(k));
}

module.exports = { cache, cacheMiddleware, invalidateByPrefix };
