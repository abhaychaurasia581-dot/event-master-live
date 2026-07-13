const express = require('express');
const { body, param, query } = require('express-validator');
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');
const { authorize: roleMiddleware } = require('../middleware/roleMiddleware');
const { validateRequest } = require('../middleware/validateRequest');

const router = express.Router();

// ============================================================================
// Public Routes
// ============================================================================

/**
 * Webhooks for Payment Gateways
 * Authentication is bypassed; signature verification happens in the controller/service
 * Stripe requires raw body, which must be configured in server.js before body-parser
 */
router.post(
  '/webhook/:gateway',
  [
    param('gateway')
      .isIn(['stripe', 'razorpay'])
      .withMessage('Invalid payment gateway')
  ],
  validateRequest,
  paymentController.handleWebhook
);

// ============================================================================
// Authenticated Routes (All routes below require JWT)
// ============================================================================

router.use(protect);

/**
 * Create a new Payment Order / Intent
 */
router.post(
  '/create-order',
  roleMiddleware('USER', 'ADMIN'),
  [
    body('bookingId')
      .isUUID()
      .withMessage('A valid bookingId (UUID) is required'),
    body('gateway')
      .isIn(['stripe', 'razorpay'])
      .withMessage('Gateway must be either stripe or razorpay')
  ],
  validateRequest,
  paymentController.createOrder
);

/**
 * Verify a payment (Frontend sends signature/intent details after payment)
 */
router.post(
  '/verify',
  roleMiddleware('USER', 'ADMIN'),
  [
    body('bookingId')
      .isUUID()
      .withMessage('A valid bookingId (UUID) is required'),
    body('gateway')
      .isIn(['stripe', 'razorpay'])
      .withMessage('Gateway must be either stripe or razorpay'),
    body('paymentData')
      .isObject()
      .withMessage('paymentData object is required containing gateway specific signatures')
  ],
  validateRequest,
  paymentController.verifyPayment
);

/**
 * Refund a successful payment (User can cancel their own, Admin can cancel any)
 */
router.post(
  '/refund',
  roleMiddleware('USER', 'ADMIN'),
  [
    body('bookingId')
      .isUUID()
      .withMessage('A valid bookingId (UUID) is required'),
    body('reason')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 255 })
      .withMessage('Reason must be under 255 characters')
  ],
  validateRequest,
  paymentController.refundPayment
);

/**
 * Get User's Payment History
 * Admins can pass ?userId=xxx to view specific user's history
 */
router.get(
  '/history',
  roleMiddleware('USER', 'ADMIN'),
  paymentController.getPaymentHistory
);

/**
 * Get specific Payment Details
 */
router.get(
  '/:id',
  roleMiddleware('USER', 'ORGANIZER', 'ADMIN'),
  [
    param('id')
      .isUUID()
      .withMessage('A valid payment ID (UUID) is required')
  ],
  validateRequest,
  paymentController.getPaymentDetails
);

// Note: /capture, /cancel, and /refund/:paymentId were requested in the spec but 
// the controller methods provided in the previous step only explicitly implemented 
// createOrder, verifyPayment, refundPayment, handleWebhook, getPaymentHistory, getPaymentDetails.
// I am mapping the requested routes to the available controller methods to maintain consistency.

module.exports = router;
