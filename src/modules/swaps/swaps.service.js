const Swap = require('../../models/Swap');
const Listing = require('../../models/Listing');
const User = require('../../models/User');
const Payment = require('../../models/Payment');
const { emitSwapEvent } = require('../../socket');
const N = require('../notifications/notifications.service');

// ─── Escrow config ────────────────────────────────────────────────────────────
const ESCROW_PLATFORM_FEE_PCT = 0.02;   // 2% of deposit kept as service fee
const ESCROW_MIN_DEPOSIT_KOBO = 50000;  // minimum ₦500 collateral per party
const ESCROW_DEFAULT_COLLATERAL_PCT = 10; // default 10% of item value

// Calculate escrow amounts for a given deposit
const escrowAmounts = (depositKobo) => {
  const platformFeeKobo = Math.round(depositKobo * ESCROW_PLATFORM_FEE_PCT);
  const refundKobo      = depositKobo - platformFeeKobo;
  return { depositKobo, platformFeeKobo, refundKobo };
};

// Compute deposit from listing values + collateral %
const calcDepositKobo = (initiatorEstimatedValue, receiverEstimatedValue, collateralPercent) => {
  // estimatedValue is stored in Naira — use the higher item as the benchmark
  const maxValueNaira = Math.max(initiatorEstimatedValue || 0, receiverEstimatedValue || 0);
  if (maxValueNaira <= 0) return ESCROW_MIN_DEPOSIT_KOBO; // fallback
  const pct = collateralPercent || ESCROW_DEFAULT_COLLATERAL_PCT;
  const depositNaira = Math.round(maxValueNaira * (pct / 100));
  return Math.max(ESCROW_MIN_DEPOSIT_KOBO, depositNaira * 100); // convert ₦ → kobo
};

// ─── State machine ────────────────────────────────────────────────────────────
const ALLOWED_TRANSITIONS = {
  proposed:  ['accepted', 'cancelled'],
  accepted:  ['in_escrow', 'cancelled', 'disputed'],
  in_escrow: ['shipped', 'disputed', 'cancelled'],
  shipped:   ['completed', 'disputed', 'cancelled'],
};

const canTransition = (from, to) => (ALLOWED_TRANSITIONS[from] || []).includes(to);

// ─── Populate helper ──────────────────────────────────────────────────────────
const populateSwap = (query) =>
  query
    .populate('initiatorId', 'fullName avatarUrl phone ratingAvg verification')
    .populate('receiverId',  'fullName avatarUrl phone ratingAvg verification')
    .populate('initiatorListing', 'title images estimatedValue condition status listingType')
    .populate('receiverListing',  'title images estimatedValue condition status listingType');

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Determine swap type from listings (goods vs service)
const inferSwapType = async (initiatorListingId, receiverListingId) => {
  const [il, rl] = await Promise.all([
    initiatorListingId ? Listing.findById(initiatorListingId).select('listingType') : null,
    receiverListingId  ? Listing.findById(receiverListingId).select('listingType')  : null,
  ]);
  const iType = il?.listingType || 'goods';
  const rType = rl?.listingType || 'goods';
  if (iType === 'goods'    && rType === 'goods')    return 'goods_for_goods';
  if (iType === 'goods'    && rType === 'services') return 'goods_for_service';
  if (iType === 'services' && rType === 'goods')    return 'service_for_goods';
  return 'service_for_service';
};

// Refund a single party's escrow deposit in full (used on cancellation)
const _refundDeposit = async (userId, swapId, amountKobo, reason = 'escrow_cancelled_refund') => {
  await User.findByIdAndUpdate(userId, { $inc: { walletBalance: amountKobo } });
  await Payment.create({
    userId, swapId,
    amountKobo,
    paymentType: 'escrow',
    status: 'refunded',
    meta: { type: reason },
  });
};

