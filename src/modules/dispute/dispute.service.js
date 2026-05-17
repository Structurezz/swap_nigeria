const DisputeRoom    = require('../../models/DisputeRoom');
const DisputeMessage = require('../../models/DisputeMessage');
const Swap           = require('../../models/Swap');
const User           = require('../../models/User');
const { getAriaResponse, getAriaStageAnnouncement } = require('../../utils/gemini');
const { getIo } = require('../../socket');

const STAGE_ORDER = ['opening', 'evidence', 'deliberation', 'ruling', 'closed'];

const emitToRoom = (roomId, event, data) => {
  const io = getIo();
  if (io) io.to(`dispute:${roomId}`).emit(event, data);
};

// ── Open a room (called automatically when dispute is raised) ─────────────────
const openRoom = async (swapId) => {
  const existing = await DisputeRoom.findOne({ swapId });
  if (existing) return existing;

  const swap = await Swap.findById(swapId)
    .populate('initiatorId',      'fullName avatarUrl phone')
    .populate('receiverId',       'fullName avatarUrl phone')
    .populate('initiatorListing', 'title estimatedValue')
    .populate('receiverListing',  'title estimatedValue');

  if (!swap) throw Object.assign(new Error('Swap not found'), { status: 404 });

  const claimantId   = swap.disputeRaisedBy || swap.initiatorId._id;
  const respondentId = claimantId.toString() === swap.initiatorId._id.toString()
    ? swap.receiverId._id
    : swap.initiatorId._id;

  const claimant   = await User.findById(claimantId).select('fullName');
  const respondent = await User.findById(respondentId).select('fullName');

  const swapSnapshot = {
    claimantName:          claimant?.fullName   || 'Claimant',
    respondentName:        respondent?.fullName || 'Respondent',
    initiatorListingTitle: swap.initiatorListing?.title,
    receiverListingTitle:  swap.receiverListing?.title,
    agreedValue:           swap.agreedValue,
    escrowDepositKobo:     swap.escrowDepositKobo,
    escrowActive:          swap.escrowActive,
    topUpAmountKobo:       swap.topUpAmountKobo,
    disputeReason:         swap.disputeReason,
    disputeRaisedAt:       swap.updatedAt,
    swapType:              swap.swapType,
  };

  const room = await DisputeRoom.create({
    swapId,
    initiatorId:  swap.initiatorId._id,
    receiverId:   swap.receiverId._id,
    claimantId,
    respondentId,
    swapSnapshot,
    stage:  'opening',
    status: 'active',
  });

  // Post system opening message
  await DisputeMessage.create({
    roomId:      room._id,
    senderRole:  'system',
    senderName:  'System',
    content:     `⚖️ Dispute Room opened for Swap #${swapId.toString().slice(-8).toUpperCase()}. An admin will be assigned shortly.`,
    messageType: 'system',
  });

  // ARIA opening statement
  const ariaContent = await getAriaResponse(room, [], 'opening');
  await DisputeMessage.create({
    roomId:      room._id,
    senderRole:  'bot',
    senderName:  'ARIA',
    content:     ariaContent,
    messageType: 'text',
  });

  return room;
};

// ── Get room by swapId ────────────────────────────────────────────────────────
const getRoom = async (swapId) => {
  const room = await DisputeRoom.findOne({ swapId })
    .populate('adminId',      'fullName avatarUrl')
    .populate('initiatorId',  'fullName avatarUrl phone')
    .populate('receiverId',   'fullName avatarUrl phone')
    .populate('claimantId',   'fullName')
    .populate('respondentId', 'fullName')
    .populate('ruling.issuedBy', 'fullName');

  if (!room) return null;

  const messages = await DisputeMessage.find({ roomId: room._id })
    .sort({ createdAt: 1 })
    .populate('senderId', 'fullName avatarUrl');

  return { room: room.toJSON(), messages: messages.map(m => m.toJSON()) };
};

