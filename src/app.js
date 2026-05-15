require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { errorHandler } = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');

// Register all models upfront so populate() works across all routes
require('./models/User');
require('./models/Category');
require('./models/Listing');
require('./models/Swap');
require('./models/Conversation');
require('./models/Message');
require('./models/Review');
require('./models/Payment');
require('./models/OtpCode');

let config;
try {
  config = require('./config/env');
} catch (e) {
  config = { FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173', NODE_ENV: 'development' };
}

const app = express();

app.use(helmet());
const ALLOWED_ORIGINS = [
  'https://swapnigeria.netlify.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  ...(config.FRONTEND_URL ? [config.FRONTEND_URL] : []),
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
if (config.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}
app.use('/api', generalLimiter);

// Routes
app.use('/api/auth',       require('./modules/auth/auth.routes'));
app.use('/api/categories', require('./modules/categories/categories.routes'));
app.use('/api/users', require('./modules/users/users.routes'));
app.use('/api/listings', require('./modules/listings/listings.routes'));
app.use('/api/matches', require('./modules/matches/matches.routes'));
app.use('/api/swaps', require('./modules/swaps/swaps.routes'));
app.use('/api/messages', require('./modules/messages/messages.routes'));
app.use('/api/reviews', require('./modules/reviews/reviews.routes'));
app.use('/api/payments',       require('./modules/payments/payments.routes'));
app.use('/api/notifications',  require('./modules/notifications/notifications.routes'));
app.use('/api/admin',          require('./modules/admin/admin.routes'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// GridFS file serving
app.get('/api/files/:id', async (req, res, next) => {
  try {
    const mongoose = require('mongoose');
    const { ObjectId } = mongoose.Types;

    let fileId;
    try {
      fileId = new ObjectId(req.params.id);
    } catch {
      return res.status(400).json({ error: 'Invalid file id' });
    }

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'uploads',
    });

    const files = await bucket.find({ _id: fileId }).toArray();
    if (!files.length) return res.status(404).json({ error: 'File not found' });

    res.set('Content-Type', files[0].contentType || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=31536000');
    bucket.openDownloadStream(fileId).pipe(res);
  } catch (err) {
    next(err);
  }
});

app.use(errorHandler);

module.exports = app;
