const router = require('express').Router();
const { auth } = require('../../middleware/auth');
const {
  initializePaymentController,
  topupController,
  boostListingController,
  verifyAccountController,
  submitKycController,
  verifyPaymentController,
  getHistoryController,
  getBoostPlansController,
  webhookController,
} = require('./payments.controller');

router.post('/topup',            auth, topupController);
router.post('/boost/:listingId', auth, boostListingController);
router.post('/verify-account',   auth, verifyAccountController);
router.post('/verify-premium',   auth, submitKycController);
router.post('/initialize',       auth, initializePaymentController);
router.get('/boost-plans',       getBoostPlansController);
router.get('/verify/:reference', auth, verifyPaymentController);
router.get('/history',           auth, getHistoryController);
router.post('/webhook',          webhookController);

module.exports = router;
