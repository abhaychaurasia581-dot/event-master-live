const morgan = require('morgan');

const logger = {
  info: (message) => console.log(`[INFO] ${new Date().toISOString()} - ${message}`),
  error: (message, meta = '') => console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, meta),
  warn: (message) => console.warn(`[WARN] ${new Date().toISOString()} - ${message}`),
};

const morganMiddleware = morgan(
  ':method :url :status :res[content-length] - :response-time ms'
);

module.exports = {
  ...logger,
  morganMiddleware,
};
