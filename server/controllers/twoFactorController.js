const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const twoFactorService = require('../services/twoFactorService');
const userModel = require('../models/userModel');
const cacheService = require('../services/cacheService');
const { pool } = require('../config/db');
const { info, error: logError, warn } = require('../utils/logger');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const env = require('../config/env');

// ============================================================================
// Internal Encryption Utility for 2FA Secrets
// Secrets must be decrypted during verification, so hashing (bcrypt) is invalid here.
// AES-256-GCM is used for authenticated encryption.
// ============================================================================
const ALGORITHM = 'aes-256-gcm';
const getEncryptionKey = () => Buffer.from(env.jwtSecret.padEnd(32, '0').slice(0, 32));

const encryptSecret = (text) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

const decryptSecret = (encryptedData) => {
  const [ivHex, authTagHex, encryptedText] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

// ============================================================================
// Internal DB Helper for 2FA fields (Bypassing userModel to avoid file changes)
// ============================================================================
const updateUser2FAStatus = async (userId, isEnabled, encryptedSecret = null, hashedBackupCodes = null) => {
  const query = `
    UPDATE users 
    SET is_2fa_enabled = ?, two_fa_secret = ?, backup_codes = ? 
    WHERE id = ?
  `;
  const backupCodesJson = hashedBackupCodes ? JSON.stringify(hashedBackupCodes) : null;
  await pool.execute(query, [isEnabled, encryptedSecret, backupCodesJson, userId]);
};

const getUser2FADetails = async (userId) => {
  const [rows] = await pool.execute(
    'SELECT is_2fa_enabled, two_fa_secret, backup_codes FROM users WHERE id = ?',
    [userId]
  );
  return rows[0] || null;
};

// ============================================================================
// Controller Methods
// ============================================================================

/**
 * @desc    Initiate 2FA Setup
 * @route   POST /api/v2/2fa/setup
 * @access  Private
 */
const setup2FA = async (req, res, next) => {
  try {
    const user = await userModel.findUserById(req.user.id);
    if (!user) throw new ApiError(404, 'User not found');

    const dbDetails = await getUser2FADetails(user.id);
    if (dbDetails && dbDetails.is_2fa_enabled) {
      throw new ApiError(400, '2FA is already enabled on this account');
    }

    // 1. Generate Base32 Secret & QR URI
    const secret = twoFactorService.generateSecret(user);
    const qrUri = twoFactorService.generateQRCode(secret, user.email);

    // 2. Generate Backup Codes
    const { plainCodes, hashedCodes } = await twoFactorService.generateBackupCodes();

    // 3. Temporarily cache the setup context (expires in 15 mins)
    // We do NOT save to the DB until the user verifies the first OTP
    const setupContext = {
      secret: encryptSecret(secret),
      hashedCodes
    };
    await cacheService.set(`2fa:setup:${user.id}`, JSON.stringify(setupContext), 15 * 60);

    info(`2FA setup payload generated for user ${user.id}`);

    // Return the secret and plain backup codes ONCE
    return res.status(200).json(new ApiResponse(200, {
      qrUri,
      manualSecret: secret,
      backupCodes: plainCodes // WARNING: Will only be shown this one time
    }, '2FA setup initiated. Please verify with an OTP to activate.'));

  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Verify and Activate 2FA
 * @route   POST /api/v2/2fa/verify-setup
 * @access  Private
 */
const verify2FASetup = async (req, res, next) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;

    if (!token) throw new ApiError(400, 'OTP Token is required');

    // 1. Retrieve setup context from cache
    const cacheData = await cacheService.get(`2fa:setup:${userId}`);
    if (!cacheData) {
      throw new ApiError(400, '2FA setup session expired. Please restart the setup process.');
    }

    const { secret: encryptedSecret, hashedCodes } = JSON.parse(cacheData);
    const plainSecret = decryptSecret(encryptedSecret);

    // 2. Verify the OTP
    const isValid = await twoFactorService.verifyToken(token, plainSecret, userId);
    if (!isValid) {
      throw new ApiError(401, 'Invalid or expired OTP token', 'TOTP_VALIDATION_FAILED');
    }

    // 3. Activate 2FA in Database
    await updateUser2FAStatus(userId, true, encryptedSecret, hashedCodes);

    // 4. Clean up cache
    await cacheService.del(`2fa:setup:${userId}`);

    info(`2FA successfully enabled for user ${userId}`);

    return res.status(200).json(new ApiResponse(200, null, 'Two-Factor Authentication activated successfully'));
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Challenge Login Phase (Called after standard password check)
 * @route   POST /api/v2/2fa/challenge
 * @access  Public (Requires temporary credentials usually)
 */
const login2FAChallenge = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Simulate initial login validation
    const user = await userModel.findUserByEmail(email, true);
    if (!user) throw new ApiError(401, 'Invalid credentials');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new ApiError(401, 'Invalid credentials');

    // Check if 2FA is actually enabled
    const dbDetails = await getUser2FADetails(user.id);
    if (!dbDetails || !dbDetails.is_2fa_enabled) {
      // If no 2FA, ideally fallback to normal login, but this endpoint specifically assumes 2FA
      throw new ApiError(400, '2FA is not enabled for this account');
    }

    // Issue a short-lived pending token (5 minutes)
    const pendingToken = jwt.sign(
      { id: user.id, is2FAPending: true },
      env.jwtSecret,
      { expiresIn: '5m' }
    );

    info(`2FA Challenge issued for user ${user.email}`);

    return res.status(200).json(new ApiResponse(200, {
      requires2FA: true,
      pendingToken
    }, 'Please provide your 2FA token to complete login.'));

  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Verify OTP to complete Login
 * @route   POST /api/v2/2fa/verify-login
 * @access  Public (Requires pending token in header)
 */
const verify2FALogin = async (req, res, next) => {
  try {
    const { token, backupCode } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Pending 2FA token required');
    }

    const pendingToken = authHeader.split(' ')[1];
    
    // Verify pending token
    const decoded = jwt.verify(pendingToken, env.jwtSecret);
    if (!decoded.is2FAPending) {
      throw new ApiError(401, 'Invalid pending token');
    }

    const userId = decoded.id;
    const dbDetails = await getUser2FADetails(userId);

    if (!dbDetails || !dbDetails.is_2fa_enabled) {
      throw new ApiError(400, '2FA is not enabled on this account');
    }

    let isAuthenticated = false;

    // A. Backup Code Flow
    if (backupCode) {
      const storedCodes = JSON.parse(dbDetails.backup_codes || '[]');
      let matchedIndex = -1;

      for (let i = 0; i < storedCodes.length; i++) {
        const isMatch = await bcrypt.compare(backupCode, storedCodes[i]);
        if (isMatch) {
          matchedIndex = i;
          isAuthenticated = true;
          break;
        }
      }

      if (isAuthenticated) {
        // Remove the used backup code (one-time use only)
        storedCodes.splice(matchedIndex, 1);
        await updateUser2FAStatus(userId, true, dbDetails.two_fa_secret, storedCodes);
        warn(`User [${userId}] consumed a 2FA backup code.`);
      }
    } 
    // B. Authenticator App TOTP Flow
    else if (token) {
      const plainSecret = decryptSecret(dbDetails.two_fa_secret);
      isAuthenticated = await twoFactorService.verifyToken(token, plainSecret, userId);
    } 
    else {
      throw new ApiError(400, 'Either OTP token or Backup Code is required');
    }

    if (!isAuthenticated) {
      warn(`Failed 2FA login attempt for user ${userId}`);
      throw new ApiError(401, 'Invalid OTP or Backup Code', 'TOTP_VALIDATION_FAILED');
    }

    // Issuing final legitimate JWT (e.g., 24h)
    const finalToken = jwt.sign(
      { id: userId, role: decoded.role }, // Note: Role should ideally be fetched from DB if needed
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn || '24h' }
    );

    info(`User ${userId} successfully logged in via 2FA`);

    return res.status(200).json(new ApiResponse(200, {
      token: finalToken
    }, 'Login successful'));

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'Login session expired. Please log in again.'));
    }
    next(err);
  }
};

