const ApiError = require('../utils/apiError');
const { error: logError } = require('../utils/logger');

// These services will be generated in the subsequent steps
const stripeService = require('./stripeService');
const razorpayService = require('./razorpayService');

/**
 * Strategy Pattern Implementation for Payment Gateways.
 * Acts as a unified interface so controllers never directly interact with specific gateways.
 * Easily extensible for future gateways (PayPal, PayU, etc.)
 */
class PaymentFactory {
  
  /**
   * Resolves the appropriate payment service based on the gateway name
   * @param {string} gateway - e.g., 'stripe', 'razorpay'
   */
  static getService(gateway) {
    if (!gateway) {
      throw new ApiError(400, 'Payment gateway is required');
    }

    switch (gateway.toLowerCase()) {
      case 'stripe':
        return stripeService;
      case 'razorpay':
        return razorpayService;
      default:
        throw new ApiError(400, `Payment gateway '${gateway}' is not supported.`);
    }
  }

  /**
   * Creates a payment order/intent
   * @param {string} gateway - 'stripe' or 'razorpay'
   * @param {number} amount - Amount in smallest currency unit (e.g., cents or paise)
   * @param {string} currency - e.g., 'USD', 'INR'
   * @param {string} receiptId - Unique idempotency key or booking reference
   * @param {Object} metadata - Additional data to attach to the order
   */
  static async createOrder(gateway, amount, currency, receiptId, metadata = {}) {
    try {
      const service = this.getService(gateway);
      return await service.createOrder(amount, currency, receiptId, metadata);
    } catch (err) {
      logError(`PaymentFactory.createOrder Error [${gateway}]: ${err.message}`);
      throw err; // Maintain original error structure for the controller to handle
    }
  }

  /**
   * Verifies the payment signature/status directly with the gateway
   * @param {string} gateway - 'stripe' or 'razorpay'
   * @param {Object} paymentData - Gateway specific payload (e.g., signatures, payment IDs)
   */
  static async verifyPayment(gateway, paymentData) {
    try {
      const service = this.getService(gateway);
      return await service.verifyPayment(paymentData);
    } catch (err) {
      logError(`PaymentFactory.verifyPayment Error [${gateway}]: ${err.message}`);
      throw err;
    }
  }

  /**
   * Process a full or partial refund
   * @param {string} gateway - 'stripe' or 'razorpay'
   * @param {string} paymentId - The ID of the successful payment to refund
   * @param {number} amount - Amount to refund (null for full refund)
   * @param {Object} metadata - Additional refund reason or notes
   */
  static async refundPayment(gateway, paymentId, amount = null, metadata = {}) {
    try {
      const service = this.getService(gateway);
      return await service.refundPayment(paymentId, amount, metadata);
    } catch (err) {
      logError(`PaymentFactory.refundPayment Error [${gateway}]: ${err.message}`);
      throw err;
    }
  }

  /**
   * Securely process and validate incoming webhook events
   * @param {string} gateway - 'stripe' or 'razorpay'
   * @param {Object|string} payload - Raw request body
   * @param {string} signature - Webhook signature header
   */
  static async handleWebhook(gateway, payload, signature) {
    try {
      const service = this.getService(gateway);
      return await service.handleWebhook(payload, signature);
    } catch (err) {
      logError(`PaymentFactory.handleWebhook Error [${gateway}]: ${err.message}`);
      throw err;
    }
  }
}

module.exports = PaymentFactory;
