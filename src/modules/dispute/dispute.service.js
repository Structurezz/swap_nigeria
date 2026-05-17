const DisputeRoom    = require('../../models/DisputeRoom');
const DisputeMessage = require('../../models/DisputeMessage');
const Swap           = require('../../models/Swap');
const User           = require('../../models/User');
const Payment        = require('../../models/Payment');
const Listing        = require('../../models/Listing');
const { getAriaResponse, getAriaStageAnnouncement, detectAdvanceTrigger } = require('../../utils/gemini');
const { getIo } = require('../../socket');

const STAGE_ORDER = ['opening', 'evidence', 'deliberation', 'ruling', 'closed'];

const emitToRoom = (roomId, event, data) => {
  const io = getIo();
  if (io) io.to(`dispute:${roomId}`).emit(event, data);
};

// ── Settle escrow and update wallets based on ruling decision ─────────────────
// mappedDecision uses initiator/receiver terms (already mapped from ARIA's claimant/respondent).
// Called after the DisputeRoom and Swap documents have been updated.
const _settleEscrow = async (swap) => {
  const decision = swap.disputeDecision; // stored on swap before calling this
  if (!swap.escrowActive || !decision) return;

  const depositKobo = swap.escrowDepositKobo || 0;
  if (depositKobo === 0) return;

  const feeKobo    = Math.round(depositKobo * 0.02);
  const refundKobo = depositKobo - feeKobo;
  const swapId     = swap._id;
  const paymentDocs = [];

  const credit = async (userId, amountKobo, metaType) => {
    if (amountKobo <= 0) return;
    await User.findByIdAndUpdate(userId, { $inc: { walletBalance: amountKobo } });
    paymentDocs.push({
      userId, swapId,
      amountKobo,
      paymentType: 'escrow',
      status:      'refunded',
      meta:        { type: metaType, decision },
    });
  };

  switch (decision) {
    // ── Both get their own deposit back (minus 2% fee each) ──────────────────
    case 'mutual_release':
    case 'split': {
      if (swap.initiatorDepositPaid) await credit(swap.initiatorId, refundKobo, 'dispute_refund');
      if (swap.receiverDepositPaid)  await credit(swap.receiverId,  refundKobo, 'dispute_refund');
      // Refund top-up to whoever paid it
      if (swap.topUpPaid && swap.topUpAmountKobo > 0 && swap.topUpPayerRole !== 'none') {
        const payerId = swap.topUpPayerRole === 'initiator' ? swap.initiatorId : swap.receiverId;
        await credit(payerId, swap.topUpAmountKobo, 'dispute_topup_refunded');
      }
      break;
    }

    // ── Initiator wins: gets both deposits back minus fees ───────────────────
    case 'compensate_initiator': {
      const won = (swap.initiatorDepositPaid ? refundKobo : 0)
                + (swap.receiverDepositPaid  ? refundKobo : 0);
      await credit(swap.initiatorId, won, 'dispute_compensation_won');
      // Winner also gets the top-up regardless of who paid it
      if (swap.topUpPaid && swap.topUpAmountKobo > 0) {
        await credit(swap.initiatorId, swap.topUpAmountKobo, 'dispute_topup_to_winner');
      }
      break;
    }

    // ── Receiver wins: gets both deposits back minus fees ────────────────────
    case 'compensate_receiver': {
      const won = (swap.receiverDepositPaid  ? refundKobo : 0)
                + (swap.initiatorDepositPaid ? refundKobo : 0);
      await credit(swap.receiverId, won, 'dispute_compensation_won');
      if (swap.topUpPaid && swap.topUpAmountKobo > 0) {
        await credit(swap.receiverId, swap.topUpAmountKobo, 'dispute_topup_to_winner');
      }
      break;
    }

    // ── Initiator penalised: forfeits deposit; receiver gets own deposit back ─
    case 'penalty_initiator': {
      if (swap.receiverDepositPaid) await credit(swap.receiverId, refundKobo, 'dispute_innocent_refund');
      // If initiator paid top-up (bad actor), it also goes to receiver
      if (swap.topUpPaid && swap.topUpAmountKobo > 0) {
        await credit(swap.receiverId, swap.topUpAmountKobo,
          swap.topUpPayerRole === 'initiator' ? 'dispute_topup_to_innocent' : 'dispute_topup_refunded');
      }
      break;
    }

    // ── Receiver penalised: forfeits deposit; initiator gets own deposit back ─
    case 'penalty_receiver': {
      if (swap.initiatorDepositPaid) await credit(swap.initiatorId, refundKobo, 'dispute_innocent_refund');
      if (swap.topUpPaid && swap.topUpAmountKobo > 0) {
        await credit(swap.initiatorId, swap.topUpAmountKobo,
          swap.topUpPayerRole === 'receiver' ? 'dispute_topup_to_innocent' : 'dispute_topup_refunded');
      }
      break;
    }

    default:
      break;
  }

  if (paymentDocs.length) await Payment.insertMany(paymentDocs);

  // Update listing statuses based on outcome
  const swapCompleted = ['compensate_initiator', 'compensate_receiver'].includes(decision);
  if (swapCompleted) {
    if (swap.initiatorListing) await Listing.findByIdAndUpdate(swap.initiatorListing, { status: 'swapped' });
    if (swap.receiverListing)  await Listing.findByIdAndUpdate(swap.receiverListing,  { status: 'swapped' });
  } else {
    // Swap voided — return listings to active so parties can re-list
    if (swap.initiatorListing) await Listing.findByIdAndUpdate(swap.initiatorListing, { status: 'active' });
    if (swap.receiverListing)  await Listing.findByIdAndUpdate(swap.receiverListing,  { status: 'active' });
  }
};

