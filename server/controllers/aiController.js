const aiService = require('../services/aiService');
const AIFactory = require('../services/aiFactory');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { info, error: logError } = require('../utils/logger');

/**
 * @desc    Get highly personalized event recommendations for the authenticated user
 * @route   GET /api/v2/ai/recommendations
 * @access  Private
 */
const getRecommendations = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  info(`Fetching AI recommendations for user [${userId}]`);
  
  const recommendations = await aiService.recommendEvents(userId);

  if (!recommendations || recommendations.length === 0) {
    return res.status(200).json(
      new ApiResponse(200, [], 'No recommendations available at this time')
    );
  }

  return res.status(200).json(
    new ApiResponse(200, recommendations, 'Personalized recommendations generated successfully')
  );
});

/**
 * @desc    Perform a smart natural language search for events
 * @route   POST /api/v2/ai/search
 * @access  Public
 */
const smartSearch = asyncHandler(async (req, res) => {
  const { query } = req.body;
  
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    throw new ApiError(400, 'A valid natural language search query is required');
  }

  if (query.length > 500) {
    throw new ApiError(400, 'Search query exceeds maximum allowed length of 500 characters');
  }

  info(`Executing Smart Search for query: "${query}"`);

  const searchResults = await aiService.smartSearch(query);

  return res.status(200).json(
    new ApiResponse(200, searchResults, 'Smart search completed successfully')
  );
});

/**
 * @desc    Generate a concise AI marketing summary for an event
 * @route   POST /api/v2/ai/summarize
 * @access  Public
 */
const generateSummary = asyncHandler(async (req, res) => {
  const { eventId } = req.body;

  if (!eventId) {
    throw new ApiError(400, 'Event ID is required for summarization');
  }

  info(`Generating AI Summary for Event [${eventId}]`);

  const summary = await aiService.generateSummary(eventId);

  return res.status(200).json(
    new ApiResponse(200, { eventId, summary }, 'AI Event summary generated successfully')
  );
});

/**
 * @desc    Get similar events based on AI semantic ranking
 * @route   GET /api/v2/ai/similar/:eventId
 * @access  Public
 */
const getSimilarEvents = asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  info(`Fetching Similar Events for Event [${eventId}]`);

  const similarEvents = await aiService.getSimilarEvents(eventId);

  return res.status(200).json(
    new ApiResponse(200, similarEvents, 'Similar events retrieved successfully')
  );
});

/**
 * @desc    Get trending events ranked by DB metrics + AI (wrapped in service)
 * @route   GET /api/v2/ai/trending
 * @access  Public
 */
const getTrendingEvents = asyncHandler(async (req, res) => {
  info('Fetching Trending Events');

  const trendingEvents = await aiService.getTrendingEvents(10);

  return res.status(200).json(
    new ApiResponse(200, trendingEvents, 'Trending events retrieved successfully')
  );
});

/**
 * @desc    Verify AI provider availability and latency
 * @route   GET /api/v2/ai/health
 * @access  Public / Admin
 */
const healthCheck = asyncHandler(async (req, res) => {
  info('Executing AI Provider Health Check');
  
  const startTime = Date.now();
  const result = await AIFactory.healthCheck();
  const responseTimeMs = Date.now() - startTime;

  const payload = {
    ...result,
    responseTimeMs,
    timestamp: new Date().toISOString()
  };

  return res.status(200).json(
    new ApiResponse(200, payload, 'AI Health Check completed')
  );
});

module.exports = {
  getRecommendations,
  smartSearch,
  generateSummary,
  getSimilarEvents,
  getTrendingEvents,
  healthCheck
};
