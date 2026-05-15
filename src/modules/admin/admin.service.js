const User = require('../../models/User');
const Listing = require('../../models/Listing');
const Swap = require('../../models/Swap');
const Payment = require('../../models/Payment');

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

const getStats = async () => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers, newUsers30d, activeUsers,
    totalListings, activeListings,
    totalSwaps, completedSwaps, disputedSwaps,
    totalPayments, revenueResult,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    User.countDocuments({ status: 'active' }),
    Listing.countDocuments({ status: { $ne: 'deleted' } }),
    Listing.countDocuments({ status: 'active' }),
    Swap.countDocuments(),
    Swap.countDocuments({ status: 'completed' }),
    Swap.countDocuments({ status: 'disputed' }),
    Payment.countDocuments({ status: 'success' }),
    Payment.aggregate([
      { $match: { status: 'success' } },
      { $group: { _id: null, total: { $sum: '$amountKobo' } } },
    ]),
  ]);

  const revenueKobo = revenueResult[0]?.total || 0;

  return {
    users: { total: totalUsers, new30d: newUsers30d, active: activeUsers },
    listings: { total: totalListings, active: activeListings },
    swaps: { total: totalSwaps, completed: completedSwaps, disputed: disputedSwaps },
    payments: { total: totalPayments, revenueNgn: Math.round(revenueKobo / 100) },
  };
};

// ─── Users ───────────────────────────────────────────────────────────────────

const listUsers = async ({ page = 1, limit = 20, search, status, isAdmin }) => {
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

  const [listings, swaps, payments] = await Promise.all([
    Listing.find({ userId }).sort({ createdAt: -1 }).limit(10).populate('categoryId', 'name'),
    Swap.find({ $or: [{ initiatorId: userId }, { receiverId: userId }] })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('initiatorId', 'fullName')
      .populate('receiverId', 'fullName'),
    Payment.find({ userId }).sort({ createdAt: -1 }).limit(10),
  ]);

  return {
    user: user.toJSON(),
    listings: listings.map(l => l.toJSON()),
    swaps: swaps.map(s => s.toJSON()),
    payments: payments.map(p => p.toJSON()),
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

// ─── Listings ─────────────────────────────────────────────────────────────────

const listListings = async ({ page = 1, limit = 20, search, status, userId }) => {
  const filter = {};
  if (search) filter.$text = { $search: search };
  if (status) filter.status = status;
  if (userId) filter.userId = userId;

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

// ─── Swaps ────────────────────────────────────────────────────────────────────

const listSwaps = async ({ page = 1, limit = 20, status, disputedOnly }) => {
  const filter = {};
  if (status) filter.status = status;
  if (disputedOnly === 'true') filter.status = 'disputed';

  const skip = (page - 1) * limit;
  const [swaps, total] = await Promise.all([
    Swap.find(filter)
      .populate('initiatorId', 'fullName phone avatarUrl')
      .populate('receiverId', 'fullName phone avatarUrl')
      .populate('initiatorListing', 'title images')
      .populate('receiverListing', 'title images')
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

// ─── Payments ─────────────────────────────────────────────────────────────────

const listPayments = async ({ page = 1, limit = 20, status, paymentType, userId }) => {
  const filter = {};
  if (status) filter.status = status;
  if (paymentType) filter.paymentType = paymentType;
  if (userId) filter.userId = userId;

  const skip = (page - 1) * limit;
  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .populate('userId', 'fullName phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Payment.countDocuments(filter),
  ]);

  return { payments: payments.map(p => p.toJSON()), total, page, pages: Math.ceil(total / limit) };
};

module.exports = {
  getStats,
  listUsers, getUserDetail, updateUserStatus, toggleAdmin,
  listListings, updateListingStatus,
  listSwaps, resolveDispute,
  listPayments,
};
