/**
 * A standard Error class for API error responses.
 * Inherits from the native Error class.
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code (e.g., 400, 404, 500)
   * @param {string} [message="Something went wrong"] - Error message
   * @param {Array} [errors=[]] - Array of validation errors or multiple error details
   * @param {string} [stack=""] - Error stack trace (optional)
   */
  constructor(
    statusCode,
    message = "Something went wrong",
    errors = [],
    stack = ""
  ) {
    super(message);
    this.statusCode = statusCode;
    this.message = message;
    this.errors = errors;
    this.success = false;
    this.isOperational = true; // Identifies if the error is a known/operational error

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

module.exports = ApiError;
