const Redis = require('ioredis');
const env = require('./env');
const { info, error } = require('../utils/logger');

/**
 * Singleton Redis Client Instance
 */
let redisClient = null;

/**
 * Initialize and connect to Redis
 * Retries connection automatically with backoff strategy.
 */
const connectRedis = () => {
  if (redisClient) {
    return redisClient;
  }

  const redisOptions = {
    host: env.redisHost || '127.0.0.1',
    port: env.redisPort || 6379,
    password: env.redisPassword || undefined,
    // BullMQ requires maxRetriesPerRequest to be null
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy(times) {
      // Reconnect max 3 times, then stop silently
      if (times > 3) {
        return null;
      }
      return Math.min(times * 50, 2000);
    }
  };

  redisClient = new Redis(redisOptions);

  redisClient.on('connect', () => {
    info('Redis connection established successfully.');
  });

  redisClient.on('ready', () => {
    info('Redis client is ready to receive commands.');
  });

  let lastErrorTime = 0;
  redisClient.on('error', (err) => {
    if (err.code === 'ECONNREFUSED') {
      const now = Date.now();
      if (now - lastErrorTime > 10000) { // Log connection refused only once every 10 seconds
        error(`Redis connection error: ${err.message} (suppressing further connection errors)`);
        lastErrorTime = now;
      }
    } else {
      error(`Redis connection error: ${err.message}`);
    }
  });

  redisClient.on('close', () => {
    info('Redis connection closed.');
  });

  let lastReconnectLogTime = 0;
  redisClient.on('reconnecting', () => {
    const now = Date.now();
    if (now - lastReconnectLogTime > 10000) {
      info('Redis client is reconnecting...');
      lastReconnectLogTime = now;
    }
  });

  return redisClient;
};

/**
 * Get the initialized Redis client
 */
const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis client has not been initialized. Please call connectRedis() first.');
  }
  return redisClient;
};

/**
 * Gracefully close the Redis connection
 */
const closeRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    info('Redis connection gracefully closed.');
  }
};

module.exports = {
  connectRedis,
  getRedisClient,
  closeRedis
};
