const AIFactory = require('./aiFactory');
const eventModel = require('../models/eventModel');
const bookingModel = require('../models/bookingModel');
const userModel = require('../models/userModel');
const ApiError = require('../utils/apiError');
const { info, error: logError } = require('../utils/logger');

// Simple in-memory cache map prepared to be swapped with Redis in the future
const cache = new Map();

const aiService = {
  /**
   * Generates highly personalized event recommendations for a user.
   * Database-first: We fetch a pool of relevant events and ask AI to rank/filter them.
   */
  async recommendEvents(userId) {
    const startTime = Date.now();
    try {
      // 1. Fetch User Data & Booking History Context
      const user = await userModel.findUserById(userId);
      if (!user) throw new ApiError(404, 'User not found');

      // Fetch user's past bookings to understand their taste
      const pastBookings = await bookingModel.getUserBookings(userId, { limit: 5 });
      const pastEventIds = pastBookings.map(b => b.event_id);
      
      // 2. Fetch Pool of Upcoming Active Events (Limit to 50 for AI token efficiency)
      const upcomingEventsResponse = await eventModel.getEvents({ status: 'PUBLISHED', limit: 50 });
      const upcomingEvents = upcomingEventsResponse.data || [];
      
      if (upcomingEvents.length === 0) return [];

      // If user has no history, return standard popular events deterministically
      if (pastEventIds.length === 0) {
        return this.getTrendingEvents(10);
      }

      // We need details of past events to build a taste profile
      const pastEventDetails = upcomingEvents.filter(e => pastEventIds.includes(e.id));
      const candidateEvents = upcomingEvents.filter(e => !pastEventIds.includes(e.id));

      if (candidateEvents.length === 0) return [];

      // 3. Prompt Engineering for AI Ranking
      const prompt = `
        You are an intelligent Event Recommendation Engine.
        User's past attended events:
        ${JSON.stringify(pastEventDetails.map(e => ({ title: e.title, category: e.category_id, location: e.location })))}

        Candidate upcoming events:
        ${JSON.stringify(candidateEvents.map(e => ({ id: e.id, title: e.title, category: e.category_id, location: e.location })))}

        Based on the user's past events, select and rank the top 10 most relevant candidate events.
        Return ONLY a JSON array containing the 'id' of the recommended events in ranked order.
        Example output: ["uuid1", "uuid2"]
      `;

      // 4. Delegate to AI Factory
      const rankedIds = await AIFactory.recommendEvents(prompt);

      if (!Array.isArray(rankedIds)) {
        throw new Error('AI returned malformed JSON array');
      }

      // 5. Rehydrate event objects from IDs
      const recommendedEvents = rankedIds
        .map(id => candidateEvents.find(e => e.id === id))
        .filter(Boolean); // Remove undefined if AI hallucinates an ID

      info(`AI Execution [recommendEvents]: ${Date.now() - startTime}ms`);
      return recommendedEvents.length > 0 ? recommendedEvents : this.getTrendingEvents(10);

    } catch (err) {
      logError(`AI Recommendation Failed, applying fallback: ${err.message}`);
      // Graceful fallback to deterministic upcoming events
      const fallbackResponse = await eventModel.getEvents({ status: 'PUBLISHED', limit: 10 });
      return fallbackResponse.data || [];
    }
  },

  /**
   * Smart Search: Converts Natural Language to Structured DB Filters
   */
  async smartSearch(query) {
    const startTime = Date.now();
    try {
      const prompt = `
        Convert the following natural language event search query into a structured JSON filter object.
        Supported keys: 'keywords' (string), 'category' (string), 'location' (string), 'minPrice' (number), 'maxPrice' (number), 'dateFilter' (string: 'today', 'tomorrow', 'weekend', 'week', 'month').
        If a filter is not mentioned, omit it from the JSON.
        Return ONLY the JSON object.
        
        Query: "${query}"
      `;

      // 1. Ask AI to parse the query
      const filters = await AIFactory.smartSearch(prompt);
      info(`AI Execution [smartSearch Parsed]: ${JSON.stringify(filters)} in ${Date.now() - startTime}ms`);

      // 2. Pass structured filters to existing Database logic
      const searchResults = await eventModel.getEvents(filters);
      return searchResults.data || [];

    } catch (err) {
      logError(`AI Smart Search Failed, falling back to full-text search: ${err.message}`);
      // Fallback: Just dump the raw query into the standard keyword search
      const fallbackResponse = await eventModel.getEvents({ search: query });
      return fallbackResponse.data || [];
    }
  },

  /**
   * Generates a concise marketing summary of an event using AI
   */
  async generateSummary(eventId) {
    const cacheKey = `event_summary_${eventId}`;
    
    // Future: Swap this with redis.get(cacheKey)
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }

    const startTime = Date.now();
    try {
      const event = await eventModel.getEventById(eventId);
      if (!event) throw new ApiError(404, 'Event not found for summarization');

      const prompt = `
        Write a very concise, engaging, and exciting 2-sentence marketing summary for the following event:
        Title: ${event.title}
        Location: ${event.location}
        Description: ${event.description}
        Date: ${event.start_date}
      `;

      const summary = await AIFactory.generateSummary(prompt);
      
      // Future: Swap this with redis.setex(cacheKey, 86400, summary)
      cache.set(cacheKey, summary);
      
      info(`AI Execution [generateSummary]: ${Date.now() - startTime}ms`);
      return summary;

    } catch (err) {
      logError(`AI Summary Generation Failed: ${err.message}`);
      return "An exciting upcoming event you don't want to miss!"; // Safe Fallback
    }
  },

  /**
   * Suggest related events using Category/Tags and AI semantic ranking
   */
  async getSimilarEvents(eventId) {
    const startTime = Date.now();
    try {
      const sourceEvent = await eventModel.getEventById(eventId);
      if (!sourceEvent) throw new ApiError(404, 'Event not found');

      // Deterministic Fetch: Get events in the same category or location
      const candidatesResponse = await eventModel.getEvents({ 
        category_id: sourceEvent.category_id,
        limit: 15
      });
      const candidates = candidatesResponse.data || [];

      // Filter out the source event itself
      const validCandidates = candidates.filter(e => e.id !== eventId);
      if (validCandidates.length === 0) return [];

      // AI Ranking Prompt
      const prompt = `
        Analyze the source event and rank the candidate events based on similarity in theme, title, and location.
        Return ONLY a JSON array of the top 5 most similar candidate 'id's.
        
        Source Event: ${JSON.stringify({ id: sourceEvent.id, title: sourceEvent.title, location: sourceEvent.location })}
        Candidates: ${JSON.stringify(validCandidates.map(e => ({ id: e.id, title: e.title, location: e.location })))}
      `;

      const rankedIds = await AIFactory.recommendEvents(prompt);

      if (!Array.isArray(rankedIds)) throw new Error('AI returned malformed JSON array');

      const similarEvents = rankedIds
        .map(id => validCandidates.find(e => e.id === id))
        .filter(Boolean);

      info(`AI Execution [getSimilarEvents]: ${Date.now() - startTime}ms`);
      return similarEvents.length > 0 ? similarEvents : validCandidates.slice(0, 5);

    } catch (err) {
      logError(`AI Similar Events Failed, applying fallback: ${err.message}`);
      // Fallback: Return events in same category
      const fallbackResponse = await eventModel.getEvents({ category_id: eventId.category_id, limit: 5 });
      return fallbackResponse.data || [];
    }
  },

  /**
   * Get trending events (Deterministic DB Query without AI, wrapped for architectural consistency)
   */
  async getTrendingEvents(limit = 10) {
    try {
      const response = await eventModel.getEvents({ status: 'PUBLISHED', limit });
      return response.data || [];
    } catch (err) {
      logError(`Trending Events Fetch Failed: ${err.message}`);
      throw new ApiError(500, 'Failed to fetch trending events');
    }
  }
};

module.exports = aiService;
