const Review = require('../../models/Review');
const Swap = require('../../models/Swap');
const User = require('../../models/User');

const createReview = async (reviewerId, data) => {
  const { swapId, revieweeId, rating, comment } = data;

  // Verify swap completed and reviewer was a participant
  const swap = await Swap.findById(swapId);
  if (!swap) throw Object.assign(new Error('Swap not found'), { status: 404 });
  if (swap.status !== 'completed') throw Object.assign(new Error('Swap not yet completed'), { status: 400 });

  const isParticipant =
    swap.initiatorId.toString() === reviewerId ||
    swap.receiverId.toString() === reviewerId;
  if (!isParticipant) throw Object.assign(new Error('Not a participant'), { status: 403 });

  if (reviewerId === revieweeId) throw Object.assign(new Error('Cannot review yourself'), { status: 400 });

  // Check already reviewed
  const existing = await Review.findOne({ swapId, reviewerId });
  if (existing) throw Object.assign(new Error('Already reviewed this swap'), { status: 409 });

  const review = await Review.create({ swapId, reviewerId, revieweeId, rating, comment });

  // Update reviewee's rating average
  const allReviews = await Review.find({ revieweeId });
  const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

  await User.findByIdAndUpdate(revieweeId, {
    ratingAvg: Math.round(avg * 10) / 10,
    ratingCount: allReviews.length,
  });

  const populated = await Review.findById(review._id)
    .populate('reviewerId', 'fullName avatarUrl')
    .populate('revieweeId', 'fullName avatarUrl');

  return populated.toJSON();
};

const getUserReviews = async (userId, page = 1, limit = 20) => {
  const [reviews, total] = await Promise.all([
    Review.find({ revieweeId: userId })
      .populate('reviewerId', 'fullName avatarUrl')
      .populate('swapId', 'initiatorListing receiverListing')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Review.countDocuments({ revieweeId: userId }),
  ]);

  return {
    reviews: reviews.map(r => r.toJSON()),
    total,
    page,
    pages: Math.ceil(total / limit),
  };
};

module.exports = { createReview, getUserReviews };