// ── Stage completion guards — service-level validation for ARIA directives ─────
const isStageComplete = (stage, messages, room) => {
  const partyMsgs = messages.filter(m => !['system', 'bot'].includes(m.senderRole));

  const claimantSpoke = partyMsgs.some(m => {
    const sid = m.senderId?._id?.toString() || m.senderId?.toString();
    return sid === room.claimantId?.toString();
  });
  const respondentSpoke = partyMsgs.some(m => {
    const sid = m.senderId?._id?.toString() || m.senderId?.toString();
    return sid === room.respondentId?.toString();
  });

  if (stage === 'opening')  return claimantSpoke && respondentSpoke;
  if (stage === 'evidence') return partyMsgs.length >= 4 && claimantSpoke && respondentSpoke;
  return false;
};

// ── Internal: advance stage without triggering a new ARIA announcement ─────────
// Used when ARIA itself already spoke and included the advance directive.
const _advanceStage = async (roomId, currentStage) => {
  const idx = STAGE_ORDER.indexOf(currentStage);
  if (idx === -1 || idx >= STAGE_ORDER.length - 2) return null;

  const nextStage = STAGE_ORDER[idx + 1];
  await DisputeRoom.findByIdAndUpdate(roomId, { stage: nextStage });

  const systemMsg = await DisputeMessage.create({
    roomId,
    senderRole:  'system',
    senderName:  'System',
    content:     `Stage advanced to: ${nextStage.toUpperCase()}`,
    messageType: 'system',
  });
  emitToRoom(roomId, 'dispute:message', systemMsg.toJSON());
  emitToRoom(roomId, 'dispute:stage_changed', { stage: nextStage });

  return nextStage;
};

// ── Internal: map ARIA's claimant/respondent language to initiator/receiver ────
const _mapAriaDecision = (decision, room) => {
  const claimantIsInitiator = room.claimantId.toString() === room.initiatorId.toString();
  const map = {
    compensate_claimant:   claimantIsInitiator ? 'compensate_initiator' : 'compensate_receiver',
    compensate_respondent: claimantIsInitiator ? 'compensate_receiver'  : 'compensate_initiator',
    penalty_claimant:      claimantIsInitiator ? 'penalty_initiator'    : 'penalty_receiver',
    penalty_respondent:    claimantIsInitiator ? 'penalty_receiver'     : 'penalty_initiator',
    split:                 'split',
    mutual_release:        'mutual_release',
  };
  return map[decision] || 'mutual_release';
};

