const express = require('express');
const { body, param, query } = require('express-validator');
const rateLimit = require('express-rate-limit');

const wishlistController = require('../controllers/wishlistController');
const { protect } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');

const router = express.Router();

// ============================================================================
// Global Wishlist Rate Limiting Middleware
// Prevents Database/Cache spamming from malicious bots
// ============================================================================
const wishlistLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many wishlist requests from this IP, please try again after 5 minutes',
    errors: []
  },
  standardHeaders: true,
  legacyHeaders: false
});

router.use(wishlistLimiter);

// ============================================================================
// Authenticated Routes (All routes below require JWT)
// ============================================================================
// Users can only interact with their own wishlists securely via the JWT payload.
router.use(protect);

/**
 * Add an event to the wishlist
 */
router.post(
  '/',
  [
    body('eventId')
      .isUUID()
      .withMessage('A valid Event ID (UUID) is required')
  ],
  validateRequest,
  wishlistController.addToWishlist
);

/**
 * Remove a specific event from the wishlist
 */
router.delete(
  '/:eventId',
  [
    param('eventId')
      .isUUID()
      .withMessage('A valid Event ID (UUID) is required')
  ],
  validateRequest,
  wishlistController.removeFromWishlist
);

/**
 * Get paginated wishlist items
 */
router.get(
  '/',
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('sort')
      .optional()
      .isString()
      .trim()
      .isIn(['desc', 'asc', 'popular'])
      .withMessage('Sort must be desc, asc, or popular')
      .escape() // Sanitize input
  ],
  validateRequest,
  wishlistController.getWishlist
);

/**
 * Check if a specific event is in the user's wishlist
 */
router.get(
  '/check/:eventId',
  [
    param('eventId')
      .isUUID()
      .withMessage('A valid Event ID (UUID) is required')
  ],
  validateRequest,
  wishlistController.checkWishlistStatus
);

/**
 * Clear the entire wishlist for the authenticated user
 */
router.delete(
  '/',
  wishlistController.clearWishlist
);

module.exports = router;
