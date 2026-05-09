const router = require('express').Router();
const { auth } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { updateProfileSchema } = require('./users.schema');
const { getMeController, updateMeController, uploadAvatarController, getPublicProfileController } = require('./users.controller');

router.get('/me', auth, getMeController);
router.patch('/me', auth, validate(updateProfileSchema), updateMeController);
router.post('/me/avatar', auth, ...uploadAvatarController);
router.get('/:userId', getPublicProfileController);

module.exports = router;
