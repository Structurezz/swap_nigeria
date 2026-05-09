const Listing = require('../../models/Listing');
const Category = require('../../models/Category');

const SORT_MAP = {
  newest: { isBoosted: -1, createdAt: -1 },
  oldest: { createdAt: 1 },
  value_asc: { estimatedValue: 1 },
  value_desc: { estimatedValue: -1 },
  popular: { viewCount: -1 },
};

const createListing = async (userId, data) => {
  const listing = await Listing.create({ ...data, userId });
  return listing.toJSON();
};

const getListing = async (listingId, incrementView = false) => {
  const listing = await Listing.findById(listingId)
    .populate('userId', 'fullName avatarUrl ratingAvg ratingCount verification locationState locationLga')
    .populate('categoryId', 'name slug');

  if (!listing) throw Object.assign(new Error('Listing not found'), { status: 404 });

  if (incrementView) {
    await Listing.findByIdAndUpdate(listingId, { $inc: { viewCount: 1 } });
  }

  return listing.toJSON();
};

const updateListing = async (listingId, userId, updates) => {
  const listing = await Listing.findOne({ _id: listingId, userId });
  if (!listing) throw Object.assign(new Error('Listing not found or not yours'), { status: 404 });

  Object.assign(listing, updates);
  await listing.save();
  return listing.toJSON();
};

const deleteListing = async (listingId, userId) => {
  const listing = await Listing.findOne({ _id: listingId, userId });
  if (!listing) throw Object.assign(new Error('Listing not found or not yours'), { status: 404 });

  listing.status = 'deleted';
  await listing.save();
  return { message: 'Listing deleted' };
};

const searchListings = async (query) => {
  const { q, categoryId, locationState, locationLga, listingType, condition, minValue, maxValue, page, limit, sort } = query;

  const filter = { status: 'active', expiresAt: { $gt: new Date() } };

  if (q) filter.$text = { $search: q };
  if (categoryId) filter.categoryId = categoryId;
  if (locationState) filter.locationState = locationState;
  if (locationLga) filter.locationLga = locationLga;
  if (listingType) filter.listingType = listingType;
  if (condition) filter.condition = condition;
  if (minValue !== undefined || maxValue !== undefined) {
    filter.estimatedValue = {};
    if (minValue !== undefined) filter.estimatedValue.$gte = minValue;
    if (maxValue !== undefined) filter.estimatedValue.$lte = maxValue;
  }

  const sortOpts = SORT_MAP[sort] || SORT_MAP.newest;
  const skip = (page - 1) * limit;

  const [listings, total] = await Promise.all([
    Listing.find(filter)
      .populate('userId', 'fullName avatarUrl verification locationState')
      .populate('categoryId', 'name slug')
      .sort(sortOpts)
      .skip(skip)
      .limit(limit),
    Listing.countDocuments(filter),
  ]);

  return {
    listings: listings.map(l => l.toJSON()),
    total,
    page,
    pages: Math.ceil(total / limit),
  };
};

const getUserListings = async (userId, status) => {
  const filter = { userId };
  if (status) filter.status = status;
  const listings = await Listing.find(filter).sort({ createdAt: -1 }).populate('categoryId', 'name slug');
  return listings.map(l => l.toJSON());
};

const addImages = async (listingId, userId, imageUrls) => {
  const listing = await Listing.findOne({ _id: listingId, userId });
  if (!listing) throw Object.assign(new Error('Listing not found or not yours'), { status: 404 });

  listing.images.push(...imageUrls);
  await listing.save();
  return listing.toJSON();
};

const getHomeFeed = async () => {
  const activeFilter = { status: 'active', expiresAt: { $gt: new Date() } };

  const [categories, boosted, fresh] = await Promise.all([
    Category.find().sort({ name: 1 }),
    Listing.find({ ...activeFilter, isBoosted: true })
      .populate('userId', 'fullName avatarUrl verification locationState')
      .populate('categoryId', 'name slug icon')
      .sort({ createdAt: -1 })
      .limit(8),
    Listing.find(activeFilter)
      .populate('userId', 'fullName avatarUrl verification locationState')
      .populate('categoryId', 'name slug icon')
      .sort({ createdAt: -1 })
      .limit(6),
  ]);

  // Fetch top 8 listings per category in parallel
  const categoryFeeds = await Promise.all(
    categories.map(async (cat) => {
      const listings = await Listing.find({ ...activeFilter, categoryId: cat._id })
        .populate('userId', 'fullName avatarUrl verification locationState')
        .populate('categoryId', 'name slug icon')
        .sort({ isBoosted: -1, viewCount: -1, createdAt: -1 })
        .limit(8);
      return {
        category: cat.toJSON(),
        listings: listings.map(l => l.toJSON()),
      };
    })
  );

  return {
    boosted: boosted.map(l => l.toJSON()),
    fresh: fresh.map(l => l.toJSON()),
    categories: categoryFeeds.filter(c => c.listings.length > 0),
  };
};

module.exports = { createListing, getListing, updateListing, deleteListing, searchListings, getUserListings, addImages, getHomeFeed };
