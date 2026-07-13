const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');

const router = express.Router();

// ---------------------------------------------------------
// Validation Rules
// ---------------------------------------------------------

const registerValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Valid email address is required')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Valid phone number is required')
];

const loginValidation = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Valid email address is required')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number')
];

const updateProfileValidation = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Valid phone number is required')
];

const forgotPasswordValidation = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Valid email address is required')
    .normalizeEmail()
];

const resetPasswordValidation = [
  body('resetToken')
    .notEmpty()
    .withMessage('Reset token is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number')
];

// ---------------------------------------------------------
// Public Routes
// ---------------------------------------------------------

router.post(
  '/register',
  registerValidation,
  validateRequest,
  authController.register
);

router.post(
  '/login',
  loginValidation,
  validateRequest,
  authController.login
);

router.post(
  '/refresh-token',
  authController.refreshAccessToken
);

router.post(
  '/forgot-password',
  forgotPasswordValidation,
  validateRequest,
  authController.forgotPassword
);

router.post(
  '/reset-password',
  resetPasswordValidation,
  validateRequest,
  authController.resetPassword
);

// ---------------------------------------------------------
// Protected Routes
// ---------------------------------------------------------

router.post(
  '/logout',
  protect,
  authController.logout
);

router.route('/profile')
  .get(
    protect,
    authController.getProfile
  )
  .put(
    protect,
    updateProfileValidation,
    validateRequest,
    authController.updateProfile
  );

router.put(
  '/change-password',
  protect,
  changePasswordValidation,
  validateRequest,
  authController.changePassword
);

router.delete(
  '/delete-account',
  protect,
  authController.deleteAccount
);

router.get(
  '/users',
  protect,
  authController.getAllUsers
);

module.exports = router;
