const mongoose = require('mongoose');

const errorHandler = (err, req, res, next) => {
  console.error('[Error]', err.name, err.message);

  // Mongoose ValidationError
  if (err instanceof mongoose.Error.ValidationError) {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ error: messages.join(', ') });
  }

  // Mongoose CastError (invalid ObjectId)
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: `Invalid ${err.path}: ${err.value}` });
  }

  // MongoDB duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue ? err.keyValue[field] : '';
    return res.status(409).json({ error: `${field} '${value}' already exists` });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired' });
  }

  // Custom app errors with status
  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }

  // Generic server error
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  return res.status(500).json({ error: message });
};

// Helper to create app errors with status codes
const createError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

module.exports = { errorHandler, createError };
