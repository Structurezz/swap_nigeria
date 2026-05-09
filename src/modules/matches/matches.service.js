const Listing = require('../../models/Listing');

/**
 * Smart matching: find listings whose wantsTitle/wantsDescription
 * overlaps with a given listing's title/description, filtered by location
 */
const findMatches = async (listingId, userId, options = {}) => {
  const { page = 1, limit = 20 } = options;

  const sourceListing = await Listing.findById(listingId);
  if (!sourceListing) throw Object.assign(new Error('Listing not found'), { status: 404 });

  // Build match filter: other active listings that want what we have
  const filter = {
    _id: { $ne: listingId },
    userId: { $ne: sourceListing.userId },
    status: 'active',
    expiresAt: { $gt: new Date() },
  };

  // If location provided, prefer same state
  if (sourceListing.locationState) {
    filter.locationState = sourceListing.locationState;
  }

  // Text search on wantsTitle/wantsDescription matching our title
  let listings = [];

  if (sourceListing.title) {
    const textFilter = { ...filter, $text: { $search: sourceListing.title } };
    listings = await Listing.find(textFilter)
      .populate('userId', 'fullName avatarUrl verification ratingAvg locationState locationLga')
      .populate('categoryId', 'name slug')
      .sort({ isBoosted: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
  }

  // If not enough results, fall back to category match
  if (listings.length < 5 && sourceListing.categoryId) {
    const categoryFilter = {
      ...filter,
      wantsCategoryId: sourceListing.categoryId,
      _id: { $ne: listingId, $nin: listings.map(l => l._id) },
    };
    const more = await Listing.find(categoryFilter)
      .populate('userId', 'fullName avatarUrl verification ratingAvg locationState locationLga')
      .populate('categoryId', 'name slug')
      .sort({ isBoosted: -1, createdAt: -1 })
      .limit(limit - listings.length);
    listings = [...listings, ...more];
  }

  return {
    matches: listings.map(l => l.toJSON()),
    sourceListingId: listingId,
    total: listings.length,
  };
};

const getSuggestedForUser = async (userId, options = {}) => {
  const { page = 1, limit = 20 } = options;

  // Get user's active listings
  const userListings = await Listing.find({ userId, status: 'active' }).limit(5);

  if (!userListings.length) {
    // No listings: return recent active listings from others
    const recent = await Listing.find({ userId: { $ne: userId }, status: 'active' })
      .populate('userId', 'fullName avatarUrl verification ratingAvg locationState')
      .populate('categoryId', 'name slug')
      .sort({ isBoosted: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    return { matches: recent.map(l => l.toJSON()), total: recent.length };
  }

  // Collect titles for text search
  const searchTerms = userListings.map(l => l.title).join(' ');
  const categoryIds = userListings.map(l => l.categoryId).filter(Boolean);

  const filter = {
    userId: { $ne: userId },
    status: 'active',
    expiresAt: { $gt: new Date() },
    $or: [
      { $text: { $search: searchTerms } },
      { categoryId: { $in: categoryIds } },
    ],
  };

  const [listings, total] = await Promise.all([
    Listing.find(filter)
      .populate('userId', 'fullName avatarUrl verification ratingAvg locationState')
      .populate('categoryId', 'name slug')
      .sort({ isBoosted: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Listing.countDocuments(filter),
  ]);

  return {
    matches: listings.map(l => l.toJSON()),
    total,
    page,
    pages: Math.ceil(total / limit),
  };
};

module.exports = { findMatches, getSuggestedForUser };
