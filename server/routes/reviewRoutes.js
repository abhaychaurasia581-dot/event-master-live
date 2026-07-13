const express = require('express');
const { body, param, query } = require('express-validator');
const rateLimit = require('express-rate-limit');

const reviewController = require('../controllers/reviewController');
const { protect } = require('../middleware/authMiddleware');
const { authorize: roleMiddleware } = require('../middleware/roleMiddleware');
const { validateRequest } = require('../middleware/validateRequest');

const router = express.Router();

// ============================================================================
// Global Review Rate Limiting Middleware
// Prevents review spamming and brute-force attacks
// ============================================================================
const reviewLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // Limit each IP to 50 review-related requests per windowMs
  message: {
    success: false,
    message: 'Too many review requests from this IP, please try again after 5 minutes',
    errors: []
  },
  standardHeaders: true,
  legacyHeaders: false
});

router.use(reviewLimiter);

// ============================================================================
// Public Routes
// ============================================================================

/**
 * Get top rated events globally (Trending/Popularity Engine)
 */
router.get(
  '/top-rated',
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50')
  ],
  validateRequest,
  reviewController.getTopRatedEvents
);

/**
 * Get all paginated reviews for a specific event
 */
router.get(
  '/event/:eventId',
  [
    param('eventId')
      .isUUID()
      .withMessage('A valid Event ID (UUID) is required'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
    query('sort')
      .optional()
      .isIn(['latest', 'top-rated'])
      .withMessage('Sort must be latest or top-rated')
  ],
  validateRequest,
  reviewController.getEventReviews
);

// ============================================================================
// Authenticated Routes (All routes below require JWT)
// ============================================================================

router.use(protect);

/**
 * Get all reviews written by the authenticated user
 */
router.get(
  '/user',
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50')
  ],
  validateRequest,
  reviewController.getUserReviews
);

/**
 * Submit a new review for an event
 */
router.post(
  '/',
  [
    body('eventId')
      .isUUID()
      .withMessage('A valid Event ID (UUID) is required'),
    body('rating')
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be an integer between 1 and 5'),
    body('review')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Review text cannot exceed 1000 characters')
      .escape() // Sanitize input against XSS
  ],
  validateRequest,
  reviewController.createReview
);

/**
 * Update an existing review (Owner only)
 */
router.put(
  '/:reviewId',
  [
    param('reviewId')
      .isUUID()
      .withMessage('A valid Review ID (UUID) is required'),
    body('rating')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be an integer between 1 and 5'),
    body('review')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Review text cannot exceed 1000 characters')
      .escape()
  ],
  validateRequest,
  reviewController.updateReview
);

/**
 * Delete a review (Owner or Admin)
 * roleMiddleware allows the endpoint to be hit by these roles.
 * Actual Ownership verification is strictly handled inside the Controller.
 */
router.delete(
  '/:reviewId',
  roleMiddleware('USER', 'ORGANIZER', 'ADMIN'),
  [
    param('reviewId')
      .isUUID()
      .withMessage('A valid Review ID (UUID) is required')
  ],
  validateRequest,
  reviewController.deleteReview
);

module.exports = router;
