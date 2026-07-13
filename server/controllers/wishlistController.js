const wishlistModel = require('../models/wishlistModel');
const cacheService = require('../services/cacheService');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { info, error: logError } = require('../utils/logger');

// Cache Time-To-Live for Wishlist Queries (5 minutes)
const WISHLIST_CACHE_TTL = 300; 

/**
 * Helper function to invalidate all cached wishlist pages for a specific user
 * @param {string} userId 
 */
const invalidateUserWishlistCache = async (userId) => {
  const pattern = `wishlist:user:${userId}:*`;
  await cacheService.deleteByPattern(pattern);
  info(`Invalidated cache pattern: [${pattern}]`);
};

/**
 * @desc    Add an event to the authenticated user's wishlist
 * @route   POST /api/v2/wishlist
 * @access  Private
 */
const addToWishlist = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { eventId } = req.body;

  if (!eventId) throw new ApiError(400, 'Event ID is required');

  const added = await wishlistModel.addToWishlist(userId, eventId);
  
  if (added) {
    await invalidateUserWishlistCache(userId);
    return res.status(201).json(
      new ApiResponse(201, { eventId, added: true }, 'Event added to wishlist successfully')
    );
  }

  return res.status(200).json(
    new ApiResponse(200, { eventId, added: false }, 'Event is already in your wishlist')
  );
});

/**
 * @desc    Remove an event from the authenticated user's wishlist
 * @route   DELETE /api/v2/wishlist/:eventId
 * @access  Private
 */
const removeFromWishlist = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { eventId } = req.params;

  if (!eventId) throw new ApiError(400, 'Event ID is required');

  const removed = await wishlistModel.removeFromWishlist(userId, eventId);
  
  if (removed) {
    await invalidateUserWishlistCache(userId);
    return res.status(200).json(
      new ApiResponse(200, { eventId, removed: true }, 'Event removed from wishlist successfully')
    );
  }

  throw new ApiError(404, 'Event not found in your wishlist');
});

/**
 * @desc    Get the authenticated user's paginated wishlist
 * @route   GET /api/v2/wishlist
 * @access  Private
 */
const getWishlist = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;

  // Construct a deterministic cache key that includes pagination parameters
  const cacheKey = `wishlist:user:${userId}:page:${page}:limit:${limit}`;

  // Use the Remember pattern: Fetch from cache if exists, otherwise run DB query and cache result
  const wishlistData = await cacheService.remember(cacheKey, WISHLIST_CACHE_TTL, async () => {
    info(`Cache MISS [${cacheKey}]. Executing database query.`);
    return await wishlistModel.getUserWishlist(userId, { page, limit });
  });

  return res.status(200).json(
    new ApiResponse(200, wishlistData, 'User wishlist retrieved successfully')
  );
});

/**
 * @desc    Check if a specific event is in the authenticated user's wishlist
 * @route   GET /api/v2/wishlist/check/:eventId
 * @access  Private
 */
const checkWishlistStatus = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { eventId } = req.params;

  if (!eventId) throw new ApiError(400, 'Event ID is required');

  const isWishlisted = await wishlistModel.isWishlisted(userId, eventId);

  return res.status(200).json(
    new ApiResponse(200, { eventId, isWishlisted }, 'Wishlist status checked successfully')
  );
});

/**
 * @desc    Clear all items from the authenticated user's wishlist
 * @route   DELETE /api/v2/wishlist
 * @access  Private
 */
const clearWishlist = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const deletedCount = await wishlistModel.clearUserWishlist(userId);
  
  if (deletedCount > 0) {
    await invalidateUserWishlistCache(userId);
  }

  return res.status(200).json(
    new ApiResponse(200, { deletedCount }, 'Your wishlist has been cleared entirely')
  );
});

module.exports = {
  addToWishlist,
  removeFromWishlist,
  getWishlist,
  checkWishlistStatus,
  clearWishlist
};
