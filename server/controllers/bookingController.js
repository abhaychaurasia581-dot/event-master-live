const bookingModel = require('../models/bookingModel');
const eventModel = require('../models/eventModel');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { info, error: logError } = require('../utils/logger');

/**
 * @desc    Create a new booking (Pending Payment)
 * @route   POST /api/v1/bookings
 * @access  Private
 */
const createBooking = asyncHandler(async (req, res) => {
  const { eventId, numberOfSeats = 1 } = req.body;
  const userId = req.user.id;

  if (!eventId) {
    throw new ApiError(400, 'Event ID is required');
  }

  // 1. Fetch Event
  const event = await eventModel.getEventById(eventId);
  if (!event) {
    throw new ApiError(404, 'Event not found');
  }

  if (event.status !== 'UPCOMING') {
    throw new ApiError(400, 'Cannot book tickets for an event that is not upcoming');
  }

  // 2. Check Capacity & Lock Seats
  const seatsLocked = await bookingModel.lockSeats(eventId, numberOfSeats);
  if (!seatsLocked) {
    throw new ApiError(400, 'Not enough seats available');
  }

  // 3. Calculate Total
  const totalAmount = parseFloat(event.ticket_price) * numberOfSeats;

  try {
    // 4. Create Booking Record
    const booking = await bookingModel.createBooking({
      user_id: userId,
      event_id: eventId,
      number_of_seats: numberOfSeats,
      total_amount: totalAmount,
      created_by: userId
    });

    info(`Booking [${booking.booking_reference}] created by User [${userId}]`);

    return res.status(201).json(
      new ApiResponse(201, booking, 'Booking created successfully')
    );
  } catch (error) {
    // Rollback seats if booking fails to insert
    const { pool } = require('../config/db');
    await pool.execute('UPDATE events SET available_seats = available_seats + ? WHERE id = ?', [numberOfSeats, eventId]);
    logError(`Failed to create booking, seats rolled back: ${error.message}`);
    throw new ApiError(500, 'Failed to create booking. Please try again.');
  }
});

/**
 * @desc    Get user's booking history
 * @route   GET /api/v1/bookings/my-bookings
 * @access  Private
 */
const getUserBookings = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const bookings = await bookingModel.getUserBookings(userId, page, limit);

  return res.status(200).json(
    new ApiResponse(200, bookings, 'Bookings retrieved successfully')
  );
});

/**
 * @desc    Get specific booking details
 * @route   GET /api/v1/bookings/:id
 * @access  Private
 */
const getBookingById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const booking = await bookingModel.getBookingById(id);

  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  // Security check
  if (booking.user_id !== req.user.id && req.user.role !== 'ADMIN') {
    throw new ApiError(403, 'Unauthorized access to this booking');
  }

  return res.status(200).json(
    new ApiResponse(200, booking, 'Booking details retrieved')
  );
});

/**
 * @desc    Cancel a booking
 * @route   PUT /api/v1/bookings/:id/cancel
 * @access  Private
 */
const cancelBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const booking = await bookingModel.getBookingById(id);

  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  if (booking.user_id !== req.user.id && req.user.role !== 'ADMIN') {
    throw new ApiError(403, 'Unauthorized to cancel this booking');
  }

  if (booking.status === 'CANCELLED') {
    throw new ApiError(400, 'Booking is already cancelled');
  }

  await bookingModel.cancelBooking(id, req.user.id);
  info(`Booking [${booking.booking_reference}] cancelled by User [${req.user.id}]`);

  return res.status(200).json(
    new ApiResponse(200, null, 'Booking cancelled successfully')
  );
});

/**
 * @desc    Get all bookings for admin
 * @route   GET /api/v1/bookings/admin/all
 * @access  Private (Admin)
 */
const getAllBookingsAdmin = asyncHandler(async (req, res) => {
  if (req.user.role !== 'ADMIN') {
    throw new ApiError(403, 'Not authorized to access this resource');
  }
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 100;
  
  const result = await bookingModel.getAllBookingsAdmin({ page, limit });
  return res.status(200).json(
    new ApiResponse(200, result, 'All bookings retrieved successfully')
  );
});

module.exports = {
  createBooking,
  getUserBookings,
  getBookingById,
  cancelBooking,
  getAllBookingsAdmin
};
