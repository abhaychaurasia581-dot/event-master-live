const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');

const paymentModel = {
  /**
   * Create a new payment record
   */
  async createPayment(paymentData) {
    const id = uuidv4();
    const {
      booking_id, gateway, transaction_id, amount, status = 'PENDING'
    } = paymentData;

    // gateway maps to payment_method in schema
    const query = `
      INSERT INTO payments (
        id, booking_id, transaction_id, amount, payment_method, status
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    // Ensure status maps to schema enum: PENDING, COMPLETED, FAILED, REFUNDED
    const dbStatus = status === 'PAID' ? 'COMPLETED' : status;

    await pool.execute(query, [
      id, booking_id, transaction_id, amount, gateway, dbStatus
    ]);

    return this.getPaymentById(id);
  },

  /**
   * Get payment by ID
   */
  async getPaymentById(id) {
    const query = `
      SELECT p.*, b.user_id 
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      WHERE p.id = ? AND p.is_deleted = FALSE 
      LIMIT 1
    `;
    const [rows] = await pool.execute(query, [id]);
    return rows[0] || null;
  },

  /**
   * Get payment by transaction ID
   */
  async getPaymentByTransactionId(transactionId) {
    const query = `
      SELECT p.*, b.user_id 
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      WHERE p.transaction_id = ? AND p.is_deleted = FALSE 
      LIMIT 1
    `;
    const [rows] = await pool.execute(query, [transactionId]);
    return rows[0] || null;
  },

  /**
   * Get a successful payment for a given booking ID
   */
  async getSuccessfulPaymentForBooking(bookingId) {
    const query = `
      SELECT p.*, b.user_id 
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      WHERE p.booking_id = ? AND p.status = 'COMPLETED' AND p.is_deleted = FALSE 
      LIMIT 1
    `;
    const [rows] = await pool.execute(query, [bookingId]);
    return rows[0] || null;
  },

  /**
   * Update payment status
   */
  async updatePaymentStatus(id, status) {
    // Map controller 'PAID' to schema 'COMPLETED'
    const dbStatus = status === 'PAID' ? 'COMPLETED' : status;
    
    const query = `
      UPDATE payments 
      SET status = ? 
      WHERE id = ? AND is_deleted = FALSE
    `;
    await pool.execute(query, [dbStatus, id]);
    return true;
  },

  /**
   * Get payment history for a user
   */
  async getUserPaymentHistory(userId) {
    const query = `
      SELECT p.*, b.booking_reference, b.event_id 
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      WHERE b.user_id = ? AND p.is_deleted = FALSE
      ORDER BY p.created_at DESC
    `;
    const [rows] = await pool.execute(query, [userId]);
    return rows;
  }
};

module.exports = paymentModel;
