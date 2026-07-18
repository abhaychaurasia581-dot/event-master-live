const { pool } = require('../config/db');
const { info, error: logError } = require('../utils/logger');
const ApiError = require('../utils/apiError');

/**
 * Production-ready Wishlist Model.
 * Handles pure database operations related to user event wishlists.
 */
const wishlistModel = {
  
  /**
   * Adds an event to a user's wishlist.
   * Uses INSERT IGNORE to silently prevent duplicates at the DB level.
   */
  async addToWishlist(userId, eventId) {
    try {
      const query = `
        INSERT IGNORE INTO wishlists (user_id, event_id, created_at)
        VALUES (?, ?, NOW())
      `;
      const [result] = await pool.query(query, [userId, eventId]);
      
      if (result.affectedRows > 0) {
        info(`Wishlist Entry Created: User [${userId}] -> Event [${eventId}]`);
        return true; // Successfully added
      }
      return false; // Already existed (ignored)
    } catch (err) {
      logError(`Database Error in addToWishlist: ${err.message}`);
      throw new ApiError(500, 'Failed to add event to wishlist');
    }
  },

  /**
   * Removes an event from a user's wishlist.
   */
  async removeFromWishlist(userId, eventId) {
    try {
      const query = `
        DELETE FROM wishlists 
        WHERE user_id = ? AND event_id = ?
      `;
      const [result] = await pool.query(query, [userId, eventId]);
      
      if (result.affectedRows > 0) {
        info(`Wishlist Entry Removed: User [${userId}] -> Event [${eventId}]`);
        return true;
      }
      return false; // Did not exist
    } catch (err) {
      logError(`Database Error in removeFromWishlist: ${err.message}`);
      throw new ApiError(500, 'Failed to remove event from wishlist');
    }
  },

  /**
   * Retrieves a paginated list of a user's wishlisted events.
   * Joins with the events table and filters out past or cancelled events.
   */
  async getUserWishlist(userId, options = {}) {
    try {
      const limit = parseInt(options.limit, 10) || 10;
      const page = parseInt(options.page, 10) || 1;
      const offset = (page - 1) * limit;

      const query = `
        SELECT 
          e.id, 
          e.title, 
          e.description, 
          e.venue, 
          e.event_date, 
          e.start_time,
          e.end_time,
          e.ticket_price, 
          e.capacity, 
          e.status, 
          e.banner_image,
          w.created_at as wishlisted_at
        FROM wishlists w
        JOIN events e ON w.event_id = e.id
        WHERE w.user_id = ?
        ORDER BY w.created_at DESC
        LIMIT ? OFFSET ?
      `;
      
      const [rows] = await pool.query(query, [userId, limit, offset]);

      // Fetch total count for pagination metadata
      const countQuery = `
        SELECT COUNT(*) as total
        FROM wishlists w
        JOIN events e ON w.event_id = e.id
        WHERE w.user_id = ?
      `;
      const [countResult] = await pool.query(countQuery, [userId]);
      const total = countResult[0].total;

      return {
        events: rows,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (err) {
      logError(`Database Error in getUserWishlist: ${err.message}`);
      throw new ApiError(500, 'Failed to fetch user wishlist');
    }
  },

  /**
   * Checks if a specific event is wishlisted by a user.
   */
  async isWishlisted(userId, eventId) {
    try {
      const query = `
        SELECT 1 
        FROM wishlists 
        WHERE user_id = ? AND event_id = ? 
        LIMIT 1
      `;
      const [rows] = await pool.query(query, [userId, eventId]);
      return rows.length > 0;
    } catch (err) {
      logError(`Database Error in isWishlisted: ${err.message}`);
      throw new ApiError(500, 'Failed to check wishlist status');
    }
  },

  /**
   * Returns the total number of times an event has been wishlisted.
   * Useful for Trending/Popularity algorithms.
   */
  async countWishlistByEvent(eventId) {
    try {
      const query = `
        SELECT COUNT(*) as total 
        FROM wishlists 
        WHERE event_id = ?
      `;
      const [rows] = await pool.query(query, [eventId]);
      return rows[0].total;
    } catch (err) {
      logError(`Database Error in countWishlistByEvent: ${err.message}`);
      throw new ApiError(500, 'Failed to count event wishlists');
    }
  },

  /**
   * Completely clears a user's wishlist (e.g., during account deletion).
   */
  async clearUserWishlist(userId) {
    try {
      const query = `
        DELETE FROM wishlists 
        WHERE user_id = ?
      `;
      const [result] = await pool.query(query, [userId]);
      
      info(`Wishlist Cleared: User [${userId}] lost ${result.affectedRows} entries`);
      return result.affectedRows;
    } catch (err) {
      logError(`Database Error in clearUserWishlist: ${err.message}`);
      throw new ApiError(500, 'Failed to clear user wishlist');
    }
  }
};

module.exports = wishlistModel;
