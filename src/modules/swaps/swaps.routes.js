const router = require('express').Router();
const { auth } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { proposeSwapSchema, respondSwapSchema, setMeetupSchema, disputeSchema } = require('./swaps.schema');
const {
  proposeSwapController, getSwapController, respondController,
  setMeetupController, confirmController, disputeController, getMySwapsController,
} = require('./swaps.controller');

router.get('/', auth, getMySwapsController);
router.post('/', auth, validate(proposeSwapSchema), proposeSwapController);
router.get('/:id', auth, getSwapController);
router.patch('/:id/respond', auth, validate(respondSwapSchema), respondController);
router.patch('/:id/meetup', auth, validate(setMeetupSchema), setMeetupController);
router.patch('/:id/confirm', auth, confirmController);
router.patch('/:id/dispute', auth, validate(disputeSchema), disputeController);

module.exports = router;
