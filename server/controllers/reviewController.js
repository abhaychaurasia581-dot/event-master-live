const reviewModel = require('../models/reviewModel');
const bookingModel = require('../models/bookingModel');
const cacheService = require('../services/cacheService');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { info, error: logError } = require('../utils/logger');

const REVIEW_CACHE_TTL = 3600; // 1 Hour
const TOP_RATED_TTL = 1800;    // 30 Minutes

// ============================================================================
// Cache Invalidation Helpers
// ============================================================================

const invalidateEventReviewCache = async (eventId) => {
  await cacheService.deleteByPattern(`reviews:event:${eventId}*`);
  await cacheService.deleteByPattern(`reviews:top-rated*`); // Aggregations change
  info(`Invalidated review cache for Event [${eventId}] and Top Rated list`);
};

const invalidateUserReviewCache = async (userId) => {
  await cacheService.deleteByPattern(`reviews:user:${userId}*`);
  info(`Invalidated review cache for User [${userId}]`);
};

// ============================================================================
// Controller Methods
// ============================================================================

/**
 * @desc    Create a new review for an event
 * @route   POST /api/v2/reviews
 * @access  Private
 */
const createReview = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { eventId, rating, review } = req.body;

  if (!eventId || !rating || !review) {
    throw new ApiError(400, 'Event ID, Rating, and Review text are required');
  }

  // 1. Verify that the user has actually booked/attended the event
  // checkDuplicateBooking returns true if a confirmed/checked-in booking exists
  const hasBooked = await bookingModel.checkDuplicateBooking(userId, eventId);
  if (!hasBooked) {
    throw new ApiError(403, 'You must have a verified booking to review this event');
  }

  // 2. Submit the review (Model will throw ER_DUP_ENTRY if review already exists)
  const reviewId = await reviewModel.createReview(userId, eventId, rating, review);

  // 3. Purge related caches
  await invalidateEventReviewCache(eventId);
  await invalidateUserReviewCache(userId);

  return res.status(201).json(
    new ApiResponse(201, { reviewId }, 'Review submitted successfully')
  );
});

/**
 * @desc    Update an existing review
 * @route   PUT /api/v2/reviews/:reviewId
 * @access  Private
 */
const updateReview = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { reviewId } = req.params;
  const { rating, review } = req.body;

  if (!rating && !review) {
    throw new ApiError(400, 'Rating or Review text must be provided for update');
  }

  // Fetch the existing review to ensure ownership and get eventId for cache purging
  const existingReview = await reviewModel.getReviewById(reviewId);
  if (!existingReview) {
    throw new ApiError(404, 'Review not found');
  }
  
  if (existingReview.user_id !== userId) {
    throw new ApiError(403, 'You are not authorized to update this review');
  }

  // Use existing values if partial update
  const finalRating = rating || existingReview.rating;
  const finalReviewText = review || existingReview.review;

  await reviewModel.updateReview(reviewId, userId, finalRating, finalReviewText);

  await invalidateEventReviewCache(existingReview.event_id);
  await invalidateUserReviewCache(userId);

  return res.status(200).json(
    new ApiResponse(200, { reviewId }, 'Review updated successfully')
  );
});

/**
 * @desc    Delete a review
 * @route   DELETE /api/v2/reviews/:reviewId
 * @access  Private (Owner or Admin)
 */
const deleteReview = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { reviewId } = req.params;

  const existingReview = await reviewModel.getReviewById(reviewId);
  if (!existingReview) {
    throw new ApiError(404, 'Review not found');
  }

  // Allow deletion if the user is the owner OR an Admin
  if (existingReview.user_id !== userId && req.user.role !== 'ADMIN') {
    throw new ApiError(403, 'You are not authorized to delete this review');
  }

  // Pass existingReview.user_id to ensure we delete the exact review safely
  const deleted = await reviewModel.deleteReview(reviewId, existingReview.user_id);
  
  if (deleted) {
    await invalidateEventReviewCache(existingReview.event_id);
    await invalidateUserReviewCache(existingReview.user_id);
  }

  return res.status(200).json(
    new ApiResponse(200, null, 'Review deleted successfully')
  );
});

/**
 * @desc    Get all paginated reviews for a specific event with analytics
 * @route   GET /api/v2/reviews/event/:eventId
 * @access  Public
 */
const getEventReviews = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;

  const cacheKey = `reviews:event:${eventId}:page:${page}:limit:${limit}`;

  const reviewData = await cacheService.remember(cacheKey, REVIEW_CACHE_TTL, async () => {
    info(`Cache MISS [${cacheKey}]. Executing database aggregations.`);
    
    // Execute all queries concurrently for maximum performance
    const [
      reviewsPayload,
      averageRating,
      ratingDistribution,
      totalReviews
    ] = await Promise.all([
      reviewModel.getEventReviews(eventId, { page, limit }),
      reviewModel.getAverageRating(eventId),
      reviewModel.getRatingDistribution(eventId),
      reviewModel.getReviewCount(eventId)
    ]);

    return {
      reviews: reviewsPayload.reviews,
      pagination: reviewsPayload.pagination,
      analytics: {
        averageRating,
        totalReviews,
        ratingDistribution
      }
    };
  });

  return res.status(200).json(
    new ApiResponse(200, reviewData, 'Event reviews retrieved successfully')
  );
});

/**
 * @desc    Get all paginated reviews written by the authenticated user
 * @route   GET /api/v2/reviews/user
 * @access  Private
 */
const getUserReviews = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;

  const cacheKey = `reviews:user:${userId}:page:${page}:limit:${limit}`;

  const reviewData = await cacheService.remember(cacheKey, REVIEW_CACHE_TTL, async () => {
    return await reviewModel.getUserReviews(userId, { page, limit });
  });

  return res.status(200).json(
    new ApiResponse(200, reviewData, 'User reviews retrieved successfully')
  );
});

/**
 * @desc    Get top rated events globally (Trending/Popularity Engine)
 * @route   GET /api/v2/reviews/trending
 * @access  Public
 */
const getTopRatedEvents = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  
  const cacheKey = `reviews:top-rated:limit:${limit}`;

  const topRatedEvents = await cacheService.remember(cacheKey, TOP_RATED_TTL, async () => {
    return await reviewModel.getTopRatedEvents(limit);
  });

  return res.status(200).json(
    new ApiResponse(200, topRatedEvents, 'Top rated events retrieved successfully')
  );
});

module.exports = {
  createReview,
  updateReview,
  deleteReview,
  getEventReviews,
  getUserReviews,
  getTopRatedEvents
};
