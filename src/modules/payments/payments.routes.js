const router = require('express').Router();
const { auth } = require('../../middleware/auth');
const {
  initializePaymentController,
  boostListingController,
  verifyAccountController,
  verifyPaymentController,
  getHistoryController,
  getBoostPlansController,
  webhookController,
} = require('./payments.controller');

router.post('/initialize', auth, initializePaymentController);
router.post('/boost/:listingId', auth, boostListingController);
router.post('/verify-account', auth, verifyAccountController);
router.get('/boost-plans', getBoostPlansController);
router.get('/verify/:reference', auth, verifyPaymentController);
router.get('/history', auth, getHistoryController);
router.post('/webhook', webhookController);

module.exports = router;
