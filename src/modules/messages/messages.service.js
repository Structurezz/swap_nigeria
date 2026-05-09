const Conversation = require('../../models/Conversation');
const Message = require('../../models/Message');
const mongoose = require('mongoose');

const getOrCreateConversation = async (userAId, userBId, swapId) => {
  const [a, b] = [userAId, userBId].sort();

  let conv = await Conversation.findOne({
    participantA: a,
    participantB: b,
    ...(swapId ? { swapId } : {}),
  });

  if (!conv) {
    conv = await Conversation.create({
      participantA: a,
      participantB: b,
      swapId: swapId || null,
    });
  }

  return conv;
};

const getUserConversations = async (userId) => {
  const convs = await Conversation.find({
    $or: [{ participantA: userId }, { participantB: userId }],
  })
    .populate('participantA', 'fullName avatarUrl')
    .populate('participantB', 'fullName avatarUrl')
    .populate('swapId', 'status')
    .sort({ lastMsgAt: -1 });

  return convs.map(c => {
    const obj = c.toJSON();
    // Add unread count for this user
    const isA = c.participantA._id.toString() === userId;
    obj.unread = isA ? c.unreadA : c.unreadB;
    return obj;
  });
};

const getConversation = async (conversationId, userId) => {
  const conv = await Conversation.findById(conversationId)
    .populate('participantA', 'fullName avatarUrl verification ratingAvg')
    .populate('participantB', 'fullName avatarUrl verification ratingAvg')
    .populate('swapId');

  if (!conv) throw Object.assign(new Error('Conversation not found'), { status: 404 });

  const isParticipant =
    conv.participantA._id.toString() === userId ||
    conv.participantB._id.toString() === userId;

  if (!isParticipant) throw Object.assign(new Error('Not a participant'), { status: 403 });

  return conv.toJSON();
};

const getMessages = async (conversationId, userId, page = 1, limit = 50) => {
  const conv = await Conversation.findById(conversationId);
  if (!conv) throw Object.assign(new Error('Conversation not found'), { status: 404 });

  const isParticipant =
    conv.participantA.toString() === userId ||
    conv.participantB.toString() === userId;
  if (!isParticipant) throw Object.assign(new Error('Not a participant'), { status: 403 });

  const messages = await Message.find({ conversationId })
    .populate('senderId', 'fullName avatarUrl')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  // Mark as read
  await Message.updateMany(
    { conversationId, senderId: { $ne: userId }, isRead: false },
    { $set: { isRead: true } }
  );

  const isA = conv.participantA.toString() === userId;
  await Conversation.findByIdAndUpdate(conversationId, {
    $set: isA ? { unreadA: 0 } : { unreadB: 0 },
  });

  return messages.reverse().map(m => m.toJSON());
};

const sendMessage = async (conversationId, senderId, content, msgType = 'text') => {
  const conv = await Conversation.findById(conversationId);
  if (!conv) throw Object.assign(new Error('Conversation not found'), { status: 404 });

  const isParticipant =
    conv.participantA.toString() === senderId ||
    conv.participantB.toString() === senderId;
  if (!isParticipant) throw Object.assign(new Error('Not a participant'), { status: 403 });

  const message = await Message.create({ conversationId, senderId, content, msgType });

  const isA = conv.participantA.toString() === senderId;
  await Conversation.findByIdAndUpdate(conversationId, {
    lastMessage: content,
    lastMsgAt: new Date(),
    $inc: isA ? { unreadB: 1 } : { unreadA: 1 },
  });

  const populated = await Message.findById(message._id).populate('senderId', 'fullName avatarUrl');
  return populated.toJSON();
};

const startConversationWithSwap = async (userId, targetUserId, swapId) => {
  const conv = await getOrCreateConversation(userId, targetUserId, swapId);
  return conv.toJSON();
};

module.exports = { getUserConversations, getConversation, getMessages, sendMessage, startConversationWithSwap };
