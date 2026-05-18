const User = require('../../models/User');
const Listing = require('../../models/Listing');
const Swap = require('../../models/Swap');
const Payment = require('../../models/Payment');

const getStats = async () => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers, newUsers30d, newUsers7d, activeUsers, suspendedUsers, pendingUsers, verifiedUsers,
    totalListings, activeListings, boostedListings, pausedListings,
    totalSwaps, completedSwaps, disputedSwaps, pendingSwaps, inProgressSwaps,
    totalPayments, pendingPayments, failedPayments,
    revenueResult, revenueByTypeResult, revenue30dResult,
    totalReviews, walletResult, escrowLockedResult,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    User.countDocuments({ status: 'active' }),
    User.countDocuments({ status: 'suspended' }),
    User.countDocuments({ status: 'pending' }),
    User.countDocuments({ verification: { $in: ['verified', 'premium'] } }),
    Listing.countDocuments({ status: { $ne: 'deleted' } }),
    Listing.countDocuments({ status: 'active' }),
    Listing.countDocuments({ isBoosted: true, boostExpires: { $gt: now } }),
    Listing.countDocuments({ status: 'paused' }),
    Swap.countDocuments(),
    Swap.countDocuments({ status: 'completed' }),
    Swap.countDocuments({ status: 'disputed' }),
    Swap.countDocuments({ status: 'proposed' }),
    Swap.countDocuments({ status: { $in: ['accepted', 'in_escrow', 'shipped'] } }),
    Payment.countDocuments({ status: 'success' }),
    Payment.countDocuments({ status: 'pending' }),
    Payment.countDocuments({ status: 'failed' }),
    Payment.aggregate([
      { $match: { status: 'success' } },
      { $group: { _id: null, total: { $sum: '$amountKobo' } } },
    ]),
    Payment.aggregate([
      { $match: { status: 'success' } },
      { $group: { _id: '$paymentType', total: { $sum: '$amountKobo' }, count: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: { status: 'success', createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: null, total: { $sum: '$amountKobo' } } },
    ]),
    require('../../models/Review').countDocuments(),
    User.aggregate([
      { $group: { _id: null, total: { $sum: '$walletBalance' } } },
    ]),
    Swap.aggregate([
      { $match: { escrowActive: true } },
      { $group: { _id: null, total: { $sum: '$escrowDepositKobo' } } },
    ]),
  ]);

  const revenueKobo = revenueResult[0]?.total || 0;
  const walletKobo = walletResult[0]?.total || 0;
  const revenue30dKobo = revenue30dResult[0]?.total || 0;
  const escrowLockedKobo = escrowLockedResult[0]?.total || 0;

  const byType = {};
  for (const row of revenueByTypeResult) {
    byType[row._id] = { amountNgn: Math.round(row.total / 100), count: row.count };
  }

  return {
    users: {
      total: totalUsers, new30d: newUsers30d, new7d: newUsers7d,
      active: activeUsers, suspended: suspendedUsers, pending: pendingUsers,
      verified: verifiedUsers,
    },
    listings: { total: totalListings, active: activeListings, boosted: boostedListings, paused: pausedListings },
    swaps: { total: totalSwaps, completed: completedSwaps, disputed: disputedSwaps, pending: pendingSwaps, inProgress: inProgressSwaps },
    payments: {
      total: totalPayments,
      pending: pendingPayments,
      failed: failedPayments,
      revenueNgn: Math.round(revenueKobo / 100),
      revenue30dNgn: Math.round(revenue30dKobo / 100),
      byType,
    },
    reviews: { total: totalReviews },
    wallet: {
      totalBalanceNgn: Math.round(walletKobo / 100),
      escrowLockedNgn: Math.round(escrowLockedKobo / 100),
    },
  };
};

