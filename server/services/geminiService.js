const { GoogleGenerativeAI } = require('@google/generative-ai');
const env = require('../config/env');
const ApiError = require('../utils/apiError');
const { info, error: logError } = require('../utils/logger');

let genAI = null;

/**
 * Lazy initialization of the Gemini SDK
 */
const getGeminiInstance = () => {
  if (!genAI) {
    if (!env.geminiApiKey) {
      // Defer throwing until the service is actually invoked
      throw new Error('GEMINI_API_KEY is missing from environment variables');
    }
    genAI = new GoogleGenerativeAI(env.geminiApiKey);
  }
  return genAI;
};

/**
 * Helper function to enforce a timeout on AI requests
 */
const withTimeout = (promise, ms) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`AI Request timed out after ${ms}ms`));
    }, ms);
  });

  return Promise.race([
    promise,
    timeoutPromise
  ]).finally(() => clearTimeout(timeoutId));
};

const geminiService = {
  /**
   * Generates a plain text response from a given prompt.
   * Useful for Summarizations or general textual insights.
   */
  async generateText(prompt) {
    try {
      const ai = getGeminiInstance();
      const model = ai.getGenerativeModel({
        model: env.geminiModel || 'gemini-1.5-flash',
        generationConfig: {
          maxOutputTokens: env.aiMaxTokens ? parseInt(env.aiMaxTokens) : 1024,
          temperature: 0.7,
        },
      });

      const timeoutMs = env.aiTimeout ? parseInt(env.aiTimeout) : 10000;
      
      const result = await withTimeout(model.generateContent(prompt), timeoutMs);
      return result.response.text();
    } catch (err) {
      logError(`Gemini generateText Error: ${err.message}`);
      throw new ApiError(500, `AI Provider Error: ${err.message}`);
    }
  },

  /**
   * Generates structured JSON output from a given prompt.
   * Essential for natural language search parsing and structured recommendations.
   */
  async generateJSON(prompt) {
    try {
      const ai = getGeminiInstance();
      const model = ai.getGenerativeModel({
        model: env.geminiModel || 'gemini-1.5-flash',
        generationConfig: {
          maxOutputTokens: env.aiMaxTokens ? parseInt(env.aiMaxTokens) : 2048,
          temperature: 0.1, // Lower temperature for more deterministic JSON parsing
          responseMimeType: 'application/json',
        },
      });

      const timeoutMs = env.aiTimeout ? parseInt(env.aiTimeout) : 15000;
      
      const result = await withTimeout(
        model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }]
        }),
        timeoutMs
      );

      const rawText = result.response.text();
      return JSON.parse(rawText);
    } catch (err) {
      logError(`Gemini generateJSON Error: ${err.message}`);
      throw new ApiError(500, `AI JSON Generation Failed: ${err.message}`);
    }
  }
};

module.exports = geminiService;
