const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const env = require('../config/env');
const { pool } = require('../config/db');

/**
 * Middleware to protect routes and verify JWT tokens
 */
const protect = asyncHandler(async (req, res, next) => {
  let token;

  // 1. Check if token exists in headers or cookies
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  // 2. If no token is found, return 401 Unauthorized
  if (!token) {
    throw new ApiError(401, 'Not authorized. Please log in to access this resource.');
  }

  try {
    // 3. Verify the token signature and expiration
    const decoded = jwt.verify(token, env.jwtSecret);

    // 4. Fetch the user from the database using raw SQL
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, is_deleted FROM users WHERE id = ? LIMIT 1',
      [decoded.id]
    );

    const user = rows[0];

    // 5. Check if user still exists
    if (!user) {
      throw new ApiError(401, 'The user belonging to this token no longer exists.');
    }

    // 6. Check if user is soft-deleted
    if (user.is_deleted) {
      throw new ApiError(403, 'Your account has been deactivated or deleted. Please contact support.');
    }

    // 7. Attach user object to the request object for use in subsequent middleware/controllers
    req.user = user;
    
    // Proceed to the next middleware or controller
    next();
  } catch (error) {
    // Handle specific JWT errors
    if (error.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Your session has expired. Please log in again.');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new ApiError(401, 'Invalid token. Please log in again.');
    }
    
    // For all other errors (like DB errors or thrown ApiErrors), pass them to the error handler
    throw error;
  }
});

module.exports = { protect };