// ─── Propose swap ─────────────────────────────────────────────────────────────
const proposeSwap = async (initiatorId, data) => {
  const { receiverId, initiatorListing, receiverListing, proposalNote, agreedValue, topUpAmountKobo, topUpPayerRole, collateralPercent } = data;

  if (initiatorId === receiverId) {
    throw Object.assign(new Error('Cannot propose swap to yourself'), { status: 400 });
  }

  const receiver = await User.findById(receiverId);
  if (!receiver) throw Object.assign(new Error('Receiver not found'), { status: 404 });

  const existing = await Swap.findOne({
    initiatorId, receiverId,
    initiatorListing: initiatorListing || null,
    receiverListing: receiverListing || null,
    status: 'proposed',
  });
  if (existing) throw Object.assign(new Error('Swap already proposed'), { status: 409 });

  const swapType = await inferSwapType(initiatorListing, receiverListing);

  // Fetch listing details: estimated values + swap eligibility threshold
  const [iL, rL] = await Promise.all([
    initiatorListing ? Listing.findById(initiatorListing).select('estimatedValue minSwapValue userId') : null,
    receiverListing  ? Listing.findById(receiverListing).select('estimatedValue minSwapValue userId')  : null,
  ]);

  // Enforce swap eligibility threshold set by the receiver's listing owner
  if (rL?.minSwapValue > 0) {
    const initiatorValue = iL?.estimatedValue || 0;
    if (initiatorValue < rL.minSwapValue) {
      throw Object.assign(
        new Error(`This listing requires your item to be worth at least ₦${rL.minSwapValue.toLocaleString()} to propose a swap`),
        { status: 403 }
      );
    }
  }

  const escrowDepositKobo = calcDepositKobo(
    iL?.estimatedValue,
    rL?.estimatedValue,
    collateralPercent
  );

  const swap = await Swap.create({
    initiatorId, receiverId,
    initiatorListing, receiverListing,
    proposalNote, agreedValue, swapType,
    status: 'proposed',
    collateralPercent: collateralPercent || ESCROW_DEFAULT_COLLATERAL_PCT,
    escrowDepositKobo,
    topUpAmountKobo: topUpAmountKobo || 0,
    topUpPayerRole: topUpPayerRole || 'none',
  });

  const populated = await populateSwap(Swap.findById(swap._id));
  const result = populated.toJSON();
  emitSwapEvent('swap:new', [receiverId], result);
  N.notifySwapProposed(result).catch(() => {});
  return result;
};

// ─── Get single swap ──────────────────────────────────────────────────────────
const getSwap = async (swapId, userId) => {
  const swap = await populateSwap(Swap.findById(swapId));
  if (!swap) throw Object.assign(new Error('Swap not found'), { status: 404 });

  const isParticipant =
    swap.initiatorId._id.toString() === userId ||
    swap.receiverId._id.toString() === userId;
  if (!isParticipant) throw Object.assign(new Error('Not a participant'), { status: 403 });

  return swap.toJSON();
};

