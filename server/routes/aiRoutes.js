const express = require('express');
const { body, param, query } = require('express-validator');
const rateLimit = require('express-rate-limit');

const aiController = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');
const { authorize: roleMiddleware } = require('../middleware/roleMiddleware');
const { validateRequest } = require('../middleware/validateRequest');

const router = express.Router();

// ============================================================================
// Global AI Rate Limiting Middleware
// Prevents token exhaustion and abusive looping on expensive AI endpoints
// ============================================================================
const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 AI requests per 15 minutes
  message: {
    success: false,
    message: 'Too many AI requests from this IP, please try again after 15 minutes',
    errors: []
  },
  standardHeaders: true,
  legacyHeaders: false
});

router.use(aiRateLimiter);

// ============================================================================
// Public Routes
// ============================================================================

/**
 * AI Provider Health Check
 */
router.get('/health', aiController.healthCheck);

/**
 * Trending Events
 */
router.get('/trending', aiController.getTrendingEvents);

// ============================================================================
// Authenticated Routes (All routes below require JWT)
// ============================================================================

router.use(protect);

/**
 * Get Personalized Recommendations
 */
router.get(
  '/recommendations',
  roleMiddleware('USER', 'ORGANIZER', 'ADMIN'),
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
  aiController.getRecommendations
);

/**
 * Smart Search (Natural Language to Structured Filters)
 */
router.post(
  '/search',
  roleMiddleware('USER', 'ORGANIZER', 'ADMIN'),
  [
    body('query')
      .isString()
      .withMessage('Search query must be a string')
      .trim()
      .notEmpty()
      .withMessage('Search query is required')
      .isLength({ max: 500 })
      .withMessage('Search query is too long (maximum 500 characters)')
      .escape(), // Basic sanitization to prevent simple injection
    body('maxResults')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('maxResults must be between 1 and 100'),
    body('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer')
  ],
  validateRequest,
  aiController.smartSearch
);

/**
 * Get Similar Events (AI Semantic Ranking)
 */
router.get(
  '/similar/:eventId',
  roleMiddleware('USER', 'ORGANIZER', 'ADMIN'),
  [
    param('eventId')
      .isUUID()
      .withMessage('A valid Event ID (UUID) is required')
  ],
  validateRequest,
  aiController.getSimilarEvents
);

/**
 * Generate AI Summary for an Event
 */
router.post(
  '/summarize/:eventId',
  roleMiddleware('USER', 'ORGANIZER', 'ADMIN'),
  [
    param('eventId')
      .isUUID()
      .withMessage('A valid Event ID (UUID) is required')
  ],
  validateRequest,
  (req, res, next) => {
    // The controller was implemented to read eventId from req.body. 
    // We map the route param to the body here to maintain compatibility without modifying the controller.
    req.body.eventId = req.params.eventId;
    next();
  },
  aiController.generateSummary
);

module.exports = router;
