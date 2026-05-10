const Swap = require('../../models/Swap');
const Listing = require('../../models/Listing');
const User = require('../../models/User');
const Payment = require('../../models/Payment');
const { emitSwapEvent } = require('../../socket');

// ─── Escrow constants ─────────────────────────────────────────────────────────
const ESCROW_DEPOSIT_KOBO    = 100000; // ₦1,000 per party
const ESCROW_PLATFORM_FEE    = 20000;  // ₦200 kept per party on completion
const ESCROW_REFUND_KOBO     = ESCROW_DEPOSIT_KOBO - ESCROW_PLATFORM_FEE; // ₦800

// ─── State machine ────────────────────────────────────────────────────────────
const ALLOWED_TRANSITIONS = {
  proposed:    ['accepted', 'cancelled'],
  accepted:    ['meetup_set', 'in_escrow', 'cancelled', 'disputed'],
  meetup_set:  ['completed', 'cancelled', 'disputed'],
  in_escrow:   ['completed', 'disputed', 'cancelled'],
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
const _refundDeposit = async (userId, swapId, reason = 'escrow_cancelled_refund') => {
  await User.findByIdAndUpdate(userId, { $inc: { walletBalance: ESCROW_DEPOSIT_KOBO } });
  await Payment.create({
    userId, swapId,
    amountKobo: ESCROW_DEPOSIT_KOBO,
    paymentType: 'escrow',
    status: 'refunded',
    meta: { type: reason },
  });
};

// ─── Propose swap ─────────────────────────────────────────────────────────────
const proposeSwap = async (initiatorId, data) => {
  const { receiverId, initiatorListing, receiverListing, proposalNote, agreedValue, topUpAmountKobo, topUpPayerRole } = data;

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

  const swap = await Swap.create({
    initiatorId, receiverId,
    initiatorListing, receiverListing,
    proposalNote, agreedValue, swapType,
    status: 'proposed',
    topUpAmountKobo: topUpAmountKobo || 0,
    topUpPayerRole: topUpPayerRole || 'none',
  });

  const populated = await populateSwap(Swap.findById(swap._id));
  const result = populated.toJSON();
  emitSwapEvent('swap:new', [receiverId], result);
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

  if (action === 'accept' && !isReceiver) {
    throw Object.assign(new Error('Only the receiver can accept'), { status: 403 });
  }
  if (!canTransition(swap.status, newStatus)) {
    throw Object.assign(new Error(`Cannot transition from ${swap.status} to ${newStatus}`), { status: 400 });
  }

  // If cancelling an escrow swap, refund any deposits already paid
  if (newStatus === 'cancelled') {
    if (swap.initiatorDepositPaid) await _refundDeposit(swap.initiatorId.toString(), swapId);
    if (swap.receiverDepositPaid)  await _refundDeposit(swap.receiverId.toString(),  swapId);
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
  return result;
};

// ─── Set meetup ───────────────────────────────────────────────────────────────
const setMeetup = async (swapId, userId, meetupData) => {
  const swap = await Swap.findById(swapId);
  if (!swap) throw Object.assign(new Error('Swap not found'), { status: 404 });

  const isParticipant =
    swap.initiatorId.toString() === userId ||
    swap.receiverId.toString()  === userId;
  if (!isParticipant) throw Object.assign(new Error('Not a participant'), { status: 403 });

  // Allow setting meetup from both accepted and in_escrow
  if (!['accepted', 'in_escrow'].includes(swap.status)) {
    throw Object.assign(new Error(`Cannot set meetup from status: ${swap.status}`), { status: 400 });
  }

  swap.meetupLocation  = meetupData.meetupLocation;
  swap.meetupScheduled = new Date(meetupData.meetupScheduled);

  // Only transition to meetup_set if not using escrow
  if (swap.status === 'accepted') {
    swap.status = 'meetup_set';
  }
  // If in_escrow, keep status but record meetup details

  await swap.save();

  const populated = await populateSwap(Swap.findById(swap._id));
  const result = populated.toJSON();
  const otherId = swap.initiatorId.toString() === userId
    ? swap.receiverId.toString()
    : swap.initiatorId.toString();
  emitSwapEvent('swap:updated', [otherId], result);
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

  // Deduct from wallet atomically
  const user = await User.findOneAndUpdate(
    { _id: userId, walletBalance: { $gte: ESCROW_DEPOSIT_KOBO } },
    { $inc: { walletBalance: -ESCROW_DEPOSIT_KOBO } },
    { new: true }
  );
  if (!user) {
    throw Object.assign(
      new Error(`Insufficient wallet balance. Top up ₦${(ESCROW_DEPOSIT_KOBO / 100).toLocaleString()} to activate escrow.`),
      { status: 402 }
    );
  }

  // Record payment
  await Payment.create({
    userId, swapId,
    amountKobo: ESCROW_DEPOSIT_KOBO,
    paymentType: 'escrow',
    status: 'success',
    meta: { role: isInitiator ? 'initiator' : 'receiver' },
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
  return result;
};

// ─── Confirm completion ───────────────────────────────────────────────────────
const confirmCompletion = async (swapId, userId) => {
  const swap = await Swap.findById(swapId);
  if (!swap) throw Object.assign(new Error('Swap not found'), { status: 404 });

  const isInitiator = swap.initiatorId.toString() === userId;
  const isReceiver  = swap.receiverId.toString()  === userId;
  if (!isInitiator && !isReceiver) throw Object.assign(new Error('Not a participant'), { status: 403 });

  if (!['meetup_set', 'in_escrow'].includes(swap.status)) {
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

    // Refund escrow deposits minus platform fee
    if (swap.escrowActive && swap.initiatorDepositPaid && swap.receiverDepositPaid) {
      await Promise.all([
        User.findByIdAndUpdate(swap.initiatorId, { $inc: { walletBalance: ESCROW_REFUND_KOBO } }),
        User.findByIdAndUpdate(swap.receiverId,  { $inc: { walletBalance: ESCROW_REFUND_KOBO } }),
      ]);
      // Record refund transactions
      await Payment.insertMany([
        { userId: swap.initiatorId, swapId, amountKobo: ESCROW_REFUND_KOBO, paymentType: 'escrow', status: 'refunded', meta: { type: 'escrow_completion_refund' } },
        { userId: swap.receiverId,  swapId, amountKobo: ESCROW_REFUND_KOBO, paymentType: 'escrow', status: 'refunded', meta: { type: 'escrow_completion_refund' } },
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

  swap.status         = 'disputed';
  swap.disputeReason  = reason;
  swap.disputeRaisedBy = userId;
  await swap.save();

  const populated = await populateSwap(Swap.findById(swap._id));
  const result = populated.toJSON();
  const otherId = swap.initiatorId.toString() === userId
    ? swap.receiverId.toString()
    : swap.initiatorId.toString();
  emitSwapEvent('swap:disputed', [otherId], result);
  return result;
};

// ─── Get user swaps ───────────────────────────────────────────────────────────
const getUserSwaps = async (userId, status) => {
  const filter = { $or: [{ initiatorId: userId }, { receiverId: userId }] };
  if (status) filter.status = status;

  const swaps = await populateSwap(Swap.find(filter).sort({ updatedAt: -1 }));
  return swaps.map(s => s.toJSON());
};

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  proposeSwap, getSwap, respondToSwap, setMeetup,
  payEscrowDeposit, confirmCompletion, raiseDispute, getUserSwaps, payTopUp,
  ESCROW_DEPOSIT_KOBO, ESCROW_PLATFORM_FEE, ESCROW_REFUND_KOBO,
};