// ─── Accept / Cancel ──────────────────────────────────────────────────────────
const respondToSwap = async (swapId, userId, action) => {
  const swap = await Swap.findById(swapId);
  if (!swap) throw Object.assign(new Error('Swap not found'), { status: 404 });

  const isInitiator = swap.initiatorId.toString() === userId;
  const isReceiver  = swap.receiverId.toString()  === userId;
  if (!isInitiator && !isReceiver) throw Object.assign(new Error('Not a participant'), { status: 403 });

  const newStatus = action === 'accept' ? 'accepted' : 'cancelled';
  const prevStatus = swap.status; // capture before mutation

  if (action === 'accept' && !isReceiver) {
    throw Object.assign(new Error('Only the receiver can accept'), { status: 403 });
  }
  if (!canTransition(swap.status, newStatus)) {
    throw Object.assign(new Error(`Cannot transition from ${swap.status} to ${newStatus}`), { status: 400 });
  }

  // If cancelling an escrow swap, refund any deposits already paid
  if (newStatus === 'cancelled') {
    if (swap.initiatorDepositPaid) await _refundDeposit(swap.initiatorId.toString(), swapId, swap.escrowDepositKobo);
    if (swap.receiverDepositPaid)  await _refundDeposit(swap.receiverId.toString(),  swapId, swap.escrowDepositKobo);
    // Refund top-up if already paid
    if (swap.topUpPaid && swap.topUpAmountKobo > 0 && swap.topUpPayerRole !== 'none') {
      const topUpPayerId = swap.topUpPayerRole === 'initiator'
        ? swap.initiatorId.toString()
        : swap.receiverId.toString();
      await User.findByIdAndUpdate(topUpPayerId, { $inc: { walletBalance: swap.topUpAmountKobo } });
      await Payment.create({
        userId: topUpPayerId, swapId,
        amountKobo: swap.topUpAmountKobo,
        paymentType: 'escrow',
        status: 'refunded',
        meta: { type: 'topup_cancelled_refund' },
      });
    }
  }

  swap.status = newStatus;
  await swap.save();

  const populated = await populateSwap(Swap.findById(swap._id));
  const result = populated.toJSON();
  const otherId = isInitiator ? swap.receiverId.toString() : swap.initiatorId.toString();
  emitSwapEvent('swap:updated', [otherId], result);
  if (newStatus === 'accepted') {
    N.notifySwapAccepted(result).catch(() => {});
    if (result.topUpAmountKobo > 0 && result.topUpPayerRole && result.topUpPayerRole !== 'none') {
      N.notifyTopUpRequired(result).catch(() => {});
    }
  }
  if (newStatus === 'cancelled') N.notifySwapCancelled(result, userId, prevStatus === 'proposed').catch(() => {});
  return result;
};

// ─── Set delivery address ─────────────────────────────────────────────────────
const setDeliveryAddress = async (swapId, userId, addressData) => {
  const swap = await Swap.findById(swapId);
  if (!swap) throw Object.assign(new Error('Swap not found'), { status: 404 });

  const isInitiator = swap.initiatorId.toString() === userId;
  const isReceiver  = swap.receiverId.toString()  === userId;
  if (!isInitiator && !isReceiver) throw Object.assign(new Error('Not a participant'), { status: 403 });

  if (!['accepted', 'in_escrow'].includes(swap.status)) {
    throw Object.assign(new Error(`Cannot set address at this stage`), { status: 400 });
  }

  if (isInitiator) {
    swap.initiatorAddress    = addressData;
    swap.initiatorAddressSet = true;
  } else {
    swap.receiverAddress    = addressData;
    swap.receiverAddressSet = true;
  }

  await swap.save();

  const populated = await populateSwap(Swap.findById(swap._id));
  const result = populated.toJSON();
  const otherId = isInitiator ? swap.receiverId.toString() : swap.initiatorId.toString();
  emitSwapEvent('swap:updated', [otherId], result);
  return result;
};

// ─── Submit shipment tracking ─────────────────────────────────────────────────
const submitShipment = async (swapId, userId, shipmentData) => {
  const swap = await Swap.findById(swapId);
  if (!swap) throw Object.assign(new Error('Swap not found'), { status: 404 });

  const isInitiator = swap.initiatorId.toString() === userId;
  const isReceiver  = swap.receiverId.toString()  === userId;
  if (!isInitiator && !isReceiver) throw Object.assign(new Error('Not a participant'), { status: 403 });

  if (swap.status !== 'in_escrow') {
    throw Object.assign(new Error('Shipment can only be submitted after escrow is active'), { status: 400 });
  }

  const shipment = {
    provider:          shipmentData.provider,
    providerLabel:     shipmentData.providerLabel,
    trackingNumber:    shipmentData.trackingNumber,
    trackingUrl:       shipmentData.trackingUrl || null,
    shippedAt:         new Date(),
    estimatedDelivery: shipmentData.estimatedDelivery ? new Date(shipmentData.estimatedDelivery) : null,
    proofImages:       shipmentData.proofImages || [],
    notes:             shipmentData.notes || null,
  };

  if (isInitiator) {
    swap.initiatorShipment = shipment;
    swap.initiatorShipped  = true;
  } else {
    swap.receiverShipment = shipment;
    swap.receiverShipped  = true;
  }

  // Transition to shipped when both parties have dispatched their items
  if (swap.initiatorShipped && swap.receiverShipped) {
    swap.status = 'shipped';
  }

  await swap.save();

  const populated = await populateSwap(Swap.findById(swap._id));
  const result = populated.toJSON();
  emitSwapEvent('swap:updated', [swap.initiatorId.toString(), swap.receiverId.toString()], result);
  N.notifyShipmentSubmitted(result, userId).catch(() => {});
  return result;
};

