const { createListing, getListing, updateListing, deleteListing, searchListings, getUserListings, addImages, getHomeFeed } = require('./listings.service');
const { uploadMultiple, uploadToGridFS, fileUrl } = require('../../utils/upload');

const createListingController = async (req, res, next) => {
  try {
    const listing = await createListing(req.user.id, req.body);
    res.status(201).json({ data: listing });
  } catch (err) { next(err); }
};

const getListingController = async (req, res, next) => {
  try {
    const listing = await getListing(req.params.id, true);
    res.json({ data: listing });
  } catch (err) { next(err); }
};

const updateListingController = async (req, res, next) => {
  try {
    const listing = await updateListing(req.params.id, req.user.id, req.body);
    res.json({ data: listing });
  } catch (err) { next(err); }
};

const deleteListingController = async (req, res, next) => {
  try {
    const result = await deleteListing(req.params.id, req.user.id);
    res.json({ data: result });
  } catch (err) { next(err); }
};

const searchListingsController = async (req, res, next) => {
  try {
    const result = await searchListings(req.query);
    res.json({ data: result });
  } catch (err) { next(err); }
};

const getMyListingsController = async (req, res, next) => {
  try {
    const listings = await getUserListings(req.user.id, req.query.status);
    res.json({ data: listings });
  } catch (err) { next(err); }
};

const uploadImagesController = [
  uploadMultiple('images', 8),
  async (req, res, next) => {
    try {
      if (!req.files || !req.files.length) {
        return res.status(400).json({ error: 'No images uploaded' });
      }
      const urls = await Promise.all(
        req.files.map((f) =>
          uploadToGridFS(f.buffer, f.originalname, f.mimetype).then((id) => fileUrl(id))
        )
      );
      const listing = await addImages(req.params.id, req.user.id, urls);
      res.json({ data: listing });
    } catch (err) { next(err); }
  },
];

const getHomeFeedController = async (req, res, next) => {
  try {
    const result = await getHomeFeed();
    res.json({ data: result });
  } catch (err) { next(err); }
};

module.exports = {
  createListingController,
  getListingController,
  updateListingController,
  deleteListingController,
  searchListingsController,
  getMyListingsController,
  uploadImagesController,
  getHomeFeedController,
};
