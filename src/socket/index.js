const { Server } = require('socket.io');
const { verifyAccessToken } = require('../utils/jwt');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

let io;

const initSocket = (httpServer) => {
  let config;
  try {
    config = require('../config/env');
  } catch (e) {
    config = { FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173' };
  }

  const ALLOWED_ORIGINS = [
    'https://swapnigeria.netlify.app',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
    ...(config.FRONTEND_URL ? [config.FRONTEND_URL] : []),
  ];

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        callback(new Error(`CORS: origin ${origin} not allowed`));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
  });

  // Auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Authentication error: No token'));
    }
    try {
      const payload = verifyAccessToken(token);
      socket.userId = payload.id;
      socket.userPhone = payload.phone;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.userId}`);

    // Join user's personal room
    socket.join(socket.userId);

    // Join conversation room
    socket.on('conversation:join', (conversationId) => {
      socket.join(`conv:${conversationId}`);
    });

    socket.on('conversation:leave', (conversationId) => {
      socket.leave(`conv:${conversationId}`);
    });

    // Send message via socket
    socket.on('message:send', async (data, callback) => {
      try {
        const { conversationId, content, msgType = 'text' } = data;

        // Verify participant
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          return callback?.({ error: 'Conversation not found' });
        }

        const isParticipant =
          conversation.participantA.toString() === socket.userId ||
          conversation.participantB.toString() === socket.userId;

        if (!isParticipant) {
          return callback?.({ error: 'Not a participant' });
        }

        // Create message
        const message = await Message.create({
          conversationId,
          senderId: socket.userId,
          content,
          msgType,
        });

        // Determine other participant
        const otherParticipantId =
          conversation.participantA.toString() === socket.userId
            ? conversation.participantB.toString()
            : conversation.participantA.toString();

        const isParticipantA = conversation.participantA.toString() === socket.userId;

        // Update conversation
        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: content,
          lastMsgAt: new Date(),
          $inc: isParticipantA ? { unreadB: 1 } : { unreadA: 1 },
        });

        const populatedMessage = await Message.findById(message._id).populate(
          'senderId',
          'fullName avatarUrl'
        );

        // Emit to conversation room
        io.to(`conv:${conversationId}`).emit('message:new', populatedMessage);

        // Notify other user
        io.to(otherParticipantId).emit('conversation:updated', {
          conversationId,
          lastMessage: content,
          lastMsgAt: new Date(),
        });

        callback?.({ data: populatedMessage });
      } catch (err) {
        console.error('Socket message:send error:', err);
        callback?.({ error: 'Failed to send message' });
      }
    });

    // Mark messages as read
    socket.on('message:read', async (data) => {
      try {
        const { conversationId } = data;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return;

        const isParticipantA = conversation.participantA.toString() === socket.userId;

        await Message.updateMany(
          {
            conversationId,
            senderId: { $ne: socket.userId },
            isRead: false,
          },
          { $set: { isRead: true } }
        );

        await Conversation.findByIdAndUpdate(conversationId, {
          $set: isParticipantA ? { unreadA: 0 } : { unreadB: 0 },
        });

        // Notify sender their messages were read
        const otherParticipantId = isParticipantA
          ? conversation.participantB.toString()
          : conversation.participantA.toString();

        io.to(otherParticipantId).emit('message:read', { conversationId });
      } catch (err) {
        console.error('Socket message:read error:', err);
      }
    });

    // Typing indicators
    socket.on('typing:start', (data) => {
      const { conversationId } = data;
      socket.to(`conv:${conversationId}`).emit('typing:start', {
        conversationId,
        userId: socket.userId,
      });
    });

    socket.on('typing:stop', (data) => {
      const { conversationId } = data;
      socket.to(`conv:${conversationId}`).emit('typing:stop', {
        conversationId,
        userId: socket.userId,
      });
    });

    socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected: ${socket.userId} (${reason})`);
    });
  });

  return io;
};

// Emit swap events to participants
const emitSwapEvent = (event, userIds, data) => {
  if (!io) return;
  userIds.forEach((userId) => {
    io.to(userId.toString()).emit(event, data);
  });
};

const getIo = () => io;

module.exports = { initSocket, emitSwapEvent, getIo };
