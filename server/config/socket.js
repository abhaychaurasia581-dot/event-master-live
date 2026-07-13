const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('./env');
const userModel = require('../models/userModel');
const { info, error: logError } = require('../utils/logger');

let io = null;

/**
 * Socket.IO Authentication Middleware
 * Validates JWT from handshake and populates socket.user
 */
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    const decoded = jwt.verify(token, env.jwtSecret);
    const user = await userModel.findUserById(decoded.id);

    if (!user || user.is_deleted) {
      return next(new Error('Authentication error: User invalid or deactivated'));
    }

    // Attach authenticated user payload to socket instance
    socket.user = {
      id: user.id,
      role: user.role,
      name: user.name
    };

    next();
  } catch (err) {
    logError(`Socket Auth Error: ${err.message}`);
    next(new Error('Authentication error: Invalid or expired token'));
  }
};

/**
 * Initialize Socket.IO Server with Namespaces and Room Logic
 * @param {Object} server - HTTP Server instance
 */
const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: env.clientUrl,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Apply authentication globally
  io.use(authenticateSocket);

  const namespaces = ['/notifications', '/events', '/dashboard'];

  namespaces.forEach((ns) => {
    const namespace = io.of(ns);

    namespace.on('connection', (socket) => {
      info(`User [${socket.user.id}] connected to namespace: ${ns}`);

      // Automatically join core user-specific and role-specific rooms
      socket.join(`user_${socket.user.id}`);
      
      if (socket.user.role === 'ADMIN') {
        socket.join('admin_room');
      }
      if (socket.user.role === 'ORGANIZER') {
        socket.join('organizer_room');
        socket.join(`organizer_${socket.user.id}`);
      }

      // Explicit Room Handlers
      socket.on('join-room', (room) => {
        socket.join(room);
        info(`Socket [${socket.id}] joined room: ${room}`);
      });

      socket.on('leave-room', (room) => {
        socket.leave(room);
        info(`Socket [${socket.id}] left room: ${room}`);
      });

      // Disconnect Handler
      socket.on('disconnect', () => {
        info(`User [${socket.user.id}] disconnected from namespace: ${ns}`);
      });
    });
  });

  info('Socket.IO initialized and ready.');
  return io;
};

/**
 * Get Socket.IO instance
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized. Please call initializeSocket(server) first.');
  }
  return io;
};

// ---------------------------------------------------------
// Reusable Helper Functions for Controllers & Services
// ---------------------------------------------------------

/**
 * Emit an event to a specific user across all their connected devices
 */
const emitToUser = (userId, eventName, payload, namespace = '/notifications') => {
  if (io) {
    io.of(namespace).to(`user_${userId}`).emit(eventName, payload);
  }
};

/**
 * Emit an event to a specific organizer
 */
const emitToOrganizer = (organizerId, eventName, payload, namespace = '/dashboard') => {
  if (io) {
    io.of(namespace).to(`organizer_${organizerId}`).emit(eventName, payload);
  }
};

/**
 * Emit an event to all connected admins
 */
const emitToAdmin = (eventName, payload, namespace = '/dashboard') => {
  if (io) {
    io.of(namespace).to('admin_room').emit(eventName, payload);
  }
};

/**
 * Emit an event to a specific event room (e.g., live seat updates for users viewing the event)
 */
const emitToEventRoom = (eventId, eventName, payload, namespace = '/events') => {
  if (io) {
    io.of(namespace).to(`event_${eventId}`).emit(eventName, payload);
  }
};

/**
 * Broadcast a global notification to all connected users
 */
const broadcastNotification = (eventName, payload, namespace = '/notifications') => {
  if (io) {
    io.of(namespace).emit(eventName, payload);
  }
};

module.exports = {
  initializeSocket,
  getIO,
  emitToUser,
  emitToOrganizer,
  emitToAdmin,
  emitToEventRoom,
  broadcastNotification
};
