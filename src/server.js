require('dotenv').config();
const http = require('http');
const app = require('./app');
const { connectDB } = require('./config/db');
const { initSocket } = require('./socket');

let config;
try {
  config = require('./config/env');
} catch (e) {
  config = { PORT: process.env.PORT || 5000, NODE_ENV: process.env.NODE_ENV || 'development' };
}

const PORT = config.PORT || 5000;

const start = async () => {
  await connectDB();

  const httpServer = http.createServer(app);
  initSocket(httpServer);

  httpServer.listen(PORT, () => {
    console.log(`SwapNaija server running on port ${PORT} [${config.NODE_ENV}]`);
  });

  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    httpServer.close(() => process.exit(0));
  });
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
