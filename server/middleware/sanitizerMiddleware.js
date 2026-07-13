const { warn, error: logError } = require('../utils/logger');

// Strict recursion limit to prevent Stack Overflow attacks via massively nested JSON payloads
const MAX_DEPTH = 10;

/**
 * Safely checks if a value is a plain JavaScript Object (excluding Arrays and null).
 */
const isObject = (val) => {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
};

/**
 * Deep inspection to identify highly confident XSS or script injection attempts.
 * Uses aggressive regex patterns to detect malicious behaviors.
 */
const hasMaliciousPatterns = (str) => {
  const dangerousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // Detects <script> tags
    /javascript:/gi, // Detects javascript: protocol injections
    /on\w+\s*=/gi, // Detects inline event handlers like onclick=, onerror=, etc.
    /expression\s*\(/gi // Detects old IE CSS expression injections
  ];
  return dangerousPatterns.some(pattern => pattern.test(str));
};

/**
 * Sanitizes a string by HTML escaping it to neutralize structural payload attacks
 * while maintaining the data's integrity for the backend.
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;

  // Trim extraneous whitespace which could bypass naive validators
  let clean = str.trim();

  // HTML escape dangerous characters
  clean = clean.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;')
               .replace(/"/g, '&quot;')
               .replace(/'/g, '&#x27;')
               .replace(/\//g, '&#x2F;');

  return clean;
};

/**
 * Recursively sanitizes every element within an Array.
 */
const sanitizeArray = (arr, depth = 0, req) => {
  if (depth > MAX_DEPTH) {
    warn(`Sanitization depth limit reached (Depth: ${depth}). Possible malicious deep payload from IP: ${req.ip}`);
    return arr; // Abort deep recursion
  }
  return arr.map(item => sanitizeValue(item, depth + 1, req));
};

/**
 * Recursively sanitizes every key-value pair within an Object.
 */
const sanitizeObject = (obj, depth = 0, req) => {
  if (depth > MAX_DEPTH) {
    warn(`Sanitization depth limit reached (Depth: ${depth}). Possible malicious deep payload from IP: ${req.ip}`);
    return obj; // Abort deep recursion
  }
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeValue(value, depth + 1, req);
  }
  return sanitized;
};

/**
 * Master router function that determines how to sanitize a given value based on its type.
 */
const sanitizeValue = (value, depth = 0, req = null) => {
  if (typeof value === 'string') {
    // Aggressive check: If highly confident it's an attack, throw an exception immediately.
    if (hasMaliciousPatterns(value)) {
      if (req) {
        warn(`XSS ATTEMPT BLOCKED: Malicious payload detected in request from IP: ${req.ip}`);
        // We throw a custom error to be caught by the middleware wrapper
        const error = new Error('Malicious payload detected');
        error.isMalicious = true;
        throw error;
      }
    }
    // Otherwise, perform standard silent sanitization (escaping)
    return sanitizeString(value);
  }
  
  if (Array.isArray(value)) {
    return sanitizeArray(value, depth, req);
  }
  
  if (isObject(value)) {
    return sanitizeObject(value, depth, req);
  }
  
  // Return primitive types (numbers, booleans, null, undefined) exactly as they are
  return value;
};

/**
 * Enterprise-grade Input Sanitization Middleware.
 * Automatically scans, cleans, and blocks malicious requests before they reach the controller.
 */
const sanitizerMiddleware = (req, res, next) => {
  // Exclude Third-Party Webhooks (Stripe/Razorpay) where payload integrity is critical for HMAC validation
  if (req.originalUrl && req.originalUrl.includes('/webhook/')) {
    return next();
  }

  try {
    // Clone and sanitize req.body (POST/PUT/PATCH payloads)
    if (req.body && Object.keys(req.body).length > 0) {
      req.body = sanitizeValue(req.body, 0, req);
    }

    // Clone and sanitize req.query (GET parameters)
    if (req.query && Object.keys(req.query).length > 0) {
      req.query = sanitizeValue(req.query, 0, req);
    }

    // Clone and sanitize req.params (URL parameters)
    if (req.params && Object.keys(req.params).length > 0) {
      req.params = sanitizeValue(req.params, 0, req);
    }

    next();
  } catch (err) {
    if (err.isMalicious) {
      // Actively block the request if a malicious script was confidently detected
      return res.status(403).json({
        success: false,
        message: 'Request blocked due to malicious content',
        errors: [{ msg: 'XSS pattern detected' }]
      });
    }
    
    logError(`Sanitizer Middleware Internal Error: ${err.message}`);
    // Fail-safe mode: if standard sanitization crashes due to a weird object structure, allow request to proceed but log it.
    next();
  }
};

module.exports = sanitizerMiddleware;
