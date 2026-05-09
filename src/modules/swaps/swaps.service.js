const Swap = require('../../models/Swap');
const Listing = require('../../models/Listing');
const User = require('../../models/User');
const { emitSwapEvent } = require('../../socket');

// Strict state machine transitions
const ALLOWED_TRANSITIONS = {
  proposed: ['accepted', 'cancelled'],
  accepted: ['meetup_set', 'cancelled', 'disputed'],
  meetup_set: ['completed', 'cancelled', 'disputed'],
  in_escrow: ['completed', 'disputed', 'cancelled'],
};

const canTransition = (from, to) => {
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  return allowed.includes(to);
};

const populateSwap = (query) =>
  query
    .populate('initiatorId', 'fullName avatarUrl phone ratingAvg verification')
    .populate('receiverId', 'fullName avatarUrl phone ratingAvg verification')
    .populate('initiatorListing', 'title images estimatedValue condition status')
    .populate('receiverListing', 'title images estimatedValue condition status');

const proposeSwap = async (initiatorId, data) => {
  const { receiverId, initiatorListing, receiverListing, proposalNote, agreedValue } = data;

  if (initiatorId === receiverId) {
    throw Object.assign(new Error('Cannot propose swap to yourself'), { status: 400 });
  }

  const receiver = await User.findById(receiverId);
  if (!receiver) throw Object.assign(new Error('Receiver not found'), { status: 404 });

  // Check for existing pending swap between these parties for same listings
  const existing = await Swap.findOne({
    initiatorId,
    receiverId,
    initiatorListing: initiatorListing || null,
    receiverListing: receiverListing || null,
    status: 'proposed',
  });
  if (existing) throw Object.assign(new Error('Swap already proposed'), { status: 409 });

  const swap = await Swap.create({
    initiatorId,
    receiverId,
    initiatorListing,
    receiverListing,
    proposalNote,
    agreedValue,
    status: 'proposed',
  });

  const populated = await populateSwap(Swap.findById(swap._id));
  const result = populated.toJSON();

  emitSwapEvent('swap:new', [receiverId], result);

  return result;
};

const getSwap = async (swapId, userId) => {
  const swap = await populateSwap(Swap.findById(swapId));
  if (!swap) throw Object.assign(new Error('Swap not found'), { status: 404 });

  const isParticipant =
    swap.initiatorId._id.toString() === userId ||
    swap.receiverId._id.toString() === userId;

  if (!isParticipant) throw Object.assign(new Error('Not a participant'), { status: 403 });

  return swap.toJSON();
};

const respondToSwap = async (swapId, userId, action) => {
  const swap = await Swap.findById(swapId);
  if (!swap) throw Object.assign(new Error('Swap not found'), { status: 404 });

  const isInitiator = swap.initiatorId.toString() === userId;
  const isReceiver = swap.receiverId.toString() === userId;

  if (!isInitiator && !isReceiver) {
    throw Object.assign(new Error('Not a participant'), { status: 403 });
  }

  const newStatus = action === 'accept' ? 'accepted' : 'cancelled';

  if (action === 'accept' && !isReceiver) {
    throw Object.assign(new Error('Only receiver can accept'), { status: 403 });
  }

  if (!canTransition(swap.status, newStatus)) {
    throw Object.assign(new Error(`Cannot transition from ${swap.status} to ${newStatus}`), { status: 400 });
  }

  swap.status = newStatus;
  await swap.save();

  const populated = await populateSwap(Swap.findById(swap._id));
  const result = populated.toJSON();

  const otherPartyId = isInitiator ? swap.receiverId.toString() : swap.initiatorId.toString();
  emitSwapEvent('swap:updated', [otherPartyId], result);

  return result;
};