/**
 * @desc    Disable 2FA Security
 * @route   POST /api/v2/2fa/disable
 * @access  Private
 */
const disable2FA = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { password, token } = req.body;

    if (!password || !token) {
      throw new ApiError(400, 'Password and current OTP token are required to disable 2FA');
    }

    // 1. Verify Password First
    const user = await userModel.findUserById(userId);
    const userWithPwd = await userModel.findUserByEmail(user.email, true);
    
    const isMatch = await bcrypt.compare(password, userWithPwd.password);
    if (!isMatch) throw new ApiError(401, 'Incorrect password');

    // 2. Verify OTP
    const dbDetails = await getUser2FADetails(userId);
    if (!dbDetails || !dbDetails.is_2fa_enabled) {
      throw new ApiError(400, '2FA is not enabled on this account');
    }

    const plainSecret = decryptSecret(dbDetails.two_fa_secret);
    const isValid = await twoFactorService.verifyToken(token, plainSecret, userId);
    
    if (!isValid) {
      throw new ApiError(401, 'Invalid OTP token', 'TOTP_VALIDATION_FAILED');
    }

    // 3. Purge 2FA Data securely
    await updateUser2FAStatus(userId, false, null, null);

    warn(`2FA protection has been completely disabled for user ${userId}`);

    return res.status(200).json(new ApiResponse(200, null, 'Two-Factor Authentication has been successfully disabled'));
  } catch (err) {
    next(err);
  }
};

module.exports = {
  setup2FA,
  verify2FASetup,
  login2FAChallenge,
  verify2FALogin,
  disable2FA
};
