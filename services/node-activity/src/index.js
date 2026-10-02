/**
 * Contract Guardian AI - Node.js Activity & User Microservice
 * CO4: Node.js, Express, Middleware, MongoDB/Mongoose, Socket.io, Redis, Testing
 * CO5: Activity Service microservice with meaningful responsibilities
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import winston from 'winston';

dotenv.config();

// =============================================================
// LOGGER (CO4: Winston logging)
// =============================================================
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/activity-service.log' }),
  ],
});

// =============================================================
// EXPRESS APP SETUP (CO4: Express middleware chain)
// =============================================================
const app = express();
const httpServer = createServer(app);

// Socket.io for real-time activity streaming (CO4: Socket.io)
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// =============================================================
// MIDDLEWARE STACK (CO4: Express middleware)
// =============================================================
app.use(helmet());  // Security headers
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) }
}));

// Rate limiting (CO3-style, implemented in Node.js)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: 'Too many requests', code: 'RATE_LIMIT_EXCEEDED' }
});
app.use('/api/', limiter);

// Request ID middleware
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

// =============================================================
// MONGODB SCHEMAS (CO4: Mongoose, CO2: MongoDB embedding/referencing)
// =============================================================

// Activity Log Schema (CO4: Mongoose schema with embedding pattern)
const activitySchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  userId: { type: String, index: true },
  userEmail: { type: String },
  activityType: {
    type: String,
    enum: [
      'USER_LOGIN', 'USER_LOGOUT', 'USER_SIGNUP',
      'CONTRACT_UPLOAD', 'CONTRACT_DELETE', 'CONTRACT_VIEW',
      'ANALYSIS_START', 'ANALYSIS_COMPLETE',
      'REPORT_GENERATE', 'VECTOR_SEARCH', 'RAG_QUERY',
      'PROFILE_UPDATE', 'PASSWORD_CHANGE'
    ],
    required: true,
    index: true,
  },
  contractId: { type: String, index: true },
  description: { type: String, default: '' },
  ipAddress: String,
  userAgent: String,
  sessionId: String,
  // Embedded metadata (CO2: embedding pattern)
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Reference to contract (CO2: referencing pattern)
  contractRef: { type: String, ref: 'Contract' },
  createdAt: { type: Date, default: Date.now, index: true },
}, {
  collection: 'activity_logs',
  timestamps: { createdAt: 'createdAt', updatedAt: false },
});

// Compound indexes (CO4: MongoDB indexing)
activitySchema.index({ userId: 1, createdAt: -1 });
activitySchema.index({ activityType: 1, createdAt: -1 });
activitySchema.index({ contractId: 1, activityType: 1 });

const Activity = mongoose.model('Activity', activitySchema);

// User Session Schema
const sessionSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  userId: { type: String, required: true, index: true },
  token: { type: String, required: true },
  ipAddress: String,
  userAgent: String,
  isActive: { type: Boolean, default: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
}, { collection: 'user_sessions' });

const UserSession = mongoose.model('UserSession', sessionSchema);

// =============================================================
// JWT MIDDLEWARE (CO4: Authentication in Node.js)
// =============================================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'change-me';
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Optional auth (doesn't fail if no token)
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET || 'change-me');
    } catch {}
  }
  next();
};

// =============================================================
// VALIDATION MIDDLEWARE (CO4: Joi validation)
// =============================================================
import Joi from 'joi';

const validateBody = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details.map(d => d.message)
    });
  }
  next();
};

const activitySchema_joi = Joi.object({
  userId: Joi.string().required(),
  userEmail: Joi.string().email().optional(),
  activityType: Joi.string().required(),
  contractId: Joi.string().optional(),
  description: Joi.string().optional().default(''),
  ipAddress: Joi.string().optional(),
  userAgent: Joi.string().optional(),
  metadata: Joi.object().optional().default({}),
});

// =============================================================
// ROUTES
// =============================================================

// Health check
app.get('/health', async (req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({
    service: 'contract-guardian-activity-service',
    version: '1.0.0',
    status: 'healthy',
    mongodb: mongoStatus,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    co: ['CO4 (Node.js/Express)', 'CO5 (Microservice)'],
  });
});

// Log an activity (internal service endpoint)
app.post('/api/activities',
  validateBody(activitySchema_joi),
  async (req, res) => {
    try {
      const activity = new Activity({
        ...req.body,
        ipAddress: req.body.ipAddress || req.ip,
      });
      await activity.save();

      // Emit to Socket.io for real-time dashboard
      io.emit('new_activity', {
        id: activity._id,
        activityType: activity.activityType,
        userId: activity.userId,
        description: activity.description,
        createdAt: activity.createdAt,
      });

      logger.info('Activity logged', { type: activity.activityType, userId: activity.userId });
      res.status(201).json({ id: activity._id, message: 'Activity logged' });
    } catch (err) {
      logger.error('Failed to log activity', { error: err.message });
      res.status(500).json({ error: 'Failed to log activity' });
    }
  }
);

// Get activities for a user
app.get('/api/users/:userId/activities',
  authenticateToken,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const limit = Math.min(parseInt(req.query.limit) || 50, 200);
      const page = parseInt(req.query.page) || 1;
      const type = req.query.type;

      const filter = { userId };
      if (type) filter.activityType = type;

      const [activities, total] = await Promise.all([
        Activity.find(filter)
          .sort({ createdAt: -1 })
          .limit(limit)
          .skip((page - 1) * limit)
          .lean(),
        Activity.countDocuments(filter),
      ]);

      res.json({
        activities,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Aggregation pipeline: activity stats (CO4: MongoDB aggregation, CO2)
app.get('/api/activities/stats',
  authenticateToken,
  async (req, res) => {
    try {
      const pipeline = [
        // Stage 1: Group by type and date
        {
          $group: {
            _id: {
              type: '$activityType',
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            },
            count: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' },
          }
        },
        // Stage 2: Project
        {
          $project: {
            activityType: '$_id.type',
            date: '$_id.date',
            count: 1,
            uniqueUserCount: { $size: '$uniqueUsers' },
            _id: 0,
          }
        },
        // Stage 3: Sort
        { $sort: { date: -1, count: -1 } },
        // Stage 4: Limit
        { $limit: 100 }
      ];

      const stats = await Activity.aggregate(pipeline);
      res.json({ stats, pipeline_stages: pipeline.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Recent system-wide activities (admin)
app.get('/api/activities/recent',
  authenticateToken,
  async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const activities = await Activity.find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      res.json({ activities, count: activities.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Activity type breakdown
app.get('/api/activities/breakdown',
  authenticateToken,
  async (req, res) => {
    try {
      const breakdown = await Activity.aggregate([
        { $group: { _id: '$activityType', count: { $sum: 1 } } },
        { $project: { activityType: '$_id', count: 1, _id: 0 } },
        { $sort: { count: -1 } },
      ]);
      res.json({ breakdown });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Node.js event loop demo (CO4: Event loop explanation)
app.get('/api/event-loop-demo', (req, res) => {
  const demo = {
    concept: 'Node.js Event Loop',
    description: 'Single-threaded, non-blocking I/O using libuv',
    phases: [
      { phase: 1, name: 'timers', description: 'Executes setTimeout and setInterval callbacks' },
      { phase: 2, name: 'pending callbacks', description: 'I/O callbacks deferred to next iteration' },
      { phase: 3, name: 'idle/prepare', description: 'Internal use only' },
      { phase: 4, name: 'poll', description: 'Retrieve new I/O events, execute I/O callbacks' },
      { phase: 5, name: 'check', description: 'Executes setImmediate callbacks' },
      { phase: 6, name: 'close callbacks', description: 'Close events like socket.on("close")' },
    ],
    why_matters: 'Allows thousands of concurrent connections without thread per request',
    this_service: 'This service handles async MongoDB queries without blocking',
  };
  res.json(demo);
});

// =============================================================
// SOCKET.IO (CO4: Real-time events)
// =============================================================
io.on('connection', (socket) => {
  logger.info('Socket.io client connected', { id: socket.id });

  socket.on('subscribe_user', (userId) => {
    socket.join(`user:${userId}`);
    logger.info('Socket subscribed to user activities', { socketId: socket.id, userId });
  });

  socket.on('disconnect', () => {
    logger.info('Socket.io client disconnected', { id: socket.id });
  });
});

// =============================================================
// ERROR HANDLER
// =============================================================
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, requestId: req.requestId });
  res.status(500).json({
    error: 'Internal server error',
    requestId: req.requestId,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// =============================================================
// STARTUP
// =============================================================
const PORT = process.env.PORT || 3001;
const MONGO_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017/contract_guardian';

async function start() {
  try {
    await mongoose.connect(MONGO_URL);
    logger.info('MongoDB connected', { url: MONGO_URL });
  } catch (err) {
    logger.warn('MongoDB connection failed - service will start without MongoDB', { error: err.message });
  }

  httpServer.listen(PORT, () => {
    logger.info(`Activity Service running on port ${PORT}`);
    logger.info('CO4: Node.js/Express microservice ready');
    logger.info('CO5: Activity Service microservice operational');
  });
}

start();

export { app, Activity };
