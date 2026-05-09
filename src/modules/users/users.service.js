const User = require('../../models/User');
const Listing = require('../../models/Listing');
const Review = require('../../models/Review');

const getProfile = async (userId) => {
  const user = await User.findById(userId).select('-__v');
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  return user.toJSON();
};

const updateProfile = async (userId, updates) => {
  if (updates.username) {
    const existing = await User.findOne({ username: updates.username, _id: { $ne: userId } });
    if (existing) throw Object.assign(new Error('Username already taken'), { status: 409 });
  }

  const user = await User.findByIdAndUpdate(userId, updates, { new: true, runValidators: true });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  return user.toJSON();
};

const updateAvatar = async (userId, avatarUrl) => {
  const user = await User.findByIdAndUpdate(userId, { avatarUrl }, { new: true });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  return user.toJSON();
};

const getPublicProfile = async (userId) => {
  const user = await User.findById(userId).select('fullName username avatarUrl bio locationState locationLga ratingAvg ratingCount swapCount verification verifiedAt createdAt');
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  const listings = await Listing.find({ userId, status: 'active' }).limit(10).sort({ createdAt: -1 });
  const reviews = await Review.find({ revieweeId: userId }).populate('reviewerId', 'fullName avatarUrl').limit(10).sort({ createdAt: -1 });

  return {
    user: user.toJSON(),
    listings: listings.map(l => l.toJSON()),
    reviews: reviews.map(r => r.toJSON()),
  };
};

const getMyReferrals = async (userId) => {
  const user = await User.findById(userId).select('referralCode referralCount swapCredits fullName');
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  const referrals = await User.find({ referredBy: userId })
    .select('fullName createdAt')
    .sort({ createdAt: -1 })
    .limit(50);

  return {
    referralCode: user.referralCode,
    referralCount: user.referralCount,
    swapCredits: user.swapCredits,
    referrals: referrals.map(r => ({
      id: r._id.toString(),
      name: r.fullName || 'SwapNaija User',
      joinedAt: r.createdAt,
    })),
  };
};

const REFERRAL_CREDIT = 200; // ₦200 in swap credits per referral

const applyReferral = async (userId, code) => {
  if (!code) throw Object.assign(new Error('Referral code is required'), { status: 400 });

  const me = await User.findById(userId);
  if (!me) throw Object.assign(new Error('User not found'), { status: 404 });
  if (me.referredBy) throw Object.assign(new Error('You have already used a referral code'), { status: 409 });

  const referrer = await User.findOne({ referralCode: code.toUpperCase() });
  if (!referrer) throw Object.assign(new Error('Invalid referral code'), { status: 404 });
  if (referrer._id.toString() === userId) throw Object.assign(new Error('Cannot use your own referral code'), { status: 400 });

  // Credit both parties
  await Promise.all([
    User.findByIdAndUpdate(userId, {
      referredBy: referrer._id,
      $inc: { swapCredits: REFERRAL_CREDIT },
    }),
    User.findByIdAndUpdate(referrer._id, {
      $inc: { referralCount: 1, swapCredits: REFERRAL_CREDIT },
    }),
  ]);

  return { message: `Referral applied! You both earned ₦${REFERRAL_CREDIT} swap credits.` };
};

module.exports = { getProfile, updateProfile, updateAvatar, getPublicProfile, getMyReferrals, applyReferral };
