const { validationResult } = require('express-validator');
const ApiError = require('../utils/apiError');

/**
 * Middleware to process express-validator results.
 * If validation errors exist, it throws an ApiError with a 422 status code
 * and a formatted array of errors. Otherwise, it proceeds to the next middleware.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    // Format the errors to match the consistent API response structure
    const formattedErrors = errors.array().map(err => ({
      field: err.path || err.param, // express-validator v7 uses path, older versions use param
      message: err.msg
    }));

    // Return a 422 Unprocessable Entity error via the centralized error handler
    return next(new ApiError(422, 'Validation failed', formattedErrors));
  }

  next();
};

module.exports = { validateRequest };