// ── Internal: execute an ARIA-issued ruling, settle escrow, update wallets ─────
const _executeAriaRuling = async (room, rulingData) => {
  if (!rulingData?.decision) return;

  const mappedDecision = _mapAriaDecision(rulingData.decision, room);

  const claimantIsInitiator = room.claimantId.toString() === room.initiatorId.toString();
  const isCompensation      = ['compensate_initiator', 'compensate_receiver'].includes(mappedDecision);
  const compensationRecip   =
    mappedDecision === 'compensate_initiator' ? 'initiator'
    : mappedDecision === 'compensate_receiver' ? 'receiver'
    : 'none';

  const escrowKobo       = room.swapSnapshot?.escrowDepositKobo || 0;
  const compensationKobo = isCompensation ? escrowKobo : 0;

  const rulingRecord = {
    decision:               mappedDecision,
    penaltyAmountKobo:      0,
    compensationAmountKobo: compensationKobo,
    compensationRecipient:  compensationRecip,
    adminNote:              rulingData.adminNote || 'Ruling issued by ARIA AI judge.',
    issuedBy:               null,
    issuedAt:               new Date(),
    ariaFormattedDecision:  rulingData.decision,
  };

  const swapStatus = ['mutual_release', 'split'].includes(mappedDecision) ? 'cancelled' : 'completed';

  // Update room and swap atomically (best-effort — no transaction needed here)
  await DisputeRoom.findByIdAndUpdate(room._id, {
    ruling: rulingRecord,
    stage:  'closed',
    status: 'resolved',
  });

  // Store the decision on swap so _settleEscrow can read it
  const swap = await Swap.findByIdAndUpdate(
    room.swapId,
    {
      status:              swapStatus,
      disputeDecision:     mappedDecision,
      disputeAdminNote:    rulingData.adminNote,
      disputeResolvedAt:   new Date(),
      escrowReleasedAt:    new Date(),
    },
    { new: true },
  ).populate('initiatorListing', '_id').populate('receiverListing', '_id');

  emitToRoom(room._id.toString(), 'dispute:ruled', {
    roomId:   room._id,
    decision: mappedDecision,
    stage:    'closed',
    ruling:   rulingRecord,
  });

  // Settle escrow — credit wallets, record Payment docs, update listing statuses
  if (swap) {
    await _settleEscrow(swap);
  }
};

// ── Internal: trigger ARIA deliberation + auto-ruling after a delay ─────────────
// Called after stage advances to deliberation (via ARIA directive or admin).
const _triggerAriaDeliberation = async (roomId) => {
  try {
    const room = await DisputeRoom.findById(roomId);
    if (!room || room.status !== 'active' || room.stage !== 'deliberation') return;

    const allMessages = await DisputeMessage.find({ roomId }).sort({ createdAt: 1 });
    const { text: ariaContent, directives } = await getAriaStageAnnouncement(room, 'deliberation', allMessages);

    const ariaMsg = await DisputeMessage.create({
      roomId,
      senderRole:  'bot',
      senderName:  'ARIA',
      content:     ariaContent,
      messageType: 'text',
    });
    emitToRoom(roomId, 'dispute:message', ariaMsg.toJSON());

    if (directives.ruling) {
      await _executeAriaRuling(room, directives.ruling);
    }
  } catch (err) {
    console.error('ARIA deliberation error:', err.message);
  }
};

