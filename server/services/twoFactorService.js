const crypto = require('crypto');
const bcrypt = require('bcrypt');
const env = require('../config/env');
const { info, error: logError, warn } = require('../utils/logger');
const cacheService = require('./cacheService');

const APP_NAME = env.appName || 'EnterpriseEvents';
const RFC4648_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// ============================================================================
// Internal Utility: Base32 Encoder & Decoder (RFC 4648)
// Built natively to avoid external dependencies (e.g. 'thirty-two', 'speakeasy')
// ============================================================================

const base32Encode = (buffer) => {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += RFC4648_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += RFC4648_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
};

const base32Decode = (input) => {
  const cleanedInput = input.toUpperCase().replace(/=+$/, '');
  const length = cleanedInput.length;
  let bits = 0;
  let value = 0;
  let index = 0;
  const output = Buffer.alloc(Math.ceil((length * 5) / 8));

  for (let i = 0; i < length; i++) {
    const char = cleanedInput[i];
    const val = RFC4648_ALPHABET.indexOf(char);
    if (val === -1) throw new Error('Invalid Base32 character');

    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  return output.slice(0, index);
};

// ============================================================================
// Internal Utility: HMAC-based One-Time Password (HOTP) Generation (RFC 4226)
// ============================================================================

const generateHOTP = (secretBuffer, counter) => {
  const counterBuffer = Buffer.alloc(8);
  // Write the counter value as an 8-byte big-endian integer
  counterBuffer.writeBigInt64BE(BigInt(counter), 0);

  const hmac = crypto.createHmac('sha1', secretBuffer);
  hmac.update(counterBuffer);
  const digest = hmac.digest();

  // Dynamic truncation (RFC 4226)
  const offset = digest[digest.length - 1] & 0xf;
  const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1000000;

  // Ensure 6-digit zero-padded string
  return code.toString().padStart(6, '0');
};

// ============================================================================
// Main Two-Factor Authentication Service
// ============================================================================

const twoFactorService = {
  /**
   * Generates a new 160-bit Base32 TOTP secret.
   * Google Authenticator optimally expects a 20-byte (160-bit) secret.
   */
  generateSecret(user) {
    const buffer = crypto.randomBytes(20);
    const secret = base32Encode(buffer);
    info(`2FA Setup Initiated for user: ${user.email}`);
    return secret;
  },

  /**
   * Generates the provisioning URI required to render a QR Code
   * format: otpauth://totp/Issuer:account?secret=SECRET&issuer=Issuer
   */
  generateQRCode(secret, email) {
    const encodedIssuer = encodeURIComponent(APP_NAME);
    const encodedAccount = encodeURIComponent(email);
    return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}`;
  },

  /**
   * Verifies a 6-digit TOTP token against the Base32 secret.
   * Features ±1 time window tolerance and Redis-based Replay Attack Prevention.
   * 
   * @param {string} token - The 6-digit OTP from the user
   * @param {string} secret - The user's Base32 secret
   * @param {string} userId - User ID (Required for Replay Protection context)
   * @returns {boolean} - true if valid, false otherwise
   */
  async verifyToken(token, secret, userId) {
    try {
      if (!token || token.length !== 6) return false;

      const secretBuffer = base32Decode(secret);
      const currentTime = Math.floor(Date.now() / 30000); // 30-second steps

      let isValid = false;
      let matchedCounter = null;

      // Check current window, previous window (-30s), and next window (+30s)
      for (let i = -1; i <= 1; i++) {
        const counter = currentTime + i;
        const generatedCode = generateHOTP(secretBuffer, counter);
        
        // Use timingSafeEqual to prevent timing attacks
        if (crypto.timingSafeEqual(Buffer.from(generatedCode), Buffer.from(token))) {
          isValid = true;
          matchedCounter = counter;
          break;
        }
      }

      if (isValid) {
        // Prevent Replay Attacks: Ensure the same OTP isn't used twice in the same window
        const replayKey = `2fa:replay:${userId}:${token}:${matchedCounter}`;
        const isReplay = await cacheService.exists(replayKey);
        
        if (isReplay) {
          warn(`2FA REPLAY ATTACK DETECTED: User [${userId}] attempted to reuse token [${token}]`);
          return false;
        }

        // Lock the token for the duration of the time window + tolerance (90s max overlap)
        await cacheService.set(replayKey, 'USED', 90);
        info(`2FA Token Verified Successfully for User [${userId}]`);
        return true;
      }

      warn(`2FA Token Verification Failed (Invalid Code) for User [${userId}]`);
      return false;
    } catch (err) {
      logError(`TOTP Verification Error: ${err.message}`);
      return false;
    }
  },

  /**
   * Generates 10 secure Backup Recovery Codes.
   * Returns both the plain codes (to show the user ONCE) and the hashed versions (to store in DB).
   */
  async generateBackupCodes() {
    const plainCodes = [];
    const hashedCodes = [];

    // Generate 10 codes
    for (let i = 0; i < 10; i++) {
      // Generate 8-character hex code (e.g. 4a9b2c8f)
      const code = crypto.randomBytes(4).toString('hex');
      plainCodes.push(code);
      
      // Hash securely using bcrypt (cost factor 10)
      const hashed = await bcrypt.hash(code, 10);
      hashedCodes.push(hashed);
    }

    info('2FA Backup Codes generated successfully');
    
    return { plainCodes, hashedCodes };
  }
};

module.exports = twoFactorService;
