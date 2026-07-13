/**
 * Async Handler to wrap async route controllers and eliminate the need for try-catch blocks
 * @param {Function} requestHandler - The async route controller function
 * @returns {Function} Express middleware function
 */
const asyncHandler = (requestHandler) => {
  return (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
  };
};

module.exports = asyncHandler;
