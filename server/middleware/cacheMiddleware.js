const { getRedisClient } = require('../config/redis');
const { info, error: logError } = require('../utils/logger');

/**
 * Production-ready Express middleware to cache API responses in Redis.
 * Intercepts the response, stores it, and serves it for subsequent identical requests.
 * 
 * @param {number} durationInSeconds - Cache Time-To-Live (TTL)
 * @param {string} cachePrefix - Namespace for the cache keys (e.g., 'events', 'categories')
 */
const cacheMiddleware = (durationInSeconds = 300, cachePrefix = 'api') => {
  return async (req, res, next) => {
    // 1. Only cache GET requests. POST/PUT/DELETE should never be cached this way.
    if (req.method !== 'GET') {
      return next();
    }

    // 2. Allow clients to aggressively bypass cache if they request fresh data
    if (req.query.fresh === 'true' || req.headers['x-bypass-cache'] === 'true') {
      info(`Cache Bypass requested for: ${req.originalUrl}`);
      return next();
    }

    try {
      const redis = getRedisClient();
      
      // 3. Construct a deterministic cache key
      // e.g., events:/api/v1/events?page=1&limit=10
      const cacheKey = `${cachePrefix}:${req.originalUrl}`;

      // 4. Check Redis for an existing cached response
      const cachedResponse = await redis.get(cacheKey);

      if (cachedResponse) {
        info(`Cache HIT: [${cacheKey}]`);
        res.setHeader('X-Cache', 'HIT');
        // Parse the stored JSON string and send it back immediately
        return res.status(200).json(JSON.parse(cachedResponse));
      }

      info(`Cache MISS: [${cacheKey}]`);
      res.setHeader('X-Cache', 'MISS');

      // 5. Intercept res.json to capture the controller's output
      const originalJson = res.json.bind(res);

      res.json = (body) => {
        // Only cache successful 200 OK responses to prevent caching errors or 404s
        if (res.statusCode === 200) {
          // Store in Redis asynchronously to prevent blocking the response time
          redis.setex(cacheKey, durationInSeconds, JSON.stringify(body))
            .catch(err => logError(`Redis Cache Set Error for [${cacheKey}]: ${err.message}`));
        }

        // Complete the request by sending the body to the client
        return originalJson(body);
      };

      // Proceed to the controller
      next();

    } catch (err) {
      logError(`Cache Middleware Error: ${err.message}`);
      // Graceful degradation: If Redis is unavailable, bypass caching and let the app function normally
      next();
    }
  };
};

module.exports = cacheMiddleware;