// ─── Escrow: pay deposit ──────────────────────────────────────────────────────
const payEscrowDeposit = async (swapId, userId) => {
  const swap = await Swap.findById(swapId);
  if (!swap) throw Object.assign(new Error('Swap not found'), { status: 404 });

  const isInitiator = swap.initiatorId.toString() === userId;
  const isReceiver  = swap.receiverId.toString()  === userId;
  if (!isInitiator && !isReceiver) throw Object.assign(new Error('Not a participant'), { status: 403 });

  if (swap.status !== 'accepted') {
    throw Object.assign(new Error('Escrow can only be activated on an accepted swap'), { status: 400 });
  }

  if (isInitiator && swap.initiatorDepositPaid) {
    throw Object.assign(new Error('You have already paid the escrow deposit'), { status: 409 });
  }
  if (isReceiver && swap.receiverDepositPaid) {
    throw Object.assign(new Error('You have already paid the escrow deposit'), { status: 409 });
  }

  const { depositKobo } = escrowAmounts(swap.escrowDepositKobo);

  // Deduct from wallet atomically
  const user = await User.findOneAndUpdate(
    { _id: userId, walletBalance: { $gte: depositKobo } },
    { $inc: { walletBalance: -depositKobo } },
    { new: true }
  );
  if (!user) {
    throw Object.assign(
      new Error(`Insufficient Barter Credits. You need ${(depositKobo / 100).toLocaleString()} BC to pay the escrow collateral.`),
      { status: 402 }
    );
  }

  // Record payment
  await Payment.create({
    userId, swapId,
    amountKobo: depositKobo,
    paymentType: 'escrow',
    status: 'success',
    meta: { role: isInitiator ? 'initiator' : 'receiver', type: 'escrow_deposit' },
  });

  if (isInitiator) swap.initiatorDepositPaid = true;
  if (isReceiver)  swap.receiverDepositPaid  = true;

  // Both paid → activate escrow
  if (swap.initiatorDepositPaid && swap.receiverDepositPaid) {
    swap.status          = 'in_escrow';
    swap.escrowActive    = true;
    swap.escrowInitiatedAt = new Date();
  }

  await swap.save();

  const populated = await populateSwap(Swap.findById(swap._id));
  const result = populated.toJSON();
  emitSwapEvent('swap:updated', [swap.initiatorId.toString(), swap.receiverId.toString()], result);
  // Notify one party to pay, or both if escrow just activated
  if (result.status === 'in_escrow') {
    N.notifyEscrowActivated(result).catch(() => {});
  } else {
    N.notifyEscrowDepositPaid(result, userId).catch(() => {});
  }
  return result;
};

