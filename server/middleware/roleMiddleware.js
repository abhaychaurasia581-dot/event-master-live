const ApiError = require('../utils/apiError');

/**
 * Role-Based Access Control (RBAC) Middleware.
 * This middleware should be applied AFTER the JWT authentication middleware (`protect`).
 * 
 * @param  {...string} roles - The roles allowed to access the route (e.g., 'ADMIN', 'ORGANIZER')
 * @returns {Function} Express middleware function
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    // Ensure the request has an authenticated user attached by the authMiddleware
    if (!req.user) {
      return next(new ApiError(401, 'Not authenticated. Please log in to access this resource.'));
    }

    // Verify if the user's role exists in the list of allowed roles
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, `Access denied. Users with role '${req.user.role}' do not have permission to perform this action.`));
    }

    // User is authorized, proceed to the next middleware or controller
    next();
  };
};

module.exports = { authorize };
