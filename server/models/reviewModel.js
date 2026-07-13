const { pool } = require('../config/db');
const { info, error: logError } = require('../utils/logger');
const ApiError = require('../utils/apiError');

/**
 * Production-ready Review Model.
 * Handles pure database operations related to event ratings and reviews.
 */
const reviewModel = {
  
  // ============================================================================
  // CRUD Operations
  // ============================================================================

  /**
   * Creates a new review for an event.
   * Relies on Database Unique Constraint (user_id, event_id) to prevent duplicates.
   */
  async createReview(userId, eventId, rating, reviewText) {
    try {
      const query = `
        INSERT INTO reviews (user_id, event_id, rating, review, created_at, updated_at)
        VALUES (?, ?, ?, ?, NOW(), NOW())
      `;
      const [result] = await pool.query(query, [userId, eventId, rating, reviewText]);
      
      info(`Review Created: User [${userId}] -> Event [${eventId}] Rating [${rating}]`);
      return result.insertId;
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        throw new ApiError(400, 'You have already submitted a review for this event');
      }
      logError(`Database Error in createReview: ${err.message}`);
      throw new ApiError(500, 'Failed to submit review');
    }
  },

  /**
   * Updates an existing review.
   * Ensures the user owns the review before updating.
   */
  async updateReview(reviewId, userId, rating, reviewText) {
    try {
      const query = `
        UPDATE reviews 
        SET rating = ?, review = ?, updated_at = NOW()
        WHERE id = ? AND user_id = ?
      `;
      const [result] = await pool.query(query, [rating, reviewText, reviewId, userId]);
      
      if (result.affectedRows === 0) {
        return false; // Not found or unauthorized
      }
      
      info(`Review Updated: ID [${reviewId}] by User [${userId}]`);
      return true;
    } catch (err) {
      logError(`Database Error in updateReview: ${err.message}`);
      throw new ApiError(500, 'Failed to update review');
    }
  },

  /**
   * Deletes a review.
   * Ensures the user owns the review before deleting.
   */
  async deleteReview(reviewId, userId) {
    try {
      const query = `
        DELETE FROM reviews 
        WHERE id = ? AND user_id = ?
      `;
      const [result] = await pool.query(query, [reviewId, userId]);
      
      if (result.affectedRows === 0) {
        return false;
      }
      
      info(`Review Deleted: ID [${reviewId}] by User [${userId}]`);
      return true;
    } catch (err) {
      logError(`Database Error in deleteReview: ${err.message}`);
      throw new ApiError(500, 'Failed to delete review');
    }
  },

  // ============================================================================
  // Retrieval Operations
  // ============================================================================

  /**
   * Fetch a specific review by its ID.
   */
  async getReviewById(reviewId) {
    try {
      const query = `SELECT * FROM reviews WHERE id = ? LIMIT 1`;
      const [rows] = await pool.query(query, [reviewId]);
      return rows.length ? rows[0] : null;
    } catch (err) {
      logError(`Database Error in getReviewById: ${err.message}`);
      throw new ApiError(500, 'Failed to fetch review');
    }
  },

  /**
   * Get the single review left by a user for a specific event.
   */
  async getUserReview(userId, eventId) {
    try {
      const query = `
        SELECT * FROM reviews 
        WHERE user_id = ? AND event_id = ? 
        LIMIT 1
      `;
      const [rows] = await pool.query(query, [userId, eventId]);
      return rows.length ? rows[0] : null;
    } catch (err) {
      logError(`Database Error in getUserReview: ${err.message}`);
      throw new ApiError(500, 'Failed to fetch user review for event');
    }
  },

  /**
   * Get all paginated reviews for a specific event.
   * Joins with users table to get reviewer name/avatar.
   */
  async getEventReviews(eventId, options = {}) {
    try {
      const limit = parseInt(options.limit, 10) || 10;
      const page = parseInt(options.page, 10) || 1;
      const offset = (page - 1) * limit;

      const query = `
        SELECT 
          r.id, r.rating, r.review, r.created_at, r.updated_at,
          u.id as user_id, u.name as user_name, u.avatar as user_avatar
        FROM reviews r
        JOIN users u ON r.user_id = u.id
        WHERE r.event_id = ?
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?
      `;
      const [rows] = await pool.query(query, [eventId, limit, offset]);

      const countQuery = `SELECT COUNT(*) as total FROM reviews WHERE event_id = ?`;
      const [countResult] = await pool.query(countQuery, [eventId]);
      const total = countResult[0].total;

      return {
        reviews: rows,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (err) {
      logError(`Database Error in getEventReviews: ${err.message}`);
      throw new ApiError(500, 'Failed to fetch event reviews');
    }
  },

  /**
   * Get all paginated reviews submitted by a specific user.
   * Joins with events table to get event details.
   */
  async getUserReviews(userId, options = {}) {
    try {
      const limit = parseInt(options.limit, 10) || 10;
      const page = parseInt(options.page, 10) || 1;
      const offset = (page - 1) * limit;

      const query = `
        SELECT 
          r.id as review_id, r.rating, r.review, r.created_at,
          e.id as event_id, e.title as event_title, e.banner_image as event_image
        FROM reviews r
        JOIN events e ON r.event_id = e.id
        WHERE r.user_id = ?
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?
      `;
      const [rows] = await pool.query(query, [userId, limit, offset]);

      const countQuery = `SELECT COUNT(*) as total FROM reviews WHERE user_id = ?`;
      const [countResult] = await pool.query(countQuery, [userId]);
      const total = countResult[0].total;

      return {
        reviews: rows,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (err) {
      logError(`Database Error in getUserReviews: ${err.message}`);
      throw new ApiError(500, 'Failed to fetch user reviews');
    }
  },

  // ============================================================================
  // Analytics & Aggregation
  // ============================================================================

  /**
   * Calculate the average rating for an event.
   */
  async getAverageRating(eventId) {
    try {
      const query = `
        SELECT COALESCE(AVG(rating), 0) as average_rating 
        FROM reviews 
        WHERE event_id = ?
      `;
      const [rows] = await pool.query(query, [eventId]);
      return parseFloat(rows[0].average_rating).toFixed(1);
    } catch (err) {
      logError(`Database Error in getAverageRating: ${err.message}`);
      return 0;
    }
  },

  /**
   * Get the total number of reviews for an event.
   */
  async getReviewCount(eventId) {
    try {
      const query = `SELECT COUNT(*) as total FROM reviews WHERE event_id = ?`;
      const [rows] = await pool.query(query, [eventId]);
      return rows[0].total;
    } catch (err) {
      logError(`Database Error in getReviewCount: ${err.message}`);
      return 0;
    }
  },

  /**
   * Get rating distribution (e.g., how many 5 stars, 4 stars, etc.)
   */
  async getRatingDistribution(eventId) {
    try {
      const query = `
        SELECT rating, COUNT(*) as count 
        FROM reviews 
        WHERE event_id = ? 
        GROUP BY rating 
        ORDER BY rating DESC
      `;
      const [rows] = await pool.query(query, [eventId]);
      
      // Initialize default distribution
      const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      rows.forEach(row => {
        distribution[row.rating] = row.count;
      });
      
      return distribution;
    } catch (err) {
      logError(`Database Error in getRatingDistribution: ${err.message}`);
      return { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    }
  },

  /**
   * Fetch top rated events (useful for AI recommendations and Trending module).
   */
  async getTopRatedEvents(limit = 10) {
    try {
      const query = `
        SELECT 
          e.id, e.title, e.venue, e.city, e.event_date, e.banner_image,
          AVG(r.rating) as average_rating,
          COUNT(r.id) as total_reviews
        FROM events e
        JOIN reviews r ON e.id = r.event_id
        WHERE e.status IN ('PUBLISHED', 'ACTIVE')
        GROUP BY e.id
        HAVING total_reviews > 0
        ORDER BY average_rating DESC, total_reviews DESC
        LIMIT ?
      `;
      const [rows] = await pool.query(query, [limit]);
      return rows;
    } catch (err) {
      logError(`Database Error in getTopRatedEvents: ${err.message}`);
      throw new ApiError(500, 'Failed to fetch top rated events');
    }
  }
};

module.exports = reviewModel;
