/**
 * SwapNaija — Notifications Service
 * Sends transactional emails on swap lifecycle events
 * and assembles personalised daily digest data.
 */
const User    = require('../../models/User');
const Swap    = require('../../models/Swap');
const Listing = require('../../models/Listing');
const { sendEmail } = require('../../utils/email');
const T = require('../../utils/emailTemplates');

let config;
try { config = require('../../config/env'); }
catch (e) { config = { FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173', NODE_ENV: process.env.NODE_ENV || 'development' }; }

const FE = () => config.FRONTEND_URL || 'http://localhost:5173';

// ─── Safe email sender — never throws, just logs ──────────────────────────────
const safeSend = async (to, tpl) => {
  if (!to) return;
  try {
    const injected = T.injectUrl(tpl, FE());
    await sendEmail({ to, subject: injected.subject, html: injected.html, text: injected.text });
  } catch (err) {
    console.warn(`[NOTIFY] Failed to send "${tpl.subject}" to ${to}: ${err.message}`);
  }
};

// ─── Resolve user emails for a swap ──────────────────────────────────────────
const resolveEmails = async (swap) => {
  const [initiator, receiver] = await Promise.all([
    User.findById(swap.initiatorId).select('fullName email phone emailPrefs'),
    User.findById(swap.receiverId).select('fullName email phone emailPrefs'),
  ]);
  const emailOf = (u) => u?.email || (u?.phone ? `${u.phone.replace(/\D/g, '')}@swapnaija.ng` : null);
  return { initiator, receiver, initiatorEmail: emailOf(initiator), receiverEmail: emailOf(receiver) };
};

const wantsEmail = (user, type = 'swapUpdates') =>
  user?.emailPrefs?.[type] !== false; // default true

// ─── 1. Swap Proposed ────────────────────────────────────────────────────────
const notifySwapProposed = async (swap) => {
  const { initiator, receiver, receiverEmail } = await resolveEmails(swap);
  if (!receiverEmail || !wantsEmail(receiver, 'swapUpdates')) return;
  const tpl = T.swapProposed({ receiver, initiator, swap, frontendUrl: FE() });
  await safeSend(receiverEmail, tpl);
};

// ─── 2. Swap Accepted ────────────────────────────────────────────────────────
const notifySwapAccepted = async (swap) => {
  const { initiator, receiver, initiatorEmail } = await resolveEmails(swap);
  if (!initiatorEmail || !wantsEmail(initiator, 'swapUpdates')) return;
  const tpl = T.swapAccepted({ initiator, receiver, swap, frontendUrl: FE() });
  await safeSend(initiatorEmail, tpl);
};

// ─── 3. Swap Cancelled / Declined ────────────────────────────────────────────
const notifySwapCancelled = async (swap, actorId, isDecline = false) => {
  const { initiator, receiver, initiatorEmail, receiverEmail } = await resolveEmails(swap);
  const actorIsInitiator = swap.initiatorId.toString() === actorId;

  // Notify the OTHER party
  if (actorIsInitiator && receiverEmail && wantsEmail(receiver, 'swapUpdates')) {
    const tpl = T.swapCancelled({ user: receiver, otherUser: initiator, swap, isDecline, frontendUrl: FE() });
    await safeSend(receiverEmail, tpl);
  } else if (!actorIsInitiator && initiatorEmail && wantsEmail(initiator, 'swapUpdates')) {
    const tpl = T.swapCancelled({ user: initiator, otherUser: receiver, swap, isDecline, frontendUrl: FE() });
    await safeSend(initiatorEmail, tpl);
  }
};

// ─── 4. Meetup Set ────────────────────────────────────────────────────────────
const notifyMeetupSet = async (swap, actorId) => {
  const { initiator, receiver, initiatorEmail, receiverEmail } = await resolveEmails(swap);
  const actorIsInitiator = swap.initiatorId.toString() === actorId;

  if (actorIsInitiator && receiverEmail && wantsEmail(receiver, 'swapUpdates')) {
    await safeSend(receiverEmail, T.meetupSet({ user: receiver, otherUser: initiator, swap, frontendUrl: FE() }));
  } else if (!actorIsInitiator && initiatorEmail && wantsEmail(initiator, 'swapUpdates')) {
    await safeSend(initiatorEmail, T.meetupSet({ user: initiator, otherUser: receiver, swap, frontendUrl: FE() }));
  }
};

// ─── 5. Escrow Deposit Paid ───────────────────────────────────────────────────
const notifyEscrowDepositPaid = async (swap, payerId) => {
  const { initiator, receiver, initiatorEmail, receiverEmail } = await resolveEmails(swap);
  const payerIsInitiator = swap.initiatorId.toString() === payerId;

  if (payerIsInitiator && receiverEmail && wantsEmail(receiver, 'swapUpdates')) {
    // Tell receiver to pay theirs
    await safeSend(receiverEmail, T.escrowDepositNeeded({
      user: receiver, payer: initiator, swap, frontendUrl: FE()
    }));
  } else if (!payerIsInitiator && initiatorEmail && wantsEmail(initiator, 'swapUpdates')) {
    await safeSend(initiatorEmail, T.escrowDepositNeeded({
      user: initiator, payer: receiver, swap, frontendUrl: FE()
    }));
  }
};

// ─── 6. Escrow Activated (both paid) ─────────────────────────────────────────
const notifyEscrowActivated = async (swap) => {
  const { initiator, receiver, initiatorEmail, receiverEmail } = await resolveEmails(swap);

  if (initiatorEmail && wantsEmail(initiator, 'swapUpdates')) {
    await safeSend(initiatorEmail, T.escrowActivated({ user: initiator, otherUser: receiver, swap, frontendUrl: FE() }));
  }
  if (receiverEmail && wantsEmail(receiver, 'swapUpdates')) {
    await safeSend(receiverEmail, T.escrowActivated({ user: receiver, otherUser: initiator, swap, frontendUrl: FE() }));
  }
};

// ─── 7. Swap Completed ────────────────────────────────────────────────────────
const notifySwapCompleted = async (swap) => {
  const { initiator, receiver, initiatorEmail, receiverEmail } = await resolveEmails(swap);
  const { escrowDepositKobo } = swap;
  const platformFeeKobo = Math.round((escrowDepositKobo || 0) * 0.02);
  const refundKobo = (escrowDepositKobo || 0) - platformFeeKobo;
  const refundBC   = swap.escrowActive ? (refundKobo / 100).toLocaleString() : null;

  if (initiatorEmail && wantsEmail(initiator, 'swapUpdates')) {
    await safeSend(initiatorEmail, T.swapCompleted({ user: initiator, otherUser: receiver, swap, refundBC, frontendUrl: FE() }));
  }
  if (receiverEmail && wantsEmail(receiver, 'swapUpdates')) {
    await safeSend(receiverEmail, T.swapCompleted({ user: receiver, otherUser: initiator, swap, refundBC, frontendUrl: FE() }));
  }
};

// ─── 8. Dispute Raised ───────────────────────────────────────────────────────
const notifyDisputeRaised = async (swap) => {
  const { initiator, receiver, initiatorEmail, receiverEmail } = await resolveEmails(swap);
  const raiserId = swap.disputeRaisedBy?.toString();
  const raiser = raiserId === swap.initiatorId.toString() ? initiator : receiver;

  if (initiatorEmail && wantsEmail(initiator, 'swapUpdates')) {
    await safeSend(initiatorEmail, T.disputeRaised({
      user: initiator, raiser, swap,
      isRaiser: swap.initiatorId.toString() === raiserId,
      frontendUrl: FE()
    }));
  }
  if (receiverEmail && wantsEmail(receiver, 'swapUpdates')) {
    await safeSend(receiverEmail, T.disputeRaised({
      user: receiver, raiser, swap,
      isRaiser: swap.receiverId.toString() === raiserId,
      frontendUrl: FE()
    }));
  }
};

// ─── 9. Top-up Required ──────────────────────────────────────────────────────
const notifyTopUpRequired = async (swap) => {
  const { initiator, receiver, initiatorEmail, receiverEmail } = await resolveEmails(swap);
  const payerIsInitiator = swap.topUpPayerRole === 'initiator';

  if (payerIsInitiator && initiatorEmail && wantsEmail(initiator, 'swapUpdates')) {
    await safeSend(initiatorEmail, T.topUpRequired({ user: initiator, otherUser: receiver, swap, frontendUrl: FE() }));
  } else if (!payerIsInitiator && receiverEmail && wantsEmail(receiver, 'swapUpdates')) {
    await safeSend(receiverEmail, T.topUpRequired({ user: receiver, otherUser: initiator, swap, frontendUrl: FE() }));
  }
};

// ─── 10. Welcome ─────────────────────────────────────────────────────────────
const notifyWelcome = async (userId) => {
  const user = await User.findById(userId).select('fullName email phone emailPrefs');
  const email = user?.email || (user?.phone ? `${user.phone.replace(/\D/g, '')}@swapnaija.ng` : null);
  if (!email) return;
  await safeSend(email, T.welcomeEmail({ user, frontendUrl: FE() }));
};

// ─── Daily digest builders ────────────────────────────────────────────────────
// Returns { pendingActions, stats, daySummary, suggestions } for a given user
const buildDigestData = async (userId) => {
  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const user = await User.findById(userId).select('fullName email phone emailPrefs walletBalance swapCount');
  if (!user) return null;

  // All active swaps for this user
  const mySwaps = await Swap.find({
    $or: [{ initiatorId: userId }, { receiverId: userId }],
    status: { $in: ['proposed', 'accepted', 'meetup_set', 'in_escrow'] },
  })
    .populate('initiatorId', 'fullName avatarUrl')
    .populate('receiverId',  'fullName avatarUrl')
    .populate('initiatorListing', 'title estimatedValue')
    .populate('receiverListing',  'title estimatedValue')
    .sort({ updatedAt: -1 });

  const enriched = mySwaps.map(s => {
    const isInitiator = s.initiatorId._id.toString() === userId;
    return {
      ...s.toObject(),
      isInitiator,
      otherUser: isInitiator ? s.receiverId : s.initiatorId,
    };
  });

  // Pending proposals TO me (I'm receiver, status = proposed)
  const pendingProposals = enriched.filter(s =>
    s.status === 'proposed' && !s.isInitiator
  );

  // Swaps where I still owe escrow (accepted, escrow not paid by me)
  const awaitingEscrow = enriched.filter(s =>
    s.status === 'accepted' &&
    ((s.isInitiator && !s.initiatorDepositPaid) ||
     (!s.isInitiator && !s.receiverDepositPaid))
  );

  // Upcoming meetups (in next 48h)
  const tomorrow48 = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const upcomingMeetups = enriched.filter(s =>
    s.meetupScheduled &&
    new Date(s.meetupScheduled) >= now &&
    new Date(s.meetupScheduled) <= tomorrow48
  );

  // Swaps where they confirmed but I haven't
  const awaitingConfirm = enriched.filter(s =>
    ['meetup_set', 'in_escrow'].includes(s.status) &&
    ((s.isInitiator && !s.initiatorConfirmed && s.receiverConfirmed) ||
     (!s.isInitiator && !s.receiverConfirmed && s.initiatorConfirmed))
  );

  const pendingCount = pendingProposals.length + awaitingEscrow.length + awaitingConfirm.length;

  // Stats
  const [swapsThisWeek, completedToday, newProposalsToday, totalCompleted] = await Promise.all([
    Swap.countDocuments({
      $or: [{ initiatorId: userId }, { receiverId: userId }],
      status: 'completed',
      updatedAt: { $gte: weekAgo },
    }),
    Swap.countDocuments({
      $or: [{ initiatorId: userId }, { receiverId: userId }],
      status: 'completed',
      updatedAt: { $gte: startOfDay },
    }),
    Swap.countDocuments({
      receiverId: userId,
      status: 'proposed',
      createdAt: { $gte: startOfDay },
    }),
    Swap.countDocuments({
      $or: [{ initiatorId: userId }, { receiverId: userId }],
      status: 'completed',
    }),
  ]);

  // Random listing suggestions (exclude user's own listings)
  const suggestions = await Listing.find({
    userId: { $ne: userId },
    status: 'active',
  })
    .select('title estimatedValue locationState images id')
    .sort({ isBoosted: -1, createdAt: -1 })
    .limit(6)
    .lean();

  return {
    user,
    pendingActions: { pendingProposals, awaitingEscrow, upcomingMeetups, awaitingConfirm },
    stats: {
      swapsThisWeek,
      activeSwaps: enriched.length,
      walletBC: Math.round((user.walletBalance || 0) / 100),
    },
    daySummary: {
      completedToday,
      newProposalsToday,
      totalSwaps: totalCompleted,
      walletBC: Math.round((user.walletBalance || 0) / 100),
      pendingCount,
    },
    suggestions,
  };
};

// ─── Send morning digest to one user ─────────────────────────────────────────
const sendMorningDigest = async (userId) => {
  const data = await buildDigestData(userId);
  if (!data) return;
  const { user } = data;
  if (!wantsEmail(user, 'dailyDigest')) return;
  const email = user.email || `${user.phone?.replace(/\D/g, '')}@swapnaija.ng`;
  if (!email) return;
  await safeSend(email, T.morningDigest({ ...data, frontendUrl: FE() }));
};

// ─── Send afternoon digest to one user ───────────────────────────────────────
const sendAfternoonDigest = async (userId) => {
  const data = await buildDigestData(userId);
  if (!data) return;
  const { user } = data;
  if (!wantsEmail(user, 'dailyDigest')) return;
  const email = user.email || `${user.phone?.replace(/\D/g, '')}@swapnaija.ng`;
  if (!email) return;
  await safeSend(email, T.afternoonDigest({ ...data, frontendUrl: FE() }));
};

// ─── Send night digest to one user ───────────────────────────────────────────
const sendNightDigest = async (userId) => {
  const data = await buildDigestData(userId);
  if (!data) return;
  const { user } = data;
  if (!wantsEmail(user, 'dailyDigest')) return;
  const email = user.email || `${user.phone?.replace(/\D/g, '')}@swapnaija.ng`;
  if (!email) return;
  await safeSend(email, T.nightDigest({ ...data, frontendUrl: FE() }));
};

// ─── Batch digest to all eligible users ──────────────────────────────────────
const sendBatchDigest = async (type) => {
  const users = await User.find({
    status: 'active',
    'emailPrefs.dailyDigest': { $ne: false },
  }).select('_id').lean();

  console.log(`[DIGEST] Sending ${type} digest to ${users.length} users`);
  let sent = 0, failed = 0;

  for (const u of users) {
    try {
      if (type === 'morning')   await sendMorningDigest(u._id);
      if (type === 'afternoon') await sendAfternoonDigest(u._id);
      if (type === 'night')     await sendNightDigest(u._id);
      sent++;
    } catch (err) {
      failed++;
      console.warn(`[DIGEST] Failed for user ${u._id}: ${err.message}`);
    }
    // small pause to avoid hammering SMTP
    await new Promise(r => setTimeout(r, 120));
  }
  console.log(`[DIGEST] ${type} done — sent: ${sent}, failed: ${failed}`);
};

module.exports = {
  notifySwapProposed,
  notifySwapAccepted,
  notifySwapCancelled,
  notifyMeetupSet,
  notifyEscrowDepositPaid,
  notifyEscrowActivated,
  notifySwapCompleted,
  notifyDisputeRaised,
  notifyTopUpRequired,
  notifyWelcome,
  sendBatchDigest,
  sendMorningDigest,
  sendAfternoonDigest,
  sendNightDigest,
  buildDigestData,
};
