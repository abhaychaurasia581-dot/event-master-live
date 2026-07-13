const { getRedisClient } = require('../config/redis');
const { info, error: logError } = require('../utils/logger');
const ApiError = require('../utils/apiError');

/**
 * Safely fetches the Redis client. 
 * If Redis is unavailable, returns null to ensure graceful fallback.
 */
const getClient = () => {
  try {
    return getRedisClient();
  } catch (err) {
    return null;
  }
};

/**
 * Helper to safely serialize data to JSON string
 */
const serialize = (value) => {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
};

/**
 * Helper to safely deserialize JSON string to object
 */
const deserialize = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (e) {
    // If it's a plain string that can't be parsed, return as is
    return value;
  }
};

/**
 * Production-ready Cache Service.
 * Acts as a single abstraction layer for all Redis operations.
 */
class CacheService {
  
  // ============================================================================
  // Basic Cache Operations
  // ============================================================================

  static async get(key) {
    try {
      const redis = getClient();
      if (!redis || redis.status !== 'ready') return null;

      const data = await redis.get(key);
      
      if (data) {
        info(`Cache Hit: [${key}]`);
        return deserialize(data);
      }
      
      info(`Cache Miss: [${key}]`);
      return null;
    } catch (err) {
      logError(`CacheService.get Error [${key}]: ${err.message}`);
      return null; // Graceful fallback
    }
  }

  static async set(key, value, ttl = 3600) {
    try {
      const redis = getClient();
      if (!redis || redis.status !== 'ready') return false;

      const stringValue = serialize(value);
      await redis.setex(key, ttl, stringValue);
      
      info(`Cache Set: [${key}] with TTL ${ttl}s`);
      return true;
    } catch (err) {
      logError(`CacheService.set Error [${key}]: ${err.message}`);
      return false;
    }
  }

  static async del(key) {
    try {
      const redis = getClient();
      if (!redis || redis.status !== 'ready') return false;

      await redis.del(key);
      info(`Cache Delete: [${key}]`);
      return true;
    } catch (err) {
      logError(`CacheService.del Error [${key}]: ${err.message}`);
      return false;
    }
  }

  static async exists(key) {
    try {
      const redis = getClient();
      if (!redis || redis.status !== 'ready') return false;

      const result = await redis.exists(key);
      return result === 1;
    } catch (err) {
      logError(`CacheService.exists Error [${key}]: ${err.message}`);
      return false;
    }
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  static async mget(keys) {
    if (!Array.isArray(keys) || keys.length === 0) return [];
    try {
      const redis = getClient();
      if (!redis || redis.status !== 'ready') return keys.map(() => null);

      const data = await redis.mget(keys);
      return data.map(deserialize);
    } catch (err) {
      logError(`CacheService.mget Error: ${err.message}`);
      return keys.map(() => null);
    }
  }

  static async mset(dataObject, ttl = 3600) {
    try {
      const redis = getClient();
      if (!redis || redis.status !== 'ready') return false;

      const pipeline = redis.pipeline();
      for (const [key, value] of Object.entries(dataObject)) {
        pipeline.setex(key, ttl, serialize(value));
      }
      
      await pipeline.exec();
      info(`Cache Bulk Set (mset) for ${Object.keys(dataObject).length} keys`);
      return true;
    } catch (err) {
      logError(`CacheService.mset Error: ${err.message}`);
      return false;
    }
  }

  // ============================================================================
  // Pattern & Namespace Operations
  // ============================================================================

  static async deleteByPattern(pattern) {
    try {
      const redis = getClient();
      if (!redis || redis.status !== 'ready') return false;

      // Use SCAN instead of KEYS for production safety
      let cursor = '0';
      let keysDeleted = 0;

      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;

        if (keys.length > 0) {
          await redis.del(...keys);
          keysDeleted += keys.length;
        }
      } while (cursor !== '0');

      info(`Cache Pattern Delete: [${pattern}] removed ${keysDeleted} keys`);
      return true;
    } catch (err) {
      logError(`CacheService.deleteByPattern Error [${pattern}]: ${err.message}`);
      return false;
    }
  }

  static async invalidateNamespace(namespace) {
    // E.g., invalidateNamespace('events') will delete all keys starting with 'events:*'
    return this.deleteByPattern(`${namespace}:*`);
  }

  // ============================================================================
  // Utility Operations
  // ============================================================================

  /**
   * Classic "Cache Remember" pattern.
   * If key exists, return it. If not, execute callback, store result in cache, and return it.
   */
  static async remember(key, ttl, callback) {
    try {
      const cachedData = await this.get(key);
      if (cachedData !== null) {
        return cachedData;
      }

      const freshData = await callback();
      
      // Do not cache null/undefined/empty arrays to avoid caching errors
      if (freshData !== undefined && freshData !== null && (Array.isArray(freshData) ? freshData.length > 0 : true)) {
        await this.set(key, freshData, ttl);
      }
      
      return freshData;
    } catch (err) {
      logError(`CacheService.remember Error [${key}]: ${err.message}`);
      // Graceful fallback: just execute callback and return without caching
      return await callback();
    }
  }

  static async flushAll() {
    try {
      const redis = getClient();
      if (!redis || redis.status !== 'ready') return false;

      await redis.flushdb();
      info('Cache FlushAll: Entire Redis DB cleared');
      return true;
    } catch (err) {
      logError(`CacheService.flushAll Error: ${err.message}`);
      return false;
    }
  }

  static async getTTL(key) {
    try {
      const redis = getClient();
      if (!redis || redis.status !== 'ready') return -1;

      return await redis.ttl(key);
    } catch (err) {
      logError(`CacheService.getTTL Error [${key}]: ${err.message}`);
      return -1;
    }
  }

  static async extendTTL(key, additionalSeconds) {
    try {
      const redis = getClient();
      if (!redis || redis.status !== 'ready') return false;

      const currentTTL = await redis.ttl(key);
      if (currentTTL > 0) {
        await redis.expire(key, currentTTL + additionalSeconds);
        info(`Cache Extend TTL: [${key}] extended by ${additionalSeconds}s`);
        return true;
      }
      return false;
    } catch (err) {
      logError(`CacheService.extendTTL Error [${key}]: ${err.message}`);
      return false;
    }
  }

  // ============================================================================
  // Health Operations
  // ============================================================================

  static async healthCheck() {
    try {
      const redis = getClient();
      if (!redis) {
        return { status: 'unhealthy', error: 'Redis client not initialized' };
      }

      const startTime = Date.now();
      await redis.ping();
      const pingLatency = Date.now() - startTime;

      // Extract basic memory info securely without crashing
      const memoryInfoRaw = await redis.info('memory');
      const memoryMatch = memoryInfoRaw.match(/used_memory_human:(.*)/);
      const memoryUsage = memoryMatch ? memoryMatch[1].trim() : 'Unknown';

      const clientsInfoRaw = await redis.info('clients');
      const clientsMatch = clientsInfoRaw.match(/connected_clients:(.*)/);
      const connectedClients = clientsMatch ? parseInt(clientsMatch[1].trim()) : 0;

      return {
        status: 'healthy',
        pingLatencyMs: pingLatency,
        memoryUsage,
        connectedClients
      };
    } catch (err) {
      logError(`CacheService.healthCheck Error: ${err.message}`);
      return { status: 'unhealthy', error: err.message };
    }
  }
}

module.exports = CacheService;
