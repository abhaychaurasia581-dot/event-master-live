const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');

const eventModel = {
  /**
   * Create a new event
   */
  async createEvent(eventData) {
    const id = uuidv4();
    const {
      title, slug, description, category_id, organizer_id, venue, city, state, country,
      event_date, start_time, end_time, capacity, available_seats, ticket_price,
      featured = false, status = 'UPCOMING', banner_image = null, additional_images = null, created_by = null
    } = eventData;

    // We assume the schema has been updated to accommodate these new fields
    const query = `
      INSERT INTO events (
        id, title, slug, description, category_id, organizer_id, venue, city, state, country,
        event_date, start_time, end_time, capacity, available_seats, ticket_price, featured,
        status, banner_image, additional_images, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await pool.execute(query, [
      id, title, slug, description, category_id, organizer_id, venue, city, state, country,
      event_date, start_time, end_time, capacity, available_seats || capacity, ticket_price,
      featured, status, banner_image, additional_images, created_by || organizer_id
    ]);

    return this.getEventById(id);
  },

  /**
   * Get Event By ID
   */
  async getEventById(id) {
    const query = `
      SELECT * FROM events 
      WHERE id = ? AND is_deleted = FALSE 
      LIMIT 1
    `;
    const [rows] = await pool.execute(query, [id]);
    return rows[0] || null;
  },

  /**
   * Update Event
   */
  async updateEvent(id, updateData) {
    const fields = [];
    const values = [];

    // Dynamically build the update query based on provided fields
    const allowedFields = [
      'title', 'slug', 'description', 'category_id', 'venue', 'city', 'state', 'country',
      'event_date', 'start_time', 'end_time', 'capacity', 'available_seats', 'ticket_price',
      'featured', 'status', 'banner_image', 'additional_images', 'updated_by'
    ];

    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(updateData[field]);
      }
    });

    if (fields.length === 0) return this.getEventById(id); // Nothing to update

    const query = `
      UPDATE events 
      SET ${fields.join(', ')} 
      WHERE id = ? AND is_deleted = FALSE
    `;
    
    values.push(id);
    await pool.execute(query, values);
    
    return this.getEventById(id);
  },

  /**
   * Soft Delete Event
   */
  async softDeleteEvent(id, deletedBy = null) {
    const query = `
      UPDATE events 
      SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP, updated_by = ? 
      WHERE id = ? AND is_deleted = FALSE
    `;
    await pool.execute(query, [deletedBy, id]);
    return true;
  },

  /**
   * Restore Event
   */
  async restoreEvent(id, restoredBy = null) {
    const query = `
      UPDATE events 
      SET is_deleted = FALSE, deleted_at = NULL, updated_by = ? 
      WHERE id = ? AND is_deleted = TRUE
    `;
    await pool.execute(query, [restoredBy, id]);
    return true;
  },

  /**
   * Base query builder for listing events with filters, search, sorting and pagination
   */
  async getEvents({ search, category_id, status, featured, organizer_id, sort_by = 'created_at', sort_order = 'DESC', page = 1, limit = 10 }) {
    let baseQuery = `FROM events WHERE is_deleted = FALSE`;
    const conditions = [];
    const values = [];

    if (search) {
      conditions.push(`(title LIKE ? OR description LIKE ? OR venue LIKE ? OR city LIKE ?)`);
      const searchParam = `%${search}%`;
      values.push(searchParam, searchParam, searchParam, searchParam);
    }

    if (category_id) {
      conditions.push(`category_id = ?`);
      values.push(category_id);
    }

    if (organizer_id) {
      conditions.push(`organizer_id = ?`);
      values.push(organizer_id);
    }

    if (status) {
      conditions.push(`status = ?`);
      values.push(status);
    }

    if (featured !== undefined) {
      conditions.push(`featured = ?`);
      values.push(featured ? 1 : 0);
    }

    if (conditions.length > 0) {
      baseQuery += ` AND ` + conditions.join(' AND ');
    }

    // Count query
    const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
    const [countRows] = await pool.execute(countQuery, values);
    const total = countRows[0].total;

    // Allowed sort columns to prevent SQL injection
    const allowedSortColumns = ['title', 'event_date', 'ticket_price', 'created_at'];
    const validSortBy = allowedSortColumns.includes(sort_by) ? sort_by : 'created_at';
    const validSortOrder = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Data query
    const offset = (page - 1) * limit;
    const dataQuery = `
      SELECT * ${baseQuery} 
      ORDER BY ${validSortBy} ${validSortOrder} 
      LIMIT ? OFFSET ?
    `;
    
    // Add limit and offset to values array
    values.push(Number(limit), Number(offset));
    
    // pool.query interpolates values safely for LIMIT/OFFSET without mysqld_stmt_execute type errors
    const [rows] = await pool.query(dataQuery, values);

    return {
      data: rows,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit)
    };
  }
};

module.exports = eventModel;
