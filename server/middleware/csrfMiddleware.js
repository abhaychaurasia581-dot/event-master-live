const crypto = require('crypto');
const env = require('../config/env');
const { error: logError, warn, info } = require('../utils/logger');

// Strict cookie naming convention for CSRF
const CSRF_COOKIE_NAME = '__Host-csrf_token';

/**
 * Generates a crypto-secure CSRF token, signs it, and stores it in an HttpOnly cookie.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {string} The raw token to be sent to the client (for storing in memory)
 */
const generateCsrfToken = (req, res) => {
  // Generate a random 32-byte hex token
  const token = crypto.randomBytes(32).toString('hex');
  
  // Create an HMAC signature to ensure the cookie cannot be tampered with by the client
  // We use the application's JWT secret as the signing key
  const signature = crypto
    .createHmac('sha256', env.jwtSecret || 'fallback_enterprise_secret_999')
    .update(token)
    .digest('hex');

  // Store token and signature together in the cookie
  const csrfCookieValue = `${token}.${signature}`;

  // Use __Host- prefix in production for maximum cookie security (locks to domain & secure)
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieName = isProduction ? CSRF_COOKIE_NAME : '_csrf_token';

  res.cookie(cookieName, csrfCookieValue, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/'
  });

  info(`CSRF Token Generated for IP: ${req.ip}`);
  
  // Return only the raw token. The client must send this back in the X-CSRF-Token header.
  return token;
};

/**
 * Middleware to strictly validate incoming state-changing requests against the CSRF token.
 */
const validateCsrfToken = (req, res, next) => {
  // 1. Exclude safe HTTP methods (REST architecture)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // 2. Exclude Third-Party Webhooks (Stripe/Razorpay handle their own HMAC signatures)
  if (req.originalUrl.includes('/webhook/')) {
    return next();
  }

  // (Optional) AI endpoints might be bypassed if called strictly via external integrations
  // if (req.originalUrl.includes('/api/v2/ai/')) return next();

  try {
    // 3. Extract tokens from Header and HttpOnly Cookie
    const clientToken = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];
    
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieName = isProduction ? CSRF_COOKIE_NAME : '_csrf_token';
    const cookieToken = req.cookies ? req.cookies[cookieName] : null;

    if (!clientToken || !cookieToken) {
      warn(`CSRF Validation Failed: Missing token (IP: ${req.ip} | Route: ${req.originalUrl})`);
      return res.status(403).json({
        success: false,
        message: 'Invalid CSRF token',
        error: 'CSRF_VALIDATION_FAILED'
      });
    }

    const [storedToken, storedSignature] = cookieToken.split('.');

    // 4. Validate Token Match (Double Submit Pattern)
    // Ensures the header token matches the one hidden in the secure cookie
    if (clientToken !== storedToken) {
      warn(`CSRF Validation Failed: Token mismatch (IP: ${req.ip})`);
      return res.status(403).json({
        success: false,
        message: 'Invalid CSRF token',
        error: 'CSRF_VALIDATION_FAILED'
      });
    }

    // 5. Validate Cookie Integrity (HMAC Signature Check)
    // Ensures a malicious actor didn't just fabricate a matching cookie and header
    const expectedSignature = crypto
      .createHmac('sha256', env.jwtSecret || 'fallback_enterprise_secret_999')
      .update(storedToken)
      .digest('hex');

    // Use timingSafeEqual to prevent timing attacks
    const expectedBuffer = Buffer.from(expectedSignature);
    const storedBuffer = Buffer.from(storedSignature || '');

    if (expectedBuffer.length !== storedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, storedBuffer)) {
      warn(`CSRF Validation Failed: Cookie signature tampered (IP: ${req.ip})`);
      return res.status(403).json({
        success: false,
        message: 'Invalid CSRF token',
        error: 'CSRF_VALIDATION_FAILED'
      });
    }

    // CSRF Check Passed
    next();
  } catch (err) {
    logError(`CSRF Middleware Error: ${err.message}`);
    return res.status(403).json({
      success: false,
      message: 'Invalid CSRF token',
      error: 'CSRF_VALIDATION_FAILED'
    });
  }
};

module.exports = {
  generateCsrfToken,
  validateCsrfToken
};
