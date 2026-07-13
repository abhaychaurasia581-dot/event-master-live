const { getRedisClient } = require('../config/redis');
const { error: logError } = require('../utils/logger');
const ApiError = require('../utils/apiError');

/**
 * Advanced Redis-based Rate Limiter Factory
 * 
 * Provides distributed, high-performance rate limiting using Redis Fixed Window algorithm.
 * Fails open (graceful degradation) if Redis is unavailable to ensure high availability.
 * 
 * @param {Object} options
 * @param {string} options.type - The strategy to use: 'IP' (default) or 'USER'
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum number of allowed requests per window
 * @param {string} options.prefix - Namespace for Redis keys
 */
const rateLimiter = ({ type = 'IP', windowMs = 60 * 1000, max = 100, prefix = 'rl:global' }) => {
  return async (req, res, next) => {
    try {
      let redis;
      try {
        redis = getRedisClient();
      } catch (e) {
        // Redis not initialized yet or not available
        redis = null;
      }

      if (!redis || redis.status !== 'ready') {
        // Graceful degradation: Fail open if Redis is down or reconnecting so the API doesn't hang
        return next();
      }

      // Determine the unique identifier based on the strategy
      let identifier;
      if (type === 'USER' && req.user && req.user.id) {
        identifier = req.user.id;
      } else {
        // Fallback to IP if USER strategy is chosen but user is not authenticated yet
        identifier = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
      }

      // Identify the endpoint for endpoint-specific limits
      const endpoint = req.route ? req.route.path : req.path;
      
      // Construct the strict Redis key: namespace:strategy:id:endpoint
      const cacheKey = `${prefix}:${type}:${identifier}:${endpoint}`;

      // Perform atomic increment
      const current = await redis.incr(cacheKey);

      if (current === 1) {
        // Set expiry accurately in milliseconds for the first request in the window
        await redis.pexpire(cacheKey, windowMs);
      } else {
        // Safety net: ensure TTL exists just in case the server crashed between incr and pexpire
        const ttl = await redis.pttl(cacheKey);
        if (ttl === -1) {
          await redis.pexpire(cacheKey, windowMs);
        }
      }

      // Attach standard Rate Limit headers for client visibility
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - current));

      // Check if threshold exceeded
      if (current > max) {
        return res.status(429).json({
          success: false,
          message: 'Too many requests, please try again later.',
          errors: [{ msg: `Rate limit exceeded. Maximum ${max} requests allowed per time window.` }]
        });
      }

      next();
    } catch (err) {
      logError(`Rate Limiter Error [${prefix}]: ${err.message}`);
      // Fail open: ensure enterprise app doesn't go down because of a rate limiting error
      next();
    }
  };
};

module.exports = rateLimiter;
