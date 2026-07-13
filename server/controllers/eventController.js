const eventModel = require('../models/eventModel');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { pool } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

/**
 * Helper to get or create a default category
 * Required because the frontend CreateEvent form currently doesn't send a category_id,
 * but schema.sql enforces category_id as NOT NULL.
 */
const getDefaultCategory = async () => {
  const [rows] = await pool.execute('SELECT id FROM categories WHERE name = ? LIMIT 1', ['General']);
  if (rows.length > 0) {
    return rows[0].id;
  }
  const id = uuidv4();
  await pool.execute(
    'INSERT INTO categories (id, name, description) VALUES (?, ?, ?)',
    [id, 'General', 'General purpose events']
  );
  return id;
};

/**
 * Helper to get or create an organizer for the user
 */
const getOrCreateOrganizer = async (userId) => {
  const [rows] = await pool.execute('SELECT id FROM organizers WHERE user_id = ? LIMIT 1', [userId]);
  if (rows.length > 0) {
    return rows[0].id;
  }
  const id = uuidv4();
  await pool.execute(
    'INSERT INTO organizers (id, user_id, company_name) VALUES (?, ?, ?)',
    [id, userId, 'Default Organizer']
  );
  return id;
};

/**
 * @desc    Create a new event
 * @route   POST /api/v1/events
 * @access  Private (Organizer/Admin)
 */
exports.createEvent = asyncHandler(async (req, res) => {
  const { title, date, time, location, capacity, price, description } = req.body;

  if (!title || !date || !time || !location || !capacity || !price || !description) {
    throw new ApiError(400, 'All fields are required');
  }

  // Ensure category_id exists
  const category_id = await getDefaultCategory();

  // Ensure organizer exists for this user to satisfy foreign key constraint
  const organizer_id = await getOrCreateOrganizer(req.user.id);
  
  // Extract uploaded files if any
  let banner_image = null;
  let additional_images = [];

  if (req.files) {
    if (req.files.banner_image && req.files.banner_image.length > 0) {
      banner_image = `/uploads/${req.files.banner_image[0].filename}`;
    }
    if (req.files.additional_images && req.files.additional_images.length > 0) {
      additional_images = req.files.additional_images.map(f => `/uploads/${f.filename}`);
    }
  }
  
  // Mapping frontend fields to backend model fields
  const eventData = {
    title,
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString().slice(-4),
    description,
    category_id,
    organizer_id, 
    venue: location, // Map frontend 'location' to 'venue'
    city: 'TBD', // Schema might require these depending on strictness
    state: 'TBD',
    country: 'TBD',
    event_date: date,
    start_time: time,
    end_time: time, // Defaulting end_time to start_time if not provided
    capacity: parseInt(capacity, 10),
    ticket_price: parseFloat(price),
    banner_image,
    additional_images: JSON.stringify(additional_images),
    created_by: req.user.id
  };

  const newEvent = await eventModel.createEvent(eventData);

  res.status(201).json(new ApiResponse(201, newEvent, 'Event published successfully'));
});

/**
 * @desc    Get all events (with optional filtering)
 * @route   GET /api/v1/events
 * @access  Public
 */
exports.getAllEvents = asyncHandler(async (req, res) => {
  const filters = {
    search: req.query.search,
    category_id: req.query.category,
    status: req.query.status,
    featured: req.query.featured ? req.query.featured === 'true' : undefined,
    organizer_id: req.query.organizer,
    sort_by: req.query.sortBy,
    sort_order: req.query.sortOrder,
    page: req.query.page ? parseInt(req.query.page, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit, 10) : 10
  };

  const events = await eventModel.getEvents(filters);

  res.status(200).json(new ApiResponse(200, events, 'Events retrieved successfully'));
});

/**
 * @desc    Get event by ID
 * @route   GET /api/v1/events/:id
 * @access  Public
 */
exports.getEventById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const event = await eventModel.getEventById(id);

  if (!event) {
    throw new ApiError(404, 'Event not found');
  }

  res.status(200).json(new ApiResponse(200, event, 'Event retrieved successfully'));
});

/**
 * @desc    Update event details
 * @route   PUT /api/v1/events/:id
 * @access  Private (Organizer/Admin)
 */
exports.updateEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Verify existence and ownership
  const event = await eventModel.getEventById(id);
  if (!event) {
    throw new ApiError(404, 'Event not found');
  }

  // Ensure user owns the event or is ADMIN
  if (event.organizer_id !== req.user.id && req.user.role !== 'ADMIN') {
    throw new ApiError(403, 'You do not have permission to update this event');
  }

  const { title, date, time, location, capacity, price, description, status, featured } = req.body;

  let updateData = { updated_by: req.user.id };

  if (title) {
    updateData.title = title;
    updateData.slug = title.toLowerCase().replace(/\s+/g, '-');
  }
  if (description) updateData.description = description;
  if (location) {
    updateData.venue = location;
    updateData.city = location.split(',')[0] || 'Unknown';
    updateData.state = location.split(',')[1] || 'Unknown';
    updateData.country = location.split(',')[2] || 'Unknown';
  }
  if (date) updateData.event_date = date;
  if (time) {
    updateData.start_time = time;
    updateData.end_time = time;
  }
  if (capacity) updateData.capacity = parseInt(capacity);
  if (price !== undefined) updateData.ticket_price = parseFloat(price);
  if (status) updateData.status = status;
  if (featured !== undefined) updateData.featured = featured;

  // Extract uploaded files if any
  if (req.files) {
    if (req.files.banner_image && req.files.banner_image.length > 0) {
      updateData.banner_image = `/uploads/${req.files.banner_image[0].filename}`;
    }
    if (req.files.additional_images && req.files.additional_images.length > 0) {
      const additional_images = req.files.additional_images.map(f => `/uploads/${f.filename}`);
      updateData.additional_images = JSON.stringify(additional_images);
    }
  }

  const updatedEvent = await eventModel.updateEvent(id, updateData);

  res.status(200).json(new ApiResponse(200, updatedEvent, 'Event updated successfully'));
});

/**
 * @desc    Soft delete an event
 * @route   DELETE /api/v1/events/:id
 * @access  Private (Organizer/Admin)
 */
exports.deleteEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const event = await eventModel.getEventById(id);
  if (!event) {
    throw new ApiError(404, 'Event not found');
  }

  if (event.organizer_id !== req.user.id && req.user.role !== 'ADMIN') {
    throw new ApiError(403, 'You do not have permission to delete this event');
  }

  await eventModel.softDeleteEvent(id, req.user.id);

  res.status(200).json(new ApiResponse(200, null, 'Event deleted successfully'));
});
