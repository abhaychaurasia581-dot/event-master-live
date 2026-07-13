const Stripe = require('stripe');
const env = require('../config/env');
const ApiError = require('../utils/apiError');
const { info, error: logError } = require('../utils/logger');

/**
 * Initialize Stripe with the Secret Key
 * (Requires STRIPE_SECRET_KEY in environment)
 */
const stripe = new Stripe(env.stripeSecretKey || 'sk_test_placeholder', {
  apiVersion: '2023-10-16',
  appInfo: {
    name: 'Eventify',
    version: '2.0.0',
  }
});

const stripeService = {
  /**
   * Creates a PaymentIntent in Stripe
   * Uses receiptId as the idempotency key to prevent accidental duplicate charges
   */
  async createOrder(amount, currency = 'usd', receiptId, metadata = {}) {
    try {
      if (!env.stripeSecretKey) {
        throw new Error('Stripe API Key is missing from environment variables');
      }

      // Ensure amount is an integer (e.g., cents)
      const amountInSmallestUnit = Math.round(amount);

      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: amountInSmallestUnit,
          currency: currency.toLowerCase(),
          metadata: {
            receiptId,
            ...metadata
          }
        },
        {
          idempotencyKey: `stripe_intent_${receiptId}`
        }
      );

      info(`Stripe PaymentIntent created: [${paymentIntent.id}] for receipt [${receiptId}]`);

      return {
        id: paymentIntent.id,
        client_secret: paymentIntent.client_secret,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        gateway: 'stripe'
      };
    } catch (err) {
      logError(`Stripe createOrder Error: ${err.message}`);
      throw new ApiError(500, `Failed to initialize payment: ${err.message}`);
    }
  },

  /**
   * Directly fetches the PaymentIntent from Stripe to verify actual status
   */
  async verifyPayment(paymentData) {
    try {
      const { paymentIntentId } = paymentData;
      if (!paymentIntentId) {
        throw new ApiError(400, 'Missing Stripe PaymentIntent ID for verification');
      }

      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

      let mappedStatus = 'PENDING';
      if (intent.status === 'succeeded') mappedStatus = 'PAID';
      if (intent.status === 'requires_capture') mappedStatus = 'AUTHORIZED';
      if (intent.status === 'canceled') mappedStatus = 'CANCELLED';
      if (['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(intent.status)) mappedStatus = 'PENDING';

      return {
        verified: intent.status === 'succeeded',
        id: intent.id,
        status: mappedStatus,
        amount: intent.amount,
        currency: intent.currency,
        raw_status: intent.status
      };
    } catch (err) {
      logError(`Stripe verifyPayment Error: ${err.message}`);
      throw new ApiError(500, 'Failed to verify payment with Stripe');
    }
  },

  /**
   * Captures an authorized payment (if manual capture is enabled)
   */
  async capturePayment(paymentIntentId, amountToCapture = null) {
    try {
      const options = amountToCapture ? { amount_to_capture: Math.round(amountToCapture) } : {};
      const intent = await stripe.paymentIntents.capture(paymentIntentId, options);
      
      info(`Stripe PaymentIntent captured: [${intent.id}]`);
      return intent;
    } catch (err) {
      logError(`Stripe capturePayment Error: ${err.message}`);
      throw new ApiError(500, `Failed to capture payment: ${err.message}`);
    }
  },

  /**
   * Processes a full or partial refund
   */
  async refundPayment(paymentIntentId, amount = null, metadata = {}) {
    try {
      const refundOptions = {
        payment_intent: paymentIntentId,
        metadata
      };

      if (amount) {
        refundOptions.amount = Math.round(amount);
      }

      const refund = await stripe.refunds.create(refundOptions, {
        idempotencyKey: `refund_${paymentIntentId}_${amount || 'full'}`
      });

      info(`Stripe Refund initiated: [${refund.id}] for PaymentIntent [${paymentIntentId}]`);
      
      return {
        id: refund.id,
        status: refund.status, // e.g., 'succeeded', 'pending', 'failed'
        amount: refund.amount,
        payment_intent: paymentIntentId
      };
    } catch (err) {
      logError(`Stripe refundPayment Error: ${err.message}`);
      throw new ApiError(500, `Refund failed: ${err.message}`);
    }
  },

  /**
   * Retrieves full details of a specific PaymentIntent
   */
  async getPaymentDetails(paymentIntentId) {
    try {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      return intent;
    } catch (err) {
      logError(`Stripe getPaymentDetails Error: ${err.message}`);
      throw new ApiError(404, 'Payment details not found');
    }
  },

  /**
   * Retrieves a list of recent PaymentIntents (History)
   */
  async getPaymentHistory(limit = 10, startingAfter = null) {
    try {
      const options = { limit };
      if (startingAfter) options.starting_after = startingAfter;
      
      const intents = await stripe.paymentIntents.list(options);
      return intents.data;
    } catch (err) {
      logError(`Stripe getPaymentHistory Error: ${err.message}`);
      throw new ApiError(500, 'Failed to retrieve payment history from Stripe');
    }
  },

  /**
   * Validates the cryptographic signature of incoming Stripe Webhooks
   */
  validateWebhookSignature(payload, signatureHeader) {
    try {
      if (!env.stripeWebhookSecret) {
        throw new Error('Stripe Webhook Secret is missing from environment variables');
      }

      // Stripe SDK requires the raw body buffer, not the parsed JSON string
      const event = stripe.webhooks.constructEvent(
        payload,
        signatureHeader,
        env.stripeWebhookSecret
      );
      return event;
    } catch (err) {
      logError(`Stripe Signature Validation Failed: ${err.message}`);
      throw new ApiError(400, `Webhook Signature Verification Failed: ${err.message}`);
    }
  },

  /**
   * Handles and routes webhook events based on their type
   */
  async handleWebhook(payload, signatureHeader) {
    try {
      const event = this.validateWebhookSignature(payload, signatureHeader);
      
      let result = {
        handled: true,
        type: event.type,
        paymentIntentId: null,
        status: null
      };

      const paymentIntent = event.data.object;

      switch (event.type) {
        case 'payment_intent.succeeded':
          info(`Webhook Event: Payment [${paymentIntent.id}] succeeded.`);
          result.paymentIntentId = paymentIntent.id;
          result.status = 'PAID';
          break;
        case 'payment_intent.payment_failed':
          info(`Webhook Event: Payment [${paymentIntent.id}] failed.`);
          result.paymentIntentId = paymentIntent.id;
          result.status = 'FAILED';
          break;
        case 'charge.refunded':
          info(`Webhook Event: Charge [${paymentIntent.id}] refunded.`);
          result.paymentIntentId = paymentIntent.payment_intent;
          result.status = paymentIntent.refunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
          break;
        default:
          info(`Webhook Event: Unhandled event type [${event.type}]`);
          result.handled = false;
      }

      return result;
    } catch (err) {
      logError(`Stripe handleWebhook Error: ${err.message}`);
      throw err;
    }
  }
};

module.exports = stripeService;
