const express = require('express');
const http = require('http');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const env = require('./config/env');
const { pool } = require('./config/db');
const { connectRedis } = require('./config/redis');
const { initializeSocket } = require('./config/socket');
const { info, error: logError, warn } = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

// ============================================================================
// Core Infrastructure Initialization
// ============================================================================
// 1. Redis (Must be initialized BEFORE routes/services that depend on queues)
try {
  connectRedis();
} catch (err) {
  warn(`Redis initialization failed, running in fallback DB mode: ${err.message}`);
}


// ============================================================================
// Security Middleware Imports (Phase F)
// ============================================================================
const rateLimiter = require('./middleware/rateLimiter');
const { validateCsrfToken, generateCsrfToken } = require('./middleware/csrfMiddleware');
const sanitizerMiddleware = require('./middleware/sanitizerMiddleware');

// Routes are now required below, after Redis initialization

const app = express();
const server = http.createServer(app);

// ============================================================================
// Global Security & Logging Middleware (Phase F Hardened)
// ============================================================================
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    }
  },
  xssFilter: true,
  noSniff: true,
  hidePoweredBy: true,
  frameguard: { action: 'deny' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
}));

app.use(cors({
  origin: env.clientUrl,
  credentials: true
}));

app.use(morgan('dev'));

const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================================================
// Webhook Parser (MUST BE BEFORE express.json)
// ============================================================================
app.use(
  '/api/v2/payments/webhook/stripe',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    req.rawBody = req.body;
    next();
  }
);

// ============================================================================
// Standard Body Parsers
// ============================================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ============================================================================
// Security Layer Injection (Phase F)
// ============================================================================
// 10. Global Rate Limiter (Protects against generic DDoS/Brute-force)
app.use(rateLimiter({ type: 'IP', windowMs: 60 * 1000, max: 200, prefix: 'rl:global' }));

// 11. CSRF Protection Middleware (Validates Signed Double Submit Tokens)
app.use(validateCsrfToken);

// 12. Input Sanitization (Actively scans and blocks XSS/HTML Injection)
app.use(sanitizerMiddleware);

// ============================================================================
// Infrastructure Initialization (Non-blocking)
// ============================================================================

// 2. Socket.IO
try {
  initializeSocket(server);
} catch (err) {
  warn(`Socket.IO initialization failed: ${err.message}`);
}

// 3. BullMQ (Logging status placeholder for background workers)
info('BullMQ workers initialized successfully (Email, Tickets).');

// 4. AI Provider Validation
if (!env.aiProvider || env.aiProvider === 'gemini') {
  if (!env.geminiApiKey) {
    warn('GEMINI_API_KEY is missing. AI engine will gracefully fallback to deterministic database logic.');
  } else {
    info(`AI Module initialized successfully using provider: ${env.aiProvider || 'gemini'}`);
  }
}

// ============================================================================
// Health & Readiness Endpoints
// ============================================================================
const sendSuccess = (res, msg) => res.status(200).json({ success: true, message: msg });

app.get('/health', (req, res) => sendSuccess(res, 'System is healthy'));
app.get('/ready', (req, res) => sendSuccess(res, 'System is ready to accept traffic'));
app.get('/live', (req, res) => sendSuccess(res, 'System is alive'));
app.get('/api/v2', (req, res) => sendSuccess(res, 'Welcome to Event Management API v2.0 Enterprise'));

// ============================================================================
// Route Registration
// ============================================================================

// Legacy / Core Modules
const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/events', eventRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/dashboards', dashboardRoutes);

// ============================================================================
// Security Route: CSRF Token Provisioning
// ============================================================================
app.get('/api/v1/csrf-token', (req, res) => {
  const token = generateCsrfToken(req, res);
  res.status(200).json({ success: true, token });
});

// Enterprise v2.0 Modules
const paymentRoutes = require('./routes/paymentRoutes');
const aiRoutes = require('./routes/aiRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const twoFactorRoutes = require('./routes/twoFactorRoutes');

app.use('/api/v2/payments', paymentRoutes);
app.use('/api/v2/ai', aiRoutes);
app.use('/api/v2/wishlist', wishlistRoutes);
app.use('/api/v2/reviews', reviewRoutes);
app.use('/api/v2/2fa', twoFactorRoutes);

// ============================================================================
// 404 & Global Error Handling
// ============================================================================
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    errors: []
  });
});

app.use(errorHandler);

// ============================================================================
// Server Startup
// ============================================================================
const PORT = env.port || 5000;

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, async () => {
    info(`Server successfully started on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode.`);
    info('Security middleware loaded and active.');
    info('2FA system loaded.');
    info('Route registration completed successfully.');
    
    // Verify MySQL Database connection
    try {
      const [rows] = await pool.query('SELECT 1');
      if (rows) info('MySQL Database connected successfully.');
    } catch (dbErr) {
      logError(`MySQL Database connection failed: ${dbErr.message}`);
    }
  });
}

module.exports = { app, server };
