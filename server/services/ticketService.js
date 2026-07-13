const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');
const qrService = require('./qrService');
const emailService = require('./emailService');
const bookingModel = require('../models/bookingModel');
const ApiError = require('../utils/apiError');
const { info, error: logError } = require('../utils/logger');

/**
 * Creates the `tickets` table if it doesn't exist to support this service's functionality.
 * (Self-healing architecture to avoid external schema dependencies).
 */
const ensureTicketsTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS tickets (
      id CHAR(36) PRIMARY KEY,
      booking_id CHAR(36) NOT NULL UNIQUE,
      ticket_number VARCHAR(100) NOT NULL UNIQUE,
      qr_payload TEXT NOT NULL,
      status ENUM('ACTIVE', 'USED', 'CANCELLED', 'EXPIRED') DEFAULT 'ACTIVE',
      issue_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      expiry_date DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    )
  `;
  await pool.execute(query);
};

// Initialize table (fire and forget)
ensureTicketsTable().catch(err => logError(`Failed to ensure tickets table: ${err.message}`));

const ticketService = {
  /**
   * Generates a unique ticket only after successful payment confirmation
   */
  async createTicket(bookingId) {
    try {
      const booking = await bookingModel.getBookingById(bookingId);
      
      if (!booking) {
        throw new ApiError(404, 'Booking not found');
      }

      if (booking.status !== 'CONFIRMED') {
        throw new ApiError(400, 'Cannot generate ticket for unconfirmed booking');
      }

      // Check for duplicate active ticket
      const existingTicket = await this.getTicketByBookingId(bookingId);
      if (existingTicket && existingTicket.status === 'ACTIVE') {
        throw new ApiError(409, 'An active ticket already exists for this booking');
      }

      const ticketId = uuidv4();
      
      // Generate Secure QR Payload
      const qrDataURL = await qrService.generateTicketQRCode(booking, 'dataURL');

      // Expiry Date (Event End Date + 1 day buffer)
      const expiryDate = new Date(new Date(booking.end_date).getTime() + 24 * 60 * 60 * 1000);

      const query = `
        INSERT INTO tickets (id, booking_id, ticket_number, qr_payload, status, expiry_date)
        VALUES (?, ?, ?, ?, 'ACTIVE', ?)
      `;
      
      await pool.execute(query, [
        ticketId, 
        booking.id, 
        booking.ticket_number, 
        qrDataURL, 
        expiryDate
      ]);

      const ticket = await this.getTicketByBookingId(bookingId);

      // Asynchronously queue the email
      emailService.sendBookingConfirmationEmail(
        booking.user_email,
        booking.user_name,
        {
          eventName: booking.event_title,
          bookingReference: booking.booking_reference,
          ticketNumber: booking.ticket_number,
          qrCode: qrDataURL
        }
      ).catch(err => logError(`Ticket Email Queueing Failed: ${err.message}`));

      info(`Ticket [${ticketId}] successfully created for Booking [${bookingId}]`);
      return ticket;
      
    } catch (error) {
      logError(`createTicket failed for Booking [${bookingId}]: ${error.message}`);
      throw error;
    }
  },

  /**
   * Fetch ticket metadata by Booking ID
   */
  async getTicketByBookingId(bookingId) {
    const query = `
      SELECT t.*, b.booking_reference, b.event_id, b.user_id 
      FROM tickets t
      JOIN bookings b ON t.booking_id = b.id
      WHERE t.booking_id = ? 
      LIMIT 1
    `;
    const [rows] = await pool.execute(query, [bookingId]);
    return rows[0] || null;
  },

  /**
   * Fetch ticket metadata by Ticket Number
   */
  async getTicketByTicketNumber(ticketNumber) {
    const query = `
      SELECT t.*, b.booking_reference, b.event_id, b.user_id 
      FROM tickets t
      JOIN bookings b ON t.booking_id = b.id
      WHERE t.ticket_number = ? 
      LIMIT 1
    `;
    const [rows] = await pool.execute(query, [ticketNumber]);
    return rows[0] || null;
  },

  /**
   * Regenerates a ticket without changing the core booking reference
   */
  async regenerateTicket(bookingId) {
    const ticket = await this.getTicketByBookingId(bookingId);
    if (!ticket) throw new ApiError(404, 'No existing ticket found for this booking');
    if (ticket.status === 'CANCELLED') throw new ApiError(400, 'Cannot regenerate a cancelled ticket');

    const booking = await bookingModel.getBookingById(bookingId);
    
    // Generate new QR payload to invalidate old ones (creates a fresh JWT)
    const newQrDataURL = await qrService.generateTicketQRCode(booking, 'dataURL');

    const query = `UPDATE tickets SET qr_payload = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    await pool.execute(query, [newQrDataURL, ticket.id]);

    info(`Ticket regenerated for Booking [${bookingId}]`);
    return this.getTicketByBookingId(bookingId);
  },

  /**
   * Cancels a ticket (Triggered via booking cancellation)
   */
  async cancelTicket(bookingId) {
    const query = `UPDATE tickets SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE booking_id = ?`;
    await pool.execute(query, [bookingId]);
    info(`Ticket cancelled for Booking [${bookingId}]`);
    return true;
  },

  /**
   * Validates a ticket number & checks expiry
   */
  async validateTicket(ticketNumber) {
    const ticket = await this.getTicketByTicketNumber(ticketNumber);
    if (!ticket) throw new ApiError(404, 'Ticket not found');
    
    if (ticket.status === 'CANCELLED') throw new ApiError(400, 'Ticket has been cancelled');
    if (ticket.status === 'USED') throw new ApiError(400, 'Ticket has already been used');
    if (ticket.status === 'EXPIRED' || new Date() > new Date(ticket.expiry_date)) {
      throw new ApiError(400, 'Ticket is expired');
    }

    return {
      isValid: true,
      ticket
    };
  },

  /**
   * Checks in a ticket (Marks as USED)
   */
  async checkInTicket(ticketNumber) {
    // Validate first
    await this.validateTicket(ticketNumber);

    const query = `UPDATE tickets SET status = 'USED', updated_at = CURRENT_TIMESTAMP WHERE ticket_number = ?`;
    await pool.execute(query, [ticketNumber]);

    info(`Ticket [${ticketNumber}] successfully checked in.`);
    return true;
  },

  /**
   * Resends the ticket confirmation email manually
   */
  async resendTicketEmail(bookingId) {
    const ticket = await this.getTicketByBookingId(bookingId);
    if (!ticket) throw new ApiError(404, 'Ticket not found');
    if (ticket.status !== 'ACTIVE') throw new ApiError(400, 'Can only resend active tickets');

    const booking = await bookingModel.getBookingById(bookingId);

    try {
      await emailService.sendBookingConfirmationEmail(
        booking.user_email,
        booking.user_name,
        {
          eventName: booking.event_title,
          bookingReference: booking.booking_reference,
          ticketNumber: booking.ticket_number,
          qrCode: ticket.qr_payload
        }
      );
      info(`Resent ticket email for Booking [${bookingId}]`);
      return true;
    } catch (err) {
      logError(`Resend Ticket Email Queueing Failed: ${err.message}`);
      throw new ApiError(500, 'Failed to resend ticket email');
    }
  }
};

module.exports = ticketService;
