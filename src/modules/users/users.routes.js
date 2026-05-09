const router = require('express').Router();
const { auth } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { updateProfileSchema } = require('./users.schema');
const { getMeController, updateMeController, uploadAvatarController, getPublicProfileController, getMyReferralsController, applyReferralController } = require('./users.controller');

router.get('/me', auth, getMeController);
router.patch('/me', auth, validate(updateProfileSchema), updateMeController);
router.post('/me/avatar', auth, ...uploadAvatarController);
router.get('/me/referrals', auth, getMyReferralsController);
router.post('/referral/apply', auth, applyReferralController);
router.get('/:userId', getPublicProfileController);

module.exports = router;
