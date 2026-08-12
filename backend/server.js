const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

// Load env variables — .env.local overrides .env for local development
const envLocalPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
  console.log('🔧 Using LOCAL dev environment (.env.local)');
} else {
  dotenv.config();
}

// Logging
const { initMongoTransport, logError } = require('./utils/logger');
const requestLogger = require('./middlewares/requestLogger');

const app = express();
const server = http.createServer(app);

// Disable ETags to prevent 304 Not Modified empty response issues with Axios
app.set('etag', false);

// Prevent browser caching of API responses
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

const allowedOrigin = process.env.FRONTEND_URL || '*';
const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  }
});

// Make io accessible globally via the request object
app.set('io', io);
const { setNotifierIo } = require('./utils/notifier');
setNotifierIo(io);

// Socket connection listener
io.on('connection', (socket) => {
  console.log('Client connected to WebSockets:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Middleware
app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request logger — logs every HTTP request
app.use(requestLogger);

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/tests', require('./routes/testRoutes'));
app.use('/api/jobs', require('./routes/jobRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/parameters', require('./routes/parameterRoutes'));
app.use('/api/parameter-groups', require('./routes/parameterGroupRoutes'));
app.use('/api/sample-transfers', require('./routes/sampleTransferRoutes'));
app.use('/api/bug-reports', require('./routes/bugReportRoutes'));
app.use('/api/data-settings', require('./routes/dataSettingsRoutes'));
app.use('/api/test-methods', require('./routes/testMethodRoutes'));
app.use('/api/units', require('./routes/unitRoutes'));
app.use('/api/export', require('./routes/exportRoutes'));
app.use('/api/logs', require('./routes/logRoutes'));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB Atlas');
    // Initialize MongoDB logging transport now that DB is connected
    initMongoTransport();
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      // Drop legacy unique index on sampleSerial if it exists (allows retests to share serial)
      mongoose.connection.db.collection('jobs').dropIndex('sampleSerial_1').catch(() => {});
    });
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Global error handlers
process.on('unhandledRejection', (reason) => {
  logError('UNHANDLED_REJECTION', {
    message: `Unhandled Promise Rejection: ${reason?.message || reason}`,
    error: {
      name: reason?.name || 'UnhandledRejection',
      message: reason?.message || String(reason),
      stack: reason?.stack
    }
  });
});

process.on('uncaughtException', (err) => {
  logError('UNCAUGHT_EXCEPTION', {
    message: `Uncaught Exception: ${err.message}`,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack
    }
  });
  // Give logger time to flush, then exit
  setTimeout(() => process.exit(1), 1000);
});

module.exports = app;
