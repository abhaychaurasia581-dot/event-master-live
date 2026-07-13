const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const env = require('../config/env');
const ApiError = require('../utils/apiError');
const { error: logError, info } = require('../utils/logger');

/**
 * Creates a securely signed JWT payload to prevent QR code tampering
 */
const createSecurePayload = (data, expiresIn) => {
  try {
    return jwt.sign(data, env.jwtSecret, { expiresIn });
  } catch (err) {
    logError(`Failed to sign QR payload: ${err.message}`);
    throw new ApiError(500, 'Failed to secure QR code payload');
  }
};

/**
 * Generates a standard QR Code from any string data
 * @param {string} data - Data to encode
 * @param {string} format - 'dataURL' | 'buffer'
 */
const generateQRCode = async (data, format = 'dataURL') => {
  try {
    const options = {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    };

    if (format === 'buffer') {
      return await QRCode.toBuffer(data, options);
    }
    return await QRCode.toDataURL(data, options);
  } catch (err) {
    logError(`QR Code generation failed: ${err.message}`);
    throw new ApiError(500, 'Failed to generate QR Code image');
  }
};

/**
 * Generates a secure, long-lived QR Code for a digital ticket
 * @param {Object} booking - The booking details
 * @param {string} format - 'dataURL' | 'buffer'
 */
const generateTicketQRCode = async (booking, format = 'dataURL') => {
  const payloadData = {
    bookingId: booking.id,
    ticketNumber: booking.ticket_number,
    eventId: booking.event_id,
    userId: booking.user_id,
    type: 'TICKET'
  };

  // Ticket QR is valid for a long time (e.g., 1 year or until event is over)
  const securePayload = createSecurePayload(payloadData, '365d');
  return generateQRCode(securePayload, format);
};

/**
 * Generates a highly secure, short-lived QR Code strictly for live Check-in
 * @param {Object} booking - The booking details
 * @param {string} format - 'dataURL' | 'buffer'
 */
const generateCheckInQRCode = async (booking, format = 'dataURL') => {
  const payloadData = {
    bookingId: booking.id,
    ticketNumber: booking.ticket_number,
    eventId: booking.event_id,
    userId: booking.user_id,
    type: 'CHECK_IN'
  };

  // Check-in QR is only valid for 24 hours to prevent screenshot sharing abuses
  const securePayload = createSecurePayload(payloadData, '24h');
  return generateQRCode(securePayload, format);
};

/**
 * Verifies a scanned QR Code payload (JWT signature & expiration)
 * @param {string} payload - The scanned JWT string
 */
const verifyQRCode = (payload) => {
  try {
    const decoded = jwt.verify(payload, env.jwtSecret);
    return {
      isValid: true,
      data: decoded
    };
  } catch (err) {
    let message = 'Invalid QR Code signature';
    if (err.name === 'TokenExpiredError') {
      message = 'QR Code has expired';
    }
    logError(`QR Verification Failed: ${message}`);
    
    return {
      isValid: false,
      error: message
    };
  }
};

/**
 * Decodes the payload without signature verification (Use with caution)
 * @param {string} payload - The scanned JWT string
 */
const decodeQRCode = (payload) => {
  const decoded = jwt.decode(payload);
  if (!decoded) {
    throw new ApiError(400, 'Malformed QR Code payload');
  }
  return decoded;
};

/**
 * Helper to generate and immediately save a QR Code to the local filesystem
 * @param {string} data - Data to encode
 * @param {string} filePath - Absolute path to save the PNG file
 */
const saveQRCodeToFile = async (data, filePath) => {
  try {
    const buffer = await generateQRCode(data, 'buffer');
    await fs.writeFile(filePath, buffer);
    info(`QR Code saved to file: ${filePath}`);
    return true;
  } catch (err) {
    logError(`Failed to save QR code to file: ${err.message}`);
    throw new ApiError(500, 'Failed to save QR Code file');
  }
};

module.exports = {
  generateQRCode,
  generateTicketQRCode,
  generateCheckInQRCode,
  verifyQRCode,
  decodeQRCode,
  saveQRCodeToFile
};