const setMeetup = async (swapId, userId, meetupData) => {
  const swap = await Swap.findById(swapId);
  if (!swap) throw Object.assign(new Error('Swap not found'), { status: 404 });

  const isParticipant =
    swap.initiatorId.toString() === userId ||
    swap.receiverId.toString() === userId;

  if (!isParticipant) throw Object.assign(new Error('Not a participant'), { status: 403 });

  if (!canTransition(swap.status, 'meetup_set')) {
    throw Object.assign(new Error(`Cannot set meetup from status: ${swap.status}`), { status: 400 });
  }

  swap.meetupLocation = meetupData.meetupLocation;
  swap.meetupScheduled = new Date(meetupData.meetupScheduled);
  swap.status = 'meetup_set';
  await swap.save();

  const populated = await populateSwap(Swap.findById(swap._id));
  const result = populated.toJSON();

  const otherPartyId = swap.initiatorId.toString() === userId
    ? swap.receiverId.toString()
    : swap.initiatorId.toString();
  emitSwapEvent('swap:updated', [otherPartyId], result);

  return result;
};

const confirmCompletion = async (swapId, userId) => {
  const swap = await Swap.findById(swapId);
  if (!swap) throw Object.assign(new Error('Swap not found'), { status: 404 });

  const isInitiator = swap.initiatorId.toString() === userId;
  const isReceiver = swap.receiverId.toString() === userId;

  if (!isInitiator && !isReceiver) {
    throw Object.assign(new Error('Not a participant'), { status: 403 });
  }

  if (!['meetup_set', 'in_escrow'].includes(swap.status)) {
    throw Object.assign(new Error('Swap cannot be confirmed at this stage'), { status: 400 });
  }

  if (isInitiator) swap.initiatorConfirmed = true;
  if (isReceiver) swap.receiverConfirmed = true;

  if (swap.initiatorConfirmed && swap.receiverConfirmed) {
    swap.status = 'completed';
    // Update swap counts
    await Promise.all([
      User.findByIdAndUpdate(swap.initiatorId, { $inc: { swapCount: 1 } }),
      User.findByIdAndUpdate(swap.receiverId, { $inc: { swapCount: 1 } }),
    ]);
    // Mark listings as swapped
    if (swap.initiatorListing) await Listing.findByIdAndUpdate(swap.initiatorListing, { status: 'swapped' });
    if (swap.receiverListing) await Listing.findByIdAndUpdate(swap.receiverListing, { status: 'swapped' });
  }

  await swap.save();

  const populated = await populateSwap(Swap.findById(swap._id));
  const result = populated.toJSON();

  emitSwapEvent('swap:updated', [swap.initiatorId.toString(), swap.receiverId.toString()], result);

  return result;
};

const raiseDispute = async (swapId, userId, reason) => {
  const swap = await Swap.findById(swapId);
  if (!swap) throw Object.assign(new Error('Swap not found'), { status: 404 });

  const isParticipant =
    swap.initiatorId.toString() === userId ||
    swap.receiverId.toString() === userId;

  if (!isParticipant) throw Object.assign(new Error('Not a participant'), { status: 403 });

  if (!canTransition(swap.status, 'disputed')) {
    throw Object.assign(new Error(`Cannot dispute from status: ${swap.status}`), { status: 400 });
  }

  swap.status = 'disputed';
  swap.disputeReason = reason;
  swap.disputeRaisedBy = userId;
  await swap.save();

  const populated = await populateSwap(Swap.findById(swap._id));
  const result = populated.toJSON();

  const otherPartyId = swap.initiatorId.toString() === userId
    ? swap.receiverId.toString()
    : swap.initiatorId.toString();
  emitSwapEvent('swap:disputed', [otherPartyId], result);

  return result;
};

const getUserSwaps = async (userId, status) => {
  const filter = {
    $or: [{ initiatorId: userId }, { receiverId: userId }],
  };
  if (status) filter.status = status;

  const swaps = await populateSwap(
    Swap.find(filter).sort({ updatedAt: -1 })
  );

  return swaps.map(s => s.toJSON());
};

module.exports = { proposeSwap, getSwap, respondToSwap, setMeetup, confirmCompletion, raiseDispute, getUserSwaps };