// ── Open a room (called automatically when dispute is raised) ──────────────────
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

  const [claimant, respondent] = await Promise.all([
    User.findById(claimantId).select('fullName'),
    User.findById(respondentId).select('fullName'),
  ]);

  const claimantIsInitiator = claimantId.toString() === swap.initiatorId._id.toString();

  const swapSnapshot = {
    // Parties
    claimantName:          claimant?.fullName   || 'Claimant',
    respondentName:        respondent?.fullName || 'Respondent',
    claimantIsInitiator,

    // Listings
    initiatorListingTitle: swap.initiatorListing?.title,
    receiverListingTitle:  swap.receiverListing?.title,

    // Financials
    agreedValue:           swap.agreedValue,
    escrowDepositKobo:     swap.escrowDepositKobo,
    escrowActive:          swap.escrowActive,
    topUpAmountKobo:       swap.topUpAmountKobo || 0,
    topUpPayerRole:        swap.topUpPayerRole,

    // Dispute
    disputeReason:         swap.disputeReason,
    disputeRaisedAt:       swap.updatedAt,
    swapType:              swap.swapType,

    // Full timeline — key for ARIA evidence screening
    proposedAt:            swap.createdAt,
    escrowActivatedAt:     swap.escrowInitiatedAt,

    // Shipment facts
    initiatorShipped:      swap.initiatorShipped,
    receiverShipped:       swap.receiverShipped,
    initiatorShipment:     swap.initiatorShipment
      ? { providerLabel: swap.initiatorShipment.providerLabel, trackingNumber: swap.initiatorShipment.trackingNumber }
      : null,
    receiverShipment:      swap.receiverShipment
      ? { providerLabel: swap.receiverShipment.providerLabel, trackingNumber: swap.receiverShipment.trackingNumber }
      : null,

    // Delivery addresses (city/state only for privacy)
    initiatorAddressCity:  swap.initiatorAddress?.city,
    initiatorAddressState: swap.initiatorAddress?.state,
    receiverAddressCity:   swap.receiverAddress?.city,
    receiverAddressState:  swap.receiverAddress?.state,

    // Receipt confirmations
    initiatorConfirmed:    swap.initiatorConfirmed,
    receiverConfirmed:     swap.receiverConfirmed,

    // Counsel slots — updated when lawyers are hired
    claimantCounselName:   null,
    respondentCounselName: null,
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

  // System notice
  await DisputeMessage.create({
    roomId:      room._id,
    senderRole:  'system',
    senderName:  'System',
    content:     `⚖️ Dispute Room opened for Swap #${swapId.toString().slice(-8).toUpperCase()}. ARIA AI judge is presiding.`,
    messageType: 'system',
  });

  // ARIA opening statement
  const { text: ariaContent } = await getAriaResponse(room, [], 'opening');
  await DisputeMessage.create({
    roomId:      room._id,
    senderRole:  'bot',
    senderName:  'ARIA',
    content:     ariaContent,
    messageType: 'text',
  });

  return room;
};

// ── Get room by swapId ─────────────────────────────────────────────────────────
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

// ── Get all dispute rooms (admin list) ─────────────────────────────────────────
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
    const uid = userId.toString();
    if (uid === room.claimantCounselId?.toString())   senderRole = 'counsel_claimant';
    else if (uid === room.respondentCounselId?.toString()) senderRole = 'counsel_respondent';
    else if (room.initiatorId.toString() === uid)     senderRole = 'initiator';
    else if (room.receiverId.toString() === uid)      senderRole = 'receiver';
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

  if (sender.isAdmin && !room.adminId) {
    await DisputeRoom.findByIdAndUpdate(roomId, { adminId: userId });
  }

  // ARIA responds after a natural 1.8s delay — non-blocking
  setTimeout(async () => {
    try {
      // Re-fetch room so we have the latest stage (may have changed)
      const freshRoom = await DisputeRoom.findById(roomId);
      if (!freshRoom || freshRoom.status !== 'active') return;

      const allMessages = await DisputeMessage.find({ roomId: room._id }).sort({ createdAt: 1 });
      const { text: ariaContent, directives } = await getAriaResponse(freshRoom, allMessages, freshRoom.stage);

      const ariaMsg = await DisputeMessage.create({
        roomId:      room._id,
        senderRole:  'bot',
        senderName:  'ARIA',
        content:     ariaContent,
        messageType: 'text',
      });
      emitToRoom(roomId, 'dispute:message', ariaMsg.toJSON());

      // ── ARIA autonomously advances stage ────────────────────────────────────
      // Two paths:
      //   1. Explicit user request ("move on", "proceed", etc.) → bypass completion guard
      //   2. ARIA tag present + completion guard passes           → autonomous advance
      const blockedStages = ['deliberation', 'ruling', 'closed'];
      if (!blockedStages.includes(freshRoom.stage)) {
        const userExplicitAdvance = detectAdvanceTrigger(allMessages);
        const ariaAdvance         = directives.advanceStage && isStageComplete(freshRoom.stage, allMessages, freshRoom);

        if (userExplicitAdvance || ariaAdvance) {
          const nextStage = await _advanceStage(roomId, freshRoom.stage);
          if (nextStage === 'deliberation') {
            setTimeout(() => _triggerAriaDeliberation(roomId), 8000);
          }
        }
      }

      // ── ARIA issues ruling directly (from deliberation stage message) ───────
      if (directives.ruling && freshRoom.stage === 'deliberation') {
        await _executeAriaRuling(freshRoom, directives.ruling);
      }
    } catch (err) {
      console.error('ARIA response error:', err.message);
    }
  }, 1800);

  return populated.toJSON();
};

