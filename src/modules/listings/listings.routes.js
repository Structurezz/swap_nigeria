const router = require('express').Router();
const { auth } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { createListingSchema, updateListingSchema } = require('./listings.schema');
const {
  createListingController, getListingController, updateListingController,
  deleteListingController, searchListingsController, getMyListingsController,
  uploadImagesController, getHomeFeedController,
} = require('./listings.controller');

router.get('/home-feed', getHomeFeedController);
router.get('/', searchListingsController);
router.post('/', auth, validate(createListingSchema), createListingController);
router.get('/mine', auth, getMyListingsController);
router.get('/:id', getListingController);
router.patch('/:id', auth, validate(updateListingSchema), updateListingController);
router.delete('/:id', auth, deleteListingController);
router.post('/:id/images', auth, ...uploadImagesController);

module.exports = router;
