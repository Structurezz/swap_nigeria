const router = require('express').Router();
const { auth } = require('../../middleware/auth');
const { createReviewController, getUserReviewsController } = require('./reviews.controller');

router.post('/', auth, createReviewController);
router.get('/user/:userId', getUserReviewsController);

module.exports = router;
