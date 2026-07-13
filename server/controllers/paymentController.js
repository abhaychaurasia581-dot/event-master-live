const paymentFactory = require('../services/paymentFactory');
const paymentModel = require('../models/paymentModel');
const bookingModel = require('../models/bookingModel');
const ticketService = require('../services/ticketService');
const emailService = require('../services/emailService');
const { emitToUser } = require('../config/socket');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { info, error: logError } = require('../utils/logger');

/**
 * @desc    Create a payment order/intent
 * @route   POST /api/v1/payments/create-order
 * @access  Private
 */
const createOrder = asyncHandler(async (req, res) => {
  const { bookingId, gateway } = req.body;
  const userId = req.user.id;

  const booking = await bookingModel.getBookingById(bookingId);
  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  if (booking.user_id !== userId) {
    throw new ApiError(403, 'You are not authorized to pay for this booking');
  }

  if (booking.status !== 'PENDING') {
    throw new ApiError(400, `Cannot create payment for booking with status: ${booking.status}`);
  }

  // Create order via gateway
  const orderDetails = await paymentFactory.createOrder(
    gateway, 
    booking.total_amount, 
    'INR', 
    booking.booking_reference, 
    { bookingId: booking.id, userId }
  );

  // Record initial payment attempt in database
  await paymentModel.createPayment({
    booking_id: booking.id,
    user_id: userId,
    gateway: gateway.toUpperCase(),
    transaction_id: orderDetails.id,
    amount: booking.total_amount,
    currency: 'INR',
    status: 'PENDING'
  });

  return res.status(201).json(
    new ApiResponse(201, orderDetails, 'Payment order created successfully')
  );
});

/**
 * @desc    Verify payment signature and process success/failure
 * @route   POST /api/v1/payments/verify
 * @access  Private
 */
const verifyPayment = asyncHandler(async (req, res) => {
  const { gateway, paymentData, bookingId } = req.body;
  const userId = req.user.id;

  const booking = await bookingModel.getBookingById(bookingId);
  if (!booking) throw new ApiError(404, 'Booking not found');
  
  if (booking.user_id !== userId) throw new ApiError(403, 'Unauthorized access to this booking');

  // Verify signature and status directly with the gateway
  const verificationResult = await paymentFactory.verifyPayment(gateway, paymentData);

  const paymentRecord = await paymentModel.getPaymentByTransactionId(verificationResult.id || paymentData.razorpay_order_id || paymentData.paymentIntentId);
  
  if (!paymentRecord) {
    throw new ApiError(404, 'Payment record not found in system');
  }

  if (verificationResult.status === 'PAID') {
    // 1. Update Payment Status
    await paymentModel.updatePaymentStatus(paymentRecord.id, 'PAID');
    
    // 2. Update Booking Status
    await bookingModel.updateBookingStatus(bookingId, 'CONFIRMED');
    
    // 3. Generate Ticket (this also triggers the confirmation email internally via ticketService)
    const ticket = await ticketService.createTicket(bookingId);
    
    // 4. Real-time Notification
    emitToUser(userId, 'payment_success', {
      message: 'Payment successful! Your ticket has been generated.',
      bookingId,
      ticketNumber: ticket.ticket_number
    });

    return res.status(200).json(
      new ApiResponse(200, { verified: true, ticket }, 'Payment processed successfully')
    );
  } else if (verificationResult.status === 'FAILED') {
    await paymentModel.updatePaymentStatus(paymentRecord.id, 'FAILED');
    await bookingModel.updateBookingStatus(bookingId, 'CANCELLED');
    
    // Restore seats
    await bookingModel.restoreEventSeats(booking.event_id, booking.quantity);

    // Send failure email
    emailService.sendPaymentFailureEmail(req.user.email, req.user.name, {
      bookingReference: booking.booking_reference,
      amount: booking.total_amount
    }).catch(err => logError(`Failed to queue payment failure email: ${err.message}`));

    emitToUser(userId, 'payment_failed', { message: 'Payment failed. Seats have been released.' });

    throw new ApiError(400, 'Payment failed or declined by gateway');
  }

  // If pending/authorized
  await paymentModel.updatePaymentStatus(paymentRecord.id, verificationResult.status);
  
  return res.status(200).json(
    new ApiResponse(200, { status: verificationResult.status }, 'Payment verification pending or authorized')
  );
});

/**
 * @desc    Process a refund for a booking
 * @route   POST /api/v1/payments/refund
 * @access  Private
 */
