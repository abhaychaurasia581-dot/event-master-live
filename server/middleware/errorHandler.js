const env = require('../config/env');
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  
  logger.error(`[${req.method}] ${req.url} - ${err.message}`, err.stack);

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    errors: err.errors || [],
    stack: env.nodeEnv === 'production' ? null : err.stack,
  });
};

module.exports = errorHandler;
