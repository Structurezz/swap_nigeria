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

module.exports = { getProfile, updateProfile, updateAvatar, getPublicProfile };