const refundPayment = asyncHandler(async (req, res) => {
  const { bookingId, reason } = req.body;
  const userId = req.user.id;

  const booking = await bookingModel.getBookingById(bookingId);
  if (!booking) throw new ApiError(404, 'Booking not found');

  if (booking.user_id !== userId && req.user.role !== 'ADMIN') {
    throw new ApiError(403, 'Unauthorized to refund this booking');
  }

  if (booking.status !== 'CONFIRMED') {
    throw new ApiError(400, 'Only confirmed bookings can be refunded');
  }

  const payment = await paymentModel.getSuccessfulPaymentForBooking(bookingId);
  if (!payment) {
    throw new ApiError(404, 'No successful payment found to refund');
  }

  // Process refund via gateway
  const refundResult = await paymentFactory.refundPayment(
    payment.gateway.toLowerCase(), 
    payment.transaction_id, 
    payment.amount, 
    { reason, bookingId }
  );

  // Update records
  await paymentModel.updatePaymentStatus(payment.id, 'REFUNDED');
  await bookingModel.updateBookingStatus(bookingId, 'CANCELLED');
  await ticketService.cancelTicket(bookingId);
  
  // Restore seats
  await bookingModel.restoreEventSeats(booking.event_id, booking.quantity);

  // Notify user
  emailService.sendBookingCancellationEmail(booking.user_email, booking.user_name, {
    bookingReference: booking.booking_reference,
    refundAmount: payment.amount
  }).catch(err => logError(`Failed to queue refund email: ${err.message}`));

  emitToUser(booking.user_id, 'booking_refunded', { message: 'Booking cancelled and refund initiated' });

  return res.status(200).json(
    new ApiResponse(200, refundResult, 'Refund processed successfully')
  );
});

/**
 * @desc    Handle incoming Gateway Webhooks securely
 * @route   POST /api/v1/payments/webhook/:gateway
 * @access  Public
 */
const handleWebhook = asyncHandler(async (req, res) => {
  const { gateway } = req.params;
  
  // Stripe requires raw body buffer for signature validation. Razorpay uses stringified body.
  // Assuming middleware provides req.rawBody
  const payload = gateway === 'stripe' ? req.rawBody : JSON.stringify(req.body);
  const signature = req.headers['stripe-signature'] || req.headers['x-razorpay-signature'];

  if (!signature) {
    logError(`Webhook signature missing for gateway: ${gateway}`);
    return res.status(400).send('Webhook signature missing');
  }

  try {
    const eventResult = await paymentFactory.handleWebhook(gateway, payload, signature);
    
    if (eventResult.handled) {
      if (eventResult.status === 'PAID') {
        const paymentRecord = await paymentModel.getPaymentByTransactionId(eventResult.paymentId || eventResult.orderId);
        if (paymentRecord && paymentRecord.status !== 'PAID') {
          // Fallback confirmation logic via webhook if frontend dropped connection
          await paymentModel.updatePaymentStatus(paymentRecord.id, 'PAID');
          await bookingModel.updateBookingStatus(paymentRecord.booking_id, 'CONFIRMED');
          await ticketService.createTicket(paymentRecord.booking_id);
          info(`Webhook fallback confirmed payment for booking [${paymentRecord.booking_id}]`);
        }
      }
    }

    return res.status(200).send('Webhook received and processed');
  } catch (error) {
    logError(`Webhook Error [${gateway}]: ${error.message}`);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

/**
 * @desc    Get payment history for user
 * @route   GET /api/v1/payments/history
 * @access  Private
 */
const getPaymentHistory = asyncHandler(async (req, res) => {
  const userId = req.user.role === 'ADMIN' && req.query.userId ? req.query.userId : req.user.id;
  const payments = await paymentModel.getUserPaymentHistory(userId);
  
  return res.status(200).json(
    new ApiResponse(200, payments, 'Payment history retrieved')
  );
});

/**
 * @desc    Get specific payment details
 * @route   GET /api/v1/payments/:id
 * @access  Private
 */
const getPaymentDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const payment = await paymentModel.getPaymentById(id);
  
  if (!payment) throw new ApiError(404, 'Payment not found');

  if (payment.user_id !== req.user.id && req.user.role !== 'ADMIN') {
    throw new ApiError(403, 'Unauthorized access to this payment record');
  }

  return res.status(200).json(
    new ApiResponse(200, payment, 'Payment details retrieved')
  );
});

module.exports = {
  createOrder,
  verifyPayment,
  refundPayment,
  handleWebhook,
  getPaymentHistory,
  getPaymentDetails
};
