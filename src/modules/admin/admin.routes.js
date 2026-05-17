const router = require('express').Router();
const { auth, adminOnly } = require('../../middleware/auth');
const c = require('./admin.controller');

router.use(auth, adminOnly);

router.get('/stats', c.getStatsController);

router.get('/users', c.listUsersController);
router.get('/users/:id', c.getUserDetailController);
router.patch('/users/:id/status', c.updateUserStatusController);
router.patch('/users/:id/toggle-admin', c.toggleAdminController);

router.get('/listings', c.listListingsController);
router.patch('/listings/:id/status', c.updateListingStatusController);

router.get('/swaps', c.listSwapsController);
router.patch('/swaps/:id/resolve', c.resolveDisputeController);

router.get('/payments', c.listPaymentsController);

router.get('/reviews', c.listReviewsController);
router.delete('/reviews/:id', c.deleteReviewController);

module.exports = router;
