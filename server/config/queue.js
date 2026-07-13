const { Queue, QueueEvents } = require('bullmq');
const { getRedisClient } = require('./redis');
const { info, error } = require('../utils/logger');

/**
 * Common Default Job Options for all queues
 * Ensures automatic retries, exponential backoff, and cleanup.
 */
const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000 // 2 seconds initial delay
  },
  removeOnComplete: {
    age: 3600, // Keep completed jobs for 1 hour
    count: 500 // Or a maximum of 500 completed jobs
  },
  removeOnFail: {
    age: 86400, // Keep failed jobs for 24 hours for debugging
    count: 1000 // Or a maximum of 1000 failed jobs
  }
};

/**
 * Shared Redis connection for BullMQ
 */
const connection = getRedisClient();

/**
 * Factory function to create and configure a new Queue
 * @param {string} queueName - Name of the queue
 * @returns {Queue} - Configured BullMQ Queue instance
 */
const createQueue = (queueName) => {
  const queue = new Queue(queueName, {
    connection,
    defaultJobOptions
  });

  // Monitor Queue events globally using QueueEvents
  const queueEvents = new QueueEvents(queueName, { connection });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    error(`Job ${jobId} in ${queueName} failed: ${failedReason}`);
  });

  let lastQueueErrorTime = 0;
  queueEvents.on('error', (err) => {
    if (err.message && err.message.includes('ECONNREFUSED')) {
      const now = Date.now();
      if (now - lastQueueErrorTime > 10000) {
        error(`Queue Event Error [${queueName}]: ${err.message}`);
        lastQueueErrorTime = now;
      }
    } else {
      error(`Queue Event Error [${queueName}]: ${err.message}`);
    }
  });

  info(`Queue initialized: ${queueName}`);
  
  return queue;
};

// ---------------------------------------------------------
// Queue Instances
// ---------------------------------------------------------

const emailQueue = createQueue('emailQueue');
const ticketQueue = createQueue('ticketQueue');
const notificationQueue = createQueue('notificationQueue');
const paymentQueue = createQueue('paymentQueue');

/**
 * Gracefully close all queues
 */
const closeAllQueues = async () => {
  await Promise.all([
    emailQueue.close(),
    ticketQueue.close(),
    notificationQueue.close(),
    paymentQueue.close()
  ]);
  info('All BullMQ queues have been closed gracefully.');
};

module.exports = {
  emailQueue,
  ticketQueue,
  notificationQueue,
  paymentQueue,
  createQueue,
  closeAllQueues
};
