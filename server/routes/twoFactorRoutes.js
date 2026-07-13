const express = require('express');
const { body, header } = require('express-validator');
const rateLimiter = require('../middleware/rateLimiter');
const { protect } = require('../middleware/authMiddleware');
const { authorize: roleMiddleware } = require('../middleware/roleMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const twoFactorController = require('../controllers/twoFactorController');

const router = express.Router();

// ============================================================================
// Strict Rate Limiters for 2FA (Brute-Force Protection)
// ============================================================================

// Limits OTP guessing attacks (10 attempts per 15 minutes per IP)
const otpRateLimiter = rateLimiter({
  type: 'IP',
  windowMs: 15 * 60 * 1000, 
  max: 10, 
  prefix: 'rl:2fa:otp'
});

// Limits setup spamming (5 attempts per hour per User)
const setupRateLimiter = rateLimiter({
  type: 'USER',
  windowMs: 60 * 60 * 1000, 
  max: 5, 
  prefix: 'rl:2fa:setup'
});

// ============================================================================
// Public / Unauthenticated Routes (Login Flow Phase 2)
// ============================================================================

/**
 * 2FA Challenge Endpoint
 * Triggered when a user logs in with valid password but has 2FA enabled.
 */
router.post(
  '/login-challenge',
  otpRateLimiter,
  [
    body('email')
      .isEmail().withMessage('Valid email is required')
      .normalizeEmail(),
    body('password')
      .notEmpty().withMessage('Password is required')
  ],
  validateRequest,
  twoFactorController.login2FAChallenge
);

/**
 * 2FA Verify Login Endpoint
 * Requires the temporary 'pendingToken' in the Authorization header.
 * Accepts either a 6-digit OTP OR an 8-character Backup Code.
 */
router.post(
  '/verify-login',
  otpRateLimiter,
  [
    header('authorization')
      .notEmpty().withMessage('Pending token is required in Authorization header'),
    body('token')
      .optional()
      .isString().trim()
      .isLength({ min: 6, max: 6 }).withMessage('OTP must be exactly 6 digits')
      .isNumeric().withMessage('OTP must contain only numbers'),
    body('backupCode')
      .optional()
      .isString().trim()
      .isLength({ min: 8, max: 8 }).withMessage('Backup code must be exactly 8 characters')
      .isHexadecimal().withMessage('Invalid backup code format')
  ],
  validateRequest,
  twoFactorController.verify2FALogin
);

// ============================================================================
// Authenticated Routes (Requires Active JWT)
// ============================================================================

router.use(protect);

// Strict Role Based Access Requirement: 
// Only these roles can ENABLE 2FA for system-critical accounts.
const systemCriticalRoles = roleMiddleware('ADMIN', 'ORGANIZER');

/**
 * Setup 2FA Endpoint
 * Generates the Secret, QR Code, and Backup Codes.
 */
router.post(
  '/setup',
  systemCriticalRoles,
  setupRateLimiter,
  twoFactorController.setup2FA
);

/**
 * Verify Setup Endpoint
 * Finalizes 2FA activation by verifying the very first OTP code from the user.
 */
router.post(
  '/verify-setup',
  systemCriticalRoles,
  otpRateLimiter,
  [
    body('token')
      .isString().trim()
      .isLength({ min: 6, max: 6 }).withMessage('OTP must be exactly 6 digits')
      .isNumeric().withMessage('OTP must contain only numbers')
  ],
  validateRequest,
  twoFactorController.verify2FASetup
);

/**
 * Disable 2FA Endpoint
 * Requires password confirmation and a valid OTP to prevent unauthorized disabling.
 */
router.post(
  '/disable',
  otpRateLimiter, // Reusing OTP limiter to prevent brute-forcing the disable mechanism
  [
    body('password')
      .notEmpty().withMessage('Password is required to disable 2FA'),
    body('token')
      .isString().trim()
      .isLength({ min: 6, max: 6 }).withMessage('OTP must be exactly 6 digits')
      .isNumeric().withMessage('OTP must contain only numbers')
  ],
  validateRequest,
  twoFactorController.disable2FA
);

module.exports = router;
