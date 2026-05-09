const router = require('express').Router();
const { auth } = require('../../middleware/auth');
const { initializePaymentController, verifyPaymentController, getHistoryController, webhookController } = require('./payments.controller');

router.post('/initialize', auth, initializePaymentController);
router.get('/verify/:reference', auth, verifyPaymentController);
router.get('/history', auth, getHistoryController);
router.post('/webhook', webhookController);

module.exports = router;