const listUsers = async ({ page = 1, limit = 20, search, status, isAdmin, verification }) => {
  const filter = {};
  if (search) {
    filter.$or = [
      { fullName: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { username: { $regex: search, $options: 'i' } },
    ];
  }
  if (status) filter.status = status;
  if (isAdmin !== undefined) filter.isAdmin = isAdmin === 'true';
  if (verification) filter.verification = verification;

  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    User.find(filter)
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  return { users: users.map(u => u.toJSON()), total, page, pages: Math.ceil(total / limit) };
};

const getUserDetail = async (userId) => {
  const user = await User.findById(userId).select('-passwordHash');
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  const Review = require('../../models/Review');
  const [listings, swaps, payments, reviews] = await Promise.all([
    Listing.find({ userId }).sort({ createdAt: -1 }).populate('categoryId', 'name'),
    Swap.find({ $or: [{ initiatorId: userId }, { receiverId: userId }] })
      .sort({ createdAt: -1 })
      .populate('initiatorId', 'fullName avatarUrl')
      .populate('receiverId', 'fullName avatarUrl')
      .populate('initiatorListing', 'title images')
      .populate('receiverListing', 'title images'),
    Payment.find({ userId }).sort({ createdAt: -1 }),
    Review.find({ revieweeId: userId })
      .sort({ createdAt: -1 })
      .populate('reviewerId', 'fullName avatarUrl')
      .populate('swapId', 'status'),
  ]);

  return {
    user: user.toJSON(),
    listings: listings.map(l => l.toJSON()),
    swaps: swaps.map(s => s.toJSON()),
    payments: payments.map(p => p.toJSON()),
    reviews: reviews.map(r => r.toJSON()),
  };
};

const updateUserStatus = async (userId, status) => {
  const allowed = ['active', 'suspended', 'pending'];
  if (!allowed.includes(status)) {
    throw Object.assign(new Error('Invalid status'), { status: 400 });
  }
  const user = await User.findByIdAndUpdate(userId, { status }, { new: true }).select('-passwordHash');
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  return user.toJSON();
};

const toggleAdmin = async (userId, adminUserId) => {
  if (userId === adminUserId) {
    throw Object.assign(new Error('Cannot modify your own admin status'), { status: 400 });
  }
  const user = await User.findById(userId).select('-passwordHash');
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  user.isAdmin = !user.isAdmin;
  await user.save();
  return user.toJSON();
};

const listListings = async ({ page = 1, limit = 20, search, status, userId, listingType, condition }) => {
  const filter = {};
  if (search) filter.$text = { $search: search };
  if (status) filter.status = status;
  if (userId) filter.userId = userId;
  if (listingType) filter.listingType = listingType;
  if (condition) filter.condition = condition;

  const skip = (page - 1) * limit;
  const [listings, total] = await Promise.all([
    Listing.find(filter)
      .populate('userId', 'fullName phone avatarUrl')
      .populate('categoryId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Listing.countDocuments(filter),
  ]);

  return { listings: listings.map(l => l.toJSON()), total, page, pages: Math.ceil(total / limit) };
};

const updateListingStatus = async (listingId, status) => {
  const allowed = ['active', 'paused', 'deleted'];
  if (!allowed.includes(status)) {
    throw Object.assign(new Error('Invalid status'), { status: 400 });
  }
  const listing = await Listing.findByIdAndUpdate(listingId, { status }, { new: true })
    .populate('userId', 'fullName')
    .populate('categoryId', 'name');
  if (!listing) throw Object.assign(new Error('Listing not found'), { status: 404 });
  return listing.toJSON();
};

const listSwaps = async ({ page = 1, limit = 20, status, disputedOnly, swapType }) => {
  const filter = {};
  if (status) filter.status = status;
  if (disputedOnly === 'true' || disputedOnly === true) filter.status = 'disputed';
  if (swapType) filter.swapType = swapType;

  const skip = (page - 1) * limit;
  const [swaps, total] = await Promise.all([
    Swap.find(filter)
      .populate('initiatorId', 'fullName phone avatarUrl')
      .populate('receiverId', 'fullName phone avatarUrl')
      .populate('initiatorListing', 'title images')
      .populate('receiverListing', 'title images')
      .populate('disputeRaisedBy', 'fullName')
      .populate('disputeResolvedBy', 'fullName')
      .sort({ status: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Swap.countDocuments(filter),
  ]);

  return { swaps: swaps.map(s => s.toJSON()), total, page, pages: Math.ceil(total / limit) };
};

const resolveDispute = async (swapId, adminUserId, { resolution, adminNote }) => {
  const swap = await Swap.findById(swapId);
  if (!swap) throw Object.assign(new Error('Swap not found'), { status: 404 });
  if (swap.status !== 'disputed') {
    throw Object.assign(new Error('Swap is not in disputed status'), { status: 400 });
  }

  const allowed = ['completed', 'cancelled'];
  if (!allowed.includes(resolution)) {
    throw Object.assign(new Error('resolution must be completed or cancelled'), { status: 400 });
  }

  swap.status = resolution;
  swap.disputeAdminNote = adminNote || '';
  swap.disputeResolvedBy = adminUserId;
  swap.disputeResolvedAt = new Date();
  await swap.save();

  return (await Swap.findById(swapId)
    .populate('initiatorId', 'fullName phone')
    .populate('receiverId', 'fullName phone')
    .populate('disputeResolvedBy', 'fullName')).toJSON();
};

const listPayments = async ({ page = 1, limit = 20, status, paymentType, userId }) => {
  const filter = {};
  if (status) filter.status = status;
  if (paymentType) filter.paymentType = paymentType;
  if (userId) filter.userId = userId;

  const skip = (page - 1) * limit;
  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .populate('userId', 'fullName phone avatarUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Payment.countDocuments(filter),
  ]);

  return { payments: payments.map(p => p.toJSON()), total, page, pages: Math.ceil(total / limit) };
};

const Review = require('../../models/Review');

const listReviews = async ({ page = 1, limit = 20, rating, revieweeId }) => {
  const filter = {};
  if (rating) filter.rating = +rating;
  if (revieweeId) filter.revieweeId = revieweeId;
  const skip = (page - 1) * limit;
  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .populate('reviewerId', 'fullName avatarUrl')
      .populate('revieweeId', 'fullName avatarUrl')
      .populate('swapId', 'status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Review.countDocuments(filter),
  ]);
  return { reviews: reviews.map(r => r.toJSON()), total, page, pages: Math.ceil(total / limit) };
};

const deleteReview = async (reviewId) => {
  const review = await Review.findByIdAndDelete(reviewId);
  if (!review) throw Object.assign(new Error('Review not found'), { status: 404 });
  return { message: 'Review deleted' };
};

module.exports = {
  getStats,
  listUsers, getUserDetail, updateUserStatus, toggleAdmin,
  listListings, updateListingStatus,
  listSwaps, resolveDispute,
  listPayments,
  listReviews, deleteReview,
};
