const router = require('express').Router();
const { auth } = require('../../middleware/auth');
const { getMatchesForListing, getSuggestedController } = require('./matches.controller');

router.get('/suggested', auth, getSuggestedController);
router.get('/:listingId', auth, getMatchesForListing);

module.exports = router;
