const geminiService = require('./geminiService');
const env = require('../config/env');
const ApiError = require('../utils/apiError');
const { info, error: logError } = require('../utils/logger');

/**
 * Strategy Pattern Implementation for AI Providers.
 * Acts as a unified interface so controllers/services never interact directly 
 * with Gemini or any future AI provider (OpenAI, Claude, Azure).
 */
class AIFactory {
  
  /**
   * Resolves the appropriate AI provider based on environment configuration
   * @returns {Object} The active AI provider service
   */
  static getProvider() {
    const providerName = (env.aiProvider || 'gemini').toLowerCase();

    switch (providerName) {
      case 'gemini':
        return geminiService;
      
      // Future providers can be smoothly integrated by adding their cases here
      case 'openai':
      case 'claude':
      case 'azure':
        throw new ApiError(501, `AI Provider '${providerName}' is registered but not yet implemented.`);
      
      default:
        logError(`Unsupported AI Provider requested: ${providerName}`);
        throw new ApiError(400, `Unsupported AI Provider: ${providerName}`);
    }
  }

  /**
   * Generates standard text/string response
   * @param {string} prompt 
   */
  static async generateText(prompt) {
    try {
      const provider = this.getProvider();
      if (!provider.generateText) {
        throw new ApiError(501, 'generateText method is not implemented by the active provider');
      }
      return await provider.generateText(prompt);
    } catch (err) {
      logError(`AIFactory.generateText Error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Generates structured JSON output from the AI
   * @param {string} prompt 
   */
  static async generateJSON(prompt) {
    try {
      const provider = this.getProvider();
      if (!provider.generateJSON) {
        throw new ApiError(501, 'generateJSON method is not implemented by the active provider');
      }
      return await provider.generateJSON(prompt);
    } catch (err) {
      logError(`AIFactory.generateJSON Error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Delegate for Event Summarization.
   * Routes to the generic generateText method. The actual prompt construction 
   * is managed by the higher-level aiService.
   * @param {string} prompt 
   */
  static async generateSummary(prompt) {
    try {
      // Summaries are expected to be plain text
      return await this.generateText(prompt);
    } catch (err) {
      logError(`AIFactory.generateSummary Error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Delegate for Personalized Event Recommendations.
   * Expects structured JSON output for easy database querying/rendering.
   * @param {string} prompt 
   */
  static async recommendEvents(prompt) {
    try {
      return await this.generateJSON(prompt);
    } catch (err) {
      logError(`AIFactory.recommendEvents Error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Delegate for Smart Event Search parsing.
   * Converts natural language into a JSON filter object.
   * @param {string} prompt 
   */
  static async smartSearch(prompt) {
    try {
      return await this.generateJSON(prompt);
    } catch (err) {
      logError(`AIFactory.smartSearch Error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Verifies that the currently configured AI provider is online and responsive
   */
  static async healthCheck() {
    const providerName = env.aiProvider || 'gemini';
    try {
      const provider = this.getProvider();
      
      // Simple lightweight ping to check API Key validity and network status
      await provider.generateText("Reply with the word 'OK' only.");
      
      return { 
        status: 'healthy', 
        provider: providerName 
      };
    } catch (err) {
      logError(`AIFactory HealthCheck Failed for [${providerName}]: ${err.message}`);
      return { 
        status: 'unhealthy', 
        provider: providerName, 
        error: err.message 
      };
    }
  }
}

module.exports = AIFactory;
