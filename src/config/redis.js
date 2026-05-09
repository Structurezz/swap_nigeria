const Redis = require('ioredis');

let config;
try {
  config = require('./env');
} catch (e) {
  config = { REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379' };
}

const client = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 5) {
      console.error('Redis: max retries reached');
      return null;
    }
    return Math.min(times * 200, 2000);
  },
  lazyConnect: false,
});

client.on('connect', () => {
  console.log('Redis connected');
});

client.on('error', (err) => {
  console.error('Redis error:', err.message);
});

client.on('reconnecting', () => {
  console.warn('Redis reconnecting...');
});

module.exports = client;
