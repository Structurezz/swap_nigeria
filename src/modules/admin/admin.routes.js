const router = require('express').Router();
const { auth, adminOnly } = require('../../middleware/auth');
const c = require('./admin.controller');

router.use(auth, adminOnly);

router.get('/stats', c.getStatsController);

// Users
router.get('/users', c.listUsersController);
router.get('/users/:id', c.getUserDetailController);
router.patch('/users/:id/status', c.updateUserStatusController);
router.patch('/users/:id/toggle-admin', c.toggleAdminController);

// Listings
router.get('/listings', c.listListingsController);
router.patch('/listings/:id/status', c.updateListingStatusController);

// Swaps
router.get('/swaps', c.listSwapsController);
router.patch('/swaps/:id/resolve', c.resolveDisputeController);

// Payments
router.get('/payments', c.listPaymentsController);

module.exports = router;