// ─── Confirm completion ───────────────────────────────────────────────────────
const confirmCompletion = async (swapId, userId) => {
  const swap = await Swap.findById(swapId);
  if (!swap) throw Object.assign(new Error('Swap not found'), { status: 404 });

  const isInitiator = swap.initiatorId.toString() === userId;
  const isReceiver  = swap.receiverId.toString()  === userId;
  if (!isInitiator && !isReceiver) throw Object.assign(new Error('Not a participant'), { status: 403 });

  if (!['in_escrow', 'shipped'].includes(swap.status)) {
    throw Object.assign(new Error('Swap cannot be confirmed at this stage'), { status: 400 });
  }

  if (isInitiator && swap.initiatorConfirmed) throw Object.assign(new Error('Already confirmed'), { status: 409 });
  if (isReceiver  && swap.receiverConfirmed)  throw Object.assign(new Error('Already confirmed'), { status: 409 });

  if (isInitiator) swap.initiatorConfirmed = true;
  if (isReceiver)  swap.receiverConfirmed  = true;

  if (swap.initiatorConfirmed && swap.receiverConfirmed) {
    swap.status = 'completed';
    swap.escrowReleasedAt = new Date();

    await Promise.all([
      User.findByIdAndUpdate(swap.initiatorId, { $inc: { swapCount: 1 } }),
      User.findByIdAndUpdate(swap.receiverId,  { $inc: { swapCount: 1 } }),
    ]);

    if (swap.initiatorListing) await Listing.findByIdAndUpdate(swap.initiatorListing, { status: 'swapped' });
    if (swap.receiverListing)  await Listing.findByIdAndUpdate(swap.receiverListing,  { status: 'swapped' });

    // Refund escrow deposits minus 2% platform fee
    if (swap.escrowActive && swap.initiatorDepositPaid && swap.receiverDepositPaid) {
      const { refundKobo, platformFeeKobo } = escrowAmounts(swap.escrowDepositKobo);
      await Promise.all([
        User.findByIdAndUpdate(swap.initiatorId, { $inc: { walletBalance: refundKobo } }),
        User.findByIdAndUpdate(swap.receiverId,  { $inc: { walletBalance: refundKobo } }),
      ]);
      swap.escrowFeeNgn    = (platformFeeKobo * 2) / 100; // total fee both parties
      swap.platformFeePaid = true;
      await Payment.insertMany([
        { userId: swap.initiatorId, swapId, amountKobo: refundKobo, paymentType: 'escrow', status: 'refunded', meta: { type: 'escrow_completion_refund', depositKobo: swap.escrowDepositKobo, platformFeeKobo } },
        { userId: swap.receiverId,  swapId, amountKobo: refundKobo, paymentType: 'escrow', status: 'refunded', meta: { type: 'escrow_completion_refund', depositKobo: swap.escrowDepositKobo, platformFeeKobo } },
        // Platform fee record — one entry per party so the total is platformFeeKobo * 2
        { userId: swap.initiatorId, swapId, amountKobo: platformFeeKobo, paymentType: 'fee', status: 'success', meta: { type: 'escrow_platform_fee' } },
        { userId: swap.receiverId,  swapId, amountKobo: platformFeeKobo, paymentType: 'fee', status: 'success', meta: { type: 'escrow_platform_fee' } },
      ]);
    }

    // Release top-up to the receiving party (the one who did NOT pay the top-up)
    if (swap.topUpPaid && swap.topUpAmountKobo > 0 && swap.topUpPayerRole !== 'none') {
      const topUpReceiverId = swap.topUpPayerRole === 'initiator'
        ? swap.receiverId.toString()
        : swap.initiatorId.toString();
      await User.findByIdAndUpdate(topUpReceiverId, { $inc: { walletBalance: swap.topUpAmountKobo } });
      swap.topUpReleasedAt = new Date();
      await Payment.create({
        userId: topUpReceiverId, swapId,
        amountKobo: swap.topUpAmountKobo,
        paymentType: 'escrow',
        status: 'refunded',
        meta: { type: 'topup_released' },
      });
    }
  }

  await swap.save();

  const populated = await populateSwap(Swap.findById(swap._id));
  const result = populated.toJSON();
  emitSwapEvent('swap:updated', [swap.initiatorId.toString(), swap.receiverId.toString()], result);
  if (result.status === 'completed') {
    N.notifySwapCompleted(result).catch(() => {});
  } else {
    // One party confirmed but swap not yet complete — nudge the other party
    N.notifyOnePartyConfirmed(result, userId).catch(() => {});
  }
  return result;
};

