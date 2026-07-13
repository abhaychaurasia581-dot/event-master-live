const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');

const bookingModel = {
  /**
   * Helper to generate unique references
   */
  generateReference(prefix = 'REF') {
    const timestamp = Date.now().toString(36).toUpperCase();
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${randomStr}`;
  },

  /**
   * Check if user already has an active booking for this event
   */
  async checkDuplicateBooking(userId, eventId) {
    const query = `
      SELECT id FROM bookings 
      WHERE user_id = ? AND event_id = ? 
      AND status IN ('PENDING', 'CONFIRMED', 'CHECKED-IN') 
      AND is_deleted = FALSE
      LIMIT 1
    `;
    const [rows] = await pool.execute(query, [userId, eventId]);
    return rows.length > 0;
  },

  /**
   * Create a new booking
   */
  async createBooking(bookingData) {
    const id = uuidv4();
    const { user_id, event_id, number_of_seats, total_amount, created_by = null } = bookingData;
    
    const ticket_number = this.generateReference('TKT');
    const booking_reference = this.generateReference('BKG');
    
    const query = `
      INSERT INTO bookings (
        id, user_id, event_id, ticket_number, booking_reference, 
        number_of_seats, total_amount, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
    `;

    await pool.execute(query, [
      id, user_id, event_id, ticket_number, booking_reference, 
      number_of_seats, total_amount, created_by || user_id
    ]);

    return this.getBookingById(id);
  },

  /**
   * Get booking by ID (Includes Event Details)
   */
  async getBookingById(id) {
    const query = `
      SELECT b.*, 
             e.title as event_title, e.start_date, e.end_date, e.venue, e.city,
             u.name as user_name, u.email as user_email
      FROM bookings b
      JOIN events e ON b.event_id = e.id
      JOIN users u ON b.user_id = u.id
      WHERE b.id = ? AND b.is_deleted = FALSE
      LIMIT 1
    `;
    const [rows] = await pool.execute(query, [id]);
    return rows[0] || null;
  },

  /**
   * Get booking by Booking Reference
   */
  async getBookingByReference(reference) {
    const query = `
      SELECT * FROM bookings 
      WHERE booking_reference = ? AND is_deleted = FALSE
      LIMIT 1
    `;
    const [rows] = await pool.execute(query, [reference]);
    return rows[0] || null;
  },

  /**
   * Get booking history for a user
   */
  async getUserBookings(userId, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const query = `
      SELECT b.*, e.title as event_title, e.start_date, e.venue
      FROM bookings b
      JOIN events e ON b.event_id = e.id
      WHERE b.user_id = ? AND b.is_deleted = FALSE
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const countQuery = `SELECT COUNT(*) as total FROM bookings WHERE user_id = ? AND is_deleted = FALSE`;
    
    const [rows] = await pool.execute(query, [userId, Number(limit), Number(offset)]);
    const [countRows] = await pool.execute(countQuery, [userId]);
    
    return {
      data: rows,
      total: countRows[0].total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(countRows[0].total / Number(limit))
    };
  },

  /**
   * Update booking status (Used by payment flow)
   */
  async updateBookingStatus(id, status, updatedBy = null) {
    const query = `
      UPDATE bookings 
      SET status = ?, updated_by = ? 
      WHERE id = ? AND is_deleted = FALSE
    `;
    await pool.execute(query, [status, updatedBy, id]);
    return this.getBookingById(id);
  },

  /**
   * Cancel booking and restore seats
   */
  async cancelBooking(id, updatedBy = null) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Get booking details
      const [bookingRows] = await connection.execute(
        `SELECT event_id, number_of_seats, status FROM bookings WHERE id = ? AND is_deleted = FALSE FOR UPDATE`,
        [id]
      );

      const booking = bookingRows[0];
      if (!booking) throw new Error('Booking not found');
      if (booking.status === 'CANCELLED') throw new Error('Booking is already cancelled');

      // Update booking status
      await connection.execute(
        `UPDATE bookings SET status = 'CANCELLED', updated_by = ? WHERE id = ?`,
        [updatedBy, id]
      );

      // Restore seats if it was confirmed (If pending, seats might not be locked yet depending on logic, but usually we restore if they were locked)
      // Assuming seats are locked on creation
      await connection.execute(
        `UPDATE events SET available_seats = available_seats + ? WHERE id = ?`,
        [booking.number_of_seats, booking.event_id]
      );

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  /**
   * Lock seats during booking creation or payment
   */
  async lockSeats(eventId, number_of_seats) {
    const query = `
      UPDATE events 
      SET available_seats = available_seats - ? 
      WHERE id = ? AND available_seats >= ? AND is_deleted = FALSE
    `;
    const [result] = await pool.execute(query, [number_of_seats, eventId, number_of_seats]);
    return result.affectedRows > 0;
  },

  /**
   * Get all bookings across the platform (Admin only)
   */
  async getAllBookingsAdmin({ page = 1, limit = 100 } = {}) {
    const offset = (page - 1) * limit;
    const query = `
      SELECT 
        b.id, 
        b.number_of_seats, 
        b.total_amount, 
        b.status, 
        b.created_at,
        u.name as user_name,
        u.email as user_email,
        e.title as event_title,
        e.ticket_price
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN events e ON b.event_id = e.id
      WHERE b.is_deleted = FALSE
      ORDER BY b.created_at DESC
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}
    `;

    const countQuery = 'SELECT COUNT(*) as total FROM bookings WHERE is_deleted = FALSE';

    const [rows] = await pool.execute(query);
    const [countRows] = await pool.execute(countQuery);
    
    return {
      data: rows,
      total: countRows[0].total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(countRows[0].total / Number(limit))
    };
  }
};

module.exports = bookingModel;