// ── Advance stage (admin override — still supported) ──────────────────────────
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

  // For deliberation: ARIA delivers analysis + issues ruling autonomously
  if (nextStage === 'deliberation') {
    setTimeout(() => _triggerAriaDeliberation(roomId), 3000);
  } else {
    // For other stages: ARIA delivers stage announcement
    setTimeout(async () => {
      try {
        const allMessages = await DisputeMessage.find({ roomId }).sort({ createdAt: 1 });
        const { text: ariaContent, directives } = await getAriaStageAnnouncement(updatedRoom, nextStage, allMessages);

        const ariaMsg = await DisputeMessage.create({
          roomId,
          senderRole:  'bot',
          senderName:  'ARIA',
          content:     ariaContent,
          messageType: 'text',
        });
        emitToRoom(roomId, 'dispute:message', ariaMsg.toJSON());

        // Handle any ruling directive from the announcement (fallback path)
        if (directives.ruling) {
          await _executeAriaRuling(updatedRoom, directives.ruling);
        }
      } catch (err) {
        console.error('ARIA stage announcement error:', err.message);
      }
    }, 1000);
  }

  return { stage: nextStage };
};

// ── Issue ruling (admin override — only if ARIA hasn't already ruled) ──────────
const issueRuling = async (roomId, adminId, rulingData) => {
  const { decision, penaltyAmountKobo, compensationAmountKobo, compensationRecipient, adminNote } = rulingData;

  const room = await DisputeRoom.findById(roomId);
  if (!room) throw Object.assign(new Error('Room not found'), { status: 404 });
  if (room.status === 'resolved') throw Object.assign(new Error('This case has already been ruled on by ARIA'), { status: 400 });
  if (!['deliberation', 'ruling'].includes(room.stage)) {
    throw Object.assign(new Error('Room must be in deliberation or ruling stage'), { status: 400 });
  }

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

  const rulingContent = [
    `**ADMINISTRATOR RULING — Case #${room.swapId.toString().slice(-8).toUpperCase()}**`,
    `**Decision:** ${DECISION_LABELS[decision]}`,
    compensationAmountKobo > 0 ? `**Compensation:** ₦${(compensationAmountKobo / 100).toLocaleString()} → ${compensationRecipient}` : null,
    penaltyAmountKobo > 0      ? `**Penalty:** ₦${(penaltyAmountKobo / 100).toLocaleString()}` : null,
    `**Note:** ${adminNote}`,
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
      const updatedRoom = await DisputeRoom.findById(roomId);
      const allMessages = await DisputeMessage.find({ roomId }).sort({ createdAt: 1 });
      const { text: ariaContent } = await getAriaResponse(updatedRoom, allMessages, 'ruling');
      const ariaMsg = await DisputeMessage.create({
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

  const swapStatus = ['mutual_release', 'split'].includes(decision) ? 'cancelled' : 'completed';

  const swap = await Swap.findByIdAndUpdate(
    room.swapId,
    {
      status:            swapStatus,
      disputeDecision:   decision,
      disputeAdminNote:  adminNote,
      disputeResolvedBy: adminId,
      disputeResolvedAt: new Date(),
      escrowReleasedAt:  new Date(),
    },
    { new: true },
  ).populate('initiatorListing', '_id').populate('receiverListing', '_id');

  // Settle escrow — credit wallets and record Payment docs
  if (swap) {
    await _settleEscrow(swap);
  }

  return rulingRecord;
};

// ── Find available legal practitioners ────────────────────────────────────────
const findLawyers = async ({ specialization, maxFeeKobo, page = 1, limit = 20 } = {}) => {
  const filter = { isLegalPractitioner: true };
  if (specialization) filter.legalSpecialization = new RegExp(specialization, 'i');
  if (maxFeeKobo)     filter.legalFeePerCaseKobo = { $lte: maxFeeKobo };

  const skip = (page - 1) * limit;
  const [lawyers, total] = await Promise.all([
    User.find(filter)
      .select('fullName avatarUrl locationState legalBio legalSpecialization legalBarNumber legalFeePerCaseKobo legalCasesTotal legalCasesWon ratingAvg ratingCount')
      .sort({ legalCasesWon: -1, ratingAvg: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  return {
    lawyers: lawyers.map(l => l.toJSON()),
    total,
    page,
    pages: Math.ceil(total / limit),
  };
};

// ── Party requests a lawyer to represent them ─────────────────────────────────
const requestCounsel = async (roomId, requesterId, counselId, proposedFeeKobo) => {
  const room    = await DisputeRoom.findById(roomId);
  if (!room) throw Object.assign(new Error('Room not found'), { status: 404 });
  if (room.status !== 'active') throw Object.assign(new Error('Room is closed'), { status: 400 });

  const counsel = await User.findById(counselId).select('fullName isLegalPractitioner');
  if (!counsel?.isLegalPractitioner) throw Object.assign(new Error('User is not a registered legal practitioner'), { status: 400 });

  // Determine which side the requester is on
  const claimantId   = room.claimantId.toString();
  const respondentId = room.respondentId.toString();
  let side;
  if (requesterId === claimantId)   side = 'claimant';
  else if (requesterId === respondentId) side = 'respondent';
  else throw Object.assign(new Error('You are not a party to this dispute'), { status: 403 });

  // Check no active counsel already
  const existingAccepted = room.counselRequests.find(r => r.side === side && r.status === 'accepted');
  if (existingAccepted) throw Object.assign(new Error(`You already have counsel on your side`), { status: 409 });

  room.counselRequests.push({
    requesterId,
    counselId,
    side,
    status:        'pending',
    agreedFeeKobo: proposedFeeKobo || 0,
    requestedAt:   new Date(),
  });
  await room.save();

  // Post system message
  const sysMsg = await DisputeMessage.create({
    roomId,
    senderRole:  'system',
    senderName:  'System',
    content:     `⚖️ ${side === 'claimant' ? room.swapSnapshot.claimantName : room.swapSnapshot.respondentName} has requested legal counsel (${counsel.fullName}). Awaiting acceptance.`,
    messageType: 'system',
  });
  emitToRoom(roomId, 'dispute:message', sysMsg.toJSON());
  emitToRoom(roomId, 'dispute:counsel_requested', { side, counselName: counsel.fullName });

  return room.toJSON();
};

// ── Lawyer accepts or declines a counsel request ──────────────────────────────
const respondToCounselRequest = async (roomId, counselId, requestId, accept, agreedFeeKobo) => {
  const room = await DisputeRoom.findById(roomId)
    .populate('claimantId',  'fullName')
    .populate('respondentId','fullName');
  if (!room) throw Object.assign(new Error('Room not found'), { status: 404 });

  const req = room.counselRequests.id(requestId);
  if (!req) throw Object.assign(new Error('Request not found'), { status: 404 });
  if (req.counselId.toString() !== counselId) throw Object.assign(new Error('Not your request'), { status: 403 });
  if (req.status !== 'pending') throw Object.assign(new Error('Request already responded to'), { status: 409 });

  const counsel = await User.findById(counselId).select('fullName walletBalance');

  if (!accept) {
    req.status      = 'declined';
    req.respondedAt = new Date();
    await room.save();

    const sysMsg = await DisputeMessage.create({
      roomId,
      senderRole: 'system', senderName: 'System',
      content:    `⚖️ ${counsel.fullName} has declined the counsel request.`,
      messageType:'system',
    });
    emitToRoom(roomId, 'dispute:message', sysMsg.toJSON());
    return room.toJSON();
  }

  // Accept — deduct fee from requester's wallet and credit counsel
  const finalFee = agreedFeeKobo || req.agreedFeeKobo || 0;
  if (finalFee > 0) {
    const requester = await User.findByIdAndUpdate(
      req.requesterId,
      { $inc: { walletBalance: -finalFee } },
      { new: true },
    );
    if (!requester || requester.walletBalance < 0) {
      // Rollback
      await User.findByIdAndUpdate(req.requesterId, { $inc: { walletBalance: finalFee } });
      throw Object.assign(new Error('Insufficient Barter Credits to pay counsel fee'), { status: 400 });
    }
    await User.findByIdAndUpdate(counselId, { $inc: { walletBalance: finalFee } });
    await Payment.insertMany([
      { userId: req.requesterId, swapId: room.swapId, amountKobo: finalFee, paymentType: 'fee', status: 'success', meta: { type: 'counsel_fee', counselId, side: req.side } },
      { userId: counselId, swapId: room.swapId, amountKobo: finalFee, paymentType: 'fee', status: 'success', meta: { type: 'counsel_fee_received', side: req.side } },
    ]);
  }

  // Update request + room
  req.status        = 'accepted';
  req.agreedFeeKobo = finalFee;
  req.respondedAt   = new Date();

  const fieldPrefix = req.side === 'claimant' ? 'claimant' : 'respondent';
  room[`${fieldPrefix}CounselId`]        = counselId;
  room[`${fieldPrefix}CounselFeeKobo`]   = finalFee;
  room.tier = 'legal';

  // Update snapshot with counsel name
  if (!room.swapSnapshot) room.swapSnapshot = {};
  room.swapSnapshot[`${fieldPrefix}CounselName`] = counsel.fullName;
  room.markModified('swapSnapshot');

  await room.save();
  await User.findByIdAndUpdate(counselId, { $inc: { legalCasesTotal: 1 } });

  // Announce counsel entry to the court
  const entryMsg = await DisputeMessage.create({
    roomId,
    senderId:    counselId,
    senderRole:  `counsel_${req.side}`,
    senderName:  counsel.fullName,
    content:     `I am ${counsel.fullName}, entering appearance as Counsel for the ${req.side === 'claimant' ? 'Claimant' : 'Respondent'} in Case #${room.swapId.toString().slice(-8).toUpperCase()}. I have reviewed the case file and am prepared to proceed.`,
    messageType: 'text',
  });
  emitToRoom(roomId, 'dispute:message', entryMsg.toJSON());
  emitToRoom(roomId, 'dispute:counsel_joined', { side: req.side, counselName: counsel.fullName, tier: 'legal' });

  return room.toJSON();
};

// ── Update legalCasesWon when a ruling is issued ──────────────────────────────
// Call this after _executeAriaRuling or issueRuling when counsel was present
const _creditCounselWin = async (room, winningSide) => {
  const counselId = winningSide === 'claimant' ? room.claimantCounselId : room.respondentCounselId;
  if (counselId) {
    await User.findByIdAndUpdate(counselId, { $inc: { legalCasesWon: 1 } });
  }
};

module.exports = { openRoom, getRoom, listRooms, sendMessage, advanceStage, issueRuling, findLawyers, requestCounsel, respondToCounselRequest };
