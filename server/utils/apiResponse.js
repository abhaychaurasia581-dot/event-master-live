/**
 * A standard class to structure API success responses consistently.
 */
class ApiResponse {
  /**
   * @param {number} statusCode - HTTP status code (e.g., 200, 201)
   * @param {any} data - The payload/data to return to the client
   * @param {string} message - A descriptive success message
   * @param {object} meta - Optional metadata (e.g., pagination info)
   */
  constructor(statusCode, data = {}, message = "Operation completed successfully", meta = {}) {
    this.statusCode = statusCode;
    this.success = statusCode < 400; // Success is true for status codes < 400
    this.message = message;
    this.data = data;
    this.meta = meta;
  }
}

module.exports = ApiResponse;