// ─── Pay value-gap top-up (Barter Credits) ───────────────────────────────────
const payTopUp = async (swapId, userId) => {
  const swap = await Swap.findById(swapId);
  if (!swap) throw Object.assign(new Error('Swap not found'), { status: 404 });

  const isInitiator = swap.initiatorId.toString() === userId;
  const isReceiver  = swap.receiverId.toString()  === userId;
  if (!isInitiator && !isReceiver) throw Object.assign(new Error('Not a participant'), { status: 403 });

  if (swap.topUpAmountKobo <= 0 || swap.topUpPayerRole === 'none') {
    throw Object.assign(new Error('No top-up required for this swap'), { status: 400 });
  }
  if (swap.topUpPaid) {
    throw Object.assign(new Error('Top-up already paid'), { status: 409 });
  }

  const expectedRole = isInitiator ? 'initiator' : 'receiver';
  if (swap.topUpPayerRole !== expectedRole) {
    throw Object.assign(new Error('You are not the party responsible for the top-up'), { status: 403 });
  }

  if (!['accepted', 'in_escrow'].includes(swap.status)) {
    throw Object.assign(new Error('Top-up can only be paid on an accepted or in-escrow swap'), { status: 400 });
  }

  // Deduct atomically
  const user = await User.findOneAndUpdate(
    { _id: userId, walletBalance: { $gte: swap.topUpAmountKobo } },
    { $inc: { walletBalance: -swap.topUpAmountKobo } },
    { new: true }
  );
  if (!user) {
    throw Object.assign(
      new Error(`Insufficient Barter Credits. You need ${(swap.topUpAmountKobo / 100).toLocaleString()} BC to pay the value gap.`),
      { status: 402 }
    );
  }

  await Payment.create({
    userId, swapId,
    amountKobo: swap.topUpAmountKobo,
    paymentType: 'escrow',
    status: 'success',
    meta: { type: 'topup_paid', role: expectedRole },
  });

  swap.topUpPaid   = true;
  swap.topUpPaidAt = new Date();
  await swap.save();

  const populated = await populateSwap(Swap.findById(swap._id));
  const result = populated.toJSON();
  emitSwapEvent('swap:updated', [swap.initiatorId.toString(), swap.receiverId.toString()], result);
  // Notify the receiving party that the top-up was paid
  N.notifyTopUpPaid(result, userId).catch(() => {});
  return result;
};

// ─── Raise dispute ────────────────────────────────────────────────────────────

const raiseDispute = async (swapId, userId, reason) => {
  const swap = await Swap.findById(swapId);
  if (!swap) throw Object.assign(new Error('Swap not found'), { status: 404 });

  const isParticipant =
    swap.initiatorId.toString() === userId ||
    swap.receiverId.toString()  === userId;
  if (!isParticipant) throw Object.assign(new Error('Not a participant'), { status: 403 });

  if (!canTransition(swap.status, 'disputed')) {
    throw Object.assign(new Error(`Cannot dispute from status: ${swap.status}`), { status: 400 });
  }

  swap.status          = 'disputed';
  swap.disputeReason   = reason;
  swap.disputeRaisedBy = userId;
  await swap.save();

  // Auto-open dispute room (non-blocking)
  const { openRoom } = require('../dispute/dispute.service');
  openRoom(swap._id).catch((err) => console.error('Failed to open dispute room:', err.message));

  const populated = await populateSwap(Swap.findById(swap._id));
  const result = populated.toJSON();
  const otherId = swap.initiatorId.toString() === userId
    ? swap.receiverId.toString()
    : swap.initiatorId.toString();
  emitSwapEvent('swap:disputed', [otherId], result);
  N.notifyDisputeRaised(result).catch(() => {});
  return result;
};

// ─── Get user swaps ───────────────────────────────────────────────────────────
const getUserSwaps = async (userId, status, page = 1, limit = 20) => {
  const filter = { $or: [{ initiatorId: userId }, { receiverId: userId }] };
  if (status) filter.status = status;

  const skip  = (page - 1) * limit;
  const total = await Swap.countDocuments(filter);

  const swaps = await populateSwap(
    Swap.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit)
  );

  return {
    swaps:      swaps.map(s => s.toJSON()),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  proposeSwap, getSwap, respondToSwap,
  setDeliveryAddress, submitShipment,
  payEscrowDeposit, confirmCompletion, raiseDispute, getUserSwaps, payTopUp,
  ESCROW_PLATFORM_FEE_PCT, ESCROW_MIN_DEPOSIT_KOBO, ESCROW_DEFAULT_COLLATERAL_PCT,
  escrowAmounts, calcDepositKobo,
};