// ── Get all dispute rooms (admin list) ────────────────────────────────────────
const listRooms = async ({ page = 1, limit = 20, status, stage }) => {
  const filter = {};
  if (status) filter.status = status;
  if (stage)  filter.stage  = stage;

  const skip = (page - 1) * limit;
  const [rooms, total] = await Promise.all([
    DisputeRoom.find(filter)
      .populate('swapId',       'status disputeReason')
      .populate('claimantId',   'fullName avatarUrl phone')
      .populate('respondentId', 'fullName avatarUrl phone')
      .populate('adminId',      'fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    DisputeRoom.countDocuments(filter),
  ]);

  return {
    rooms: rooms.map(r => r.toJSON()),
    total,
    page,
    pages: Math.ceil(total / limit),
  };
};

// ── Send a message ─────────────────────────────────────────────────────────────
const sendMessage = async (roomId, userId, content, messageType = 'text') => {
  const room = await DisputeRoom.findById(roomId);
  if (!room) throw Object.assign(new Error('Dispute room not found'), { status: 404 });
  if (room.status !== 'active') throw Object.assign(new Error('This dispute room is closed'), { status: 400 });

  const sender = await User.findById(userId).select('fullName avatarUrl isAdmin');
  if (!sender) throw Object.assign(new Error('User not found'), { status: 404 });

  let senderRole = 'admin';
  if (!sender.isAdmin) {
    if (room.initiatorId.toString() === userId)      senderRole = 'initiator';
    else if (room.receiverId.toString() === userId)  senderRole = 'receiver';
    else throw Object.assign(new Error('Not a participant'), { status: 403 });
  }

  const message = await DisputeMessage.create({
    roomId:      room._id,
    senderId:    userId,
    senderRole,
    senderName:  sender.fullName,
    content,
    messageType,
  });

  const populated = await DisputeMessage.findById(message._id).populate('senderId', 'fullName avatarUrl');
  emitToRoom(roomId, 'dispute:message', populated.toJSON());

  // Assign admin if not yet assigned
  if (sender.isAdmin && !room.adminId) {
    await DisputeRoom.findByIdAndUpdate(roomId, { adminId: userId });
  }

  // Trigger ARIA response (non-blocking, after 1.8s for natural feel)
  setTimeout(async () => {
    try {
      const allMessages = await DisputeMessage.find({ roomId: room._id }).sort({ createdAt: 1 });
      const ariaContent = await getAriaResponse(room, allMessages, room.stage);

      const ariaMsg = await DisputeMessage.create({
        roomId:      room._id,
        senderRole:  'bot',
        senderName:  'ARIA',
        content:     ariaContent,
        messageType: 'text',
      });

      emitToRoom(roomId, 'dispute:message', ariaMsg.toJSON());
    } catch (err) {
      console.error('ARIA response error:', err.message);
    }
  }, 1800);

  return populated.toJSON();
};

// ── Advance stage (admin only) ────────────────────────────────────────────────
const advanceStage = async (roomId, adminId) => {
  const room = await DisputeRoom.findById(roomId);
  if (!room) throw Object.assign(new Error('Room not found'), { status: 404 });
  if (room.status !== 'active') throw Object.assign(new Error('Room is not active'), { status: 400 });

  const currentIndex = STAGE_ORDER.indexOf(room.stage);
  if (currentIndex === -1 || currentIndex >= STAGE_ORDER.length - 2) {
    throw Object.assign(new Error('Already at final stage'), { status: 400 });
  }

  const nextStage = STAGE_ORDER[currentIndex + 1];
  await DisputeRoom.findByIdAndUpdate(roomId, { stage: nextStage, adminId });

  const updatedRoom = await DisputeRoom.findById(roomId);

  const systemMsg = await DisputeMessage.create({
    roomId,
    senderRole:  'system',
    senderName:  'System',
    content:     `Stage advanced to: ${nextStage.toUpperCase()}`,
    messageType: 'system',
  });

  emitToRoom(roomId, 'dispute:message', systemMsg.toJSON());
  emitToRoom(roomId, 'dispute:stage_changed', { stage: nextStage });

  // ARIA stage announcement
  setTimeout(async () => {
    try {
      const ariaContent = await getAriaStageAnnouncement(updatedRoom, nextStage);
      const ariaMsg = await DisputeMessage.create({
        roomId,
        senderRole:  'bot',
        senderName:  'ARIA',
        content:     ariaContent,
        messageType: 'text',
      });
      emitToRoom(roomId, 'dispute:message', ariaMsg.toJSON());
    } catch (err) {
      console.error('ARIA stage announcement error:', err.message);
    }
  }, 1000);

  return { stage: nextStage };
};

// ── Issue ruling (admin only) ─────────────────────────────────────────────────
const issueRuling = async (roomId, adminId, rulingData) => {
  const { decision, penaltyAmountKobo, compensationAmountKobo, compensationRecipient, adminNote } = rulingData;

  const room = await DisputeRoom.findById(roomId);
  if (!room) throw Object.assign(new Error('Room not found'), { status: 404 });
  if (room.stage !== 'ruling') throw Object.assign(new Error('Room must be in ruling stage'), { status: 400 });

  const admin = await User.findById(adminId).select('fullName');

  const DECISION_LABELS = {
    compensate_initiator: 'Award compensation to Initiator',
    compensate_receiver:  'Award compensation to Receiver',
    split:                'Split escrow between both parties',
    mutual_release:       'Mutual release — no penalty',
    penalty_initiator:    'Penalty against Initiator',
    penalty_receiver:     'Penalty against Receiver',
  };

  const rulingRecord = {
    decision,
    penaltyAmountKobo:      penaltyAmountKobo      || 0,
    compensationAmountKobo: compensationAmountKobo || 0,
    compensationRecipient:  compensationRecipient  || 'none',
    adminNote,
    issuedBy:  adminId,
    issuedAt:  new Date(),
  };

  await DisputeRoom.findByIdAndUpdate(roomId, {
    ruling: rulingRecord,
    stage:  'closed',
    status: 'resolved',
    adminId,
  });

  // Post ruling message
  const rulingContent = [
    `**FORMAL RULING — Case #${room.swapId.toString().slice(-8).toUpperCase()}**`,
    `**Decision:** ${DECISION_LABELS[decision]}`,
    compensationAmountKobo > 0 ? `**Compensation:** ₦${(compensationAmountKobo / 100).toLocaleString()} → ${compensationRecipient}` : null,
    penaltyAmountKobo > 0      ? `**Penalty:**       ₦${(penaltyAmountKobo / 100).toLocaleString()}` : null,
    `**Administrator's Note:** ${adminNote}`,
    `\n*Issued by ${admin?.fullName || 'Administrator'} on ${new Date().toLocaleDateString('en-NG')}*`,
  ].filter(Boolean).join('\n');

  const rulingMsg = await DisputeMessage.create({
    roomId,
    senderId:    adminId,
    senderRole:  'admin',
    senderName:  admin?.fullName || 'Administrator',
    content:     rulingContent,
    messageType: 'ruling',
    metadata:    rulingRecord,
  });

  emitToRoom(roomId, 'dispute:message', rulingMsg.toJSON());
  emitToRoom(roomId, 'dispute:ruled', { roomId, decision, stage: 'closed' });

  // ARIA closing statement
  setTimeout(async () => {
    try {
      const updatedRoom  = await DisputeRoom.findById(roomId);
      const allMessages  = await DisputeMessage.find({ roomId }).sort({ createdAt: 1 });
      const ariaContent  = await getAriaResponse(updatedRoom, allMessages, 'ruling');
      const ariaMsg      = await DisputeMessage.create({
        roomId,
        senderRole:  'bot',
        senderName:  'ARIA',
        content:     ariaContent,
        messageType: 'decision',
      });
      emitToRoom(roomId, 'dispute:message', ariaMsg.toJSON());
    } catch (err) {
      console.error('ARIA ruling closing error:', err.message);
    }
  }, 2000);

  // Update the swap status to resolved
  await Swap.findByIdAndUpdate(room.swapId, {
    status:            decision === 'mutual_release' ? 'cancelled' : 'completed',
    disputeAdminNote:  adminNote,
    disputeResolvedBy: adminId,
    disputeResolvedAt: new Date(),
  });

  return rulingRecord;
};

module.exports = { openRoom, getRoom, listRooms, sendMessage, advanceStage, issueRuling };
