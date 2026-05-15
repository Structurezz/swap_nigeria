const router = require('express').Router();
const { auth } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { proposeSwapSchema, respondSwapSchema, setAddressSchema, submitShipmentSchema, disputeSchema } = require('./swaps.schema');
const {
  proposeSwapController, getSwapController, respondController,
  setAddressController, submitShipmentController,
  escrowDepositController, escrowInfoController,
  confirmController, disputeController, getMySwapsController, topUpController,
} = require('./swaps.controller');

router.get('/',                    auth, getMySwapsController);
router.post('/',                   auth, validate(proposeSwapSchema), proposeSwapController);
router.get('/escrow-info',         escrowInfoController);
router.get('/:id',                 auth, getSwapController);
router.patch('/:id/respond',       auth, validate(respondSwapSchema), respondController);
router.patch('/:id/address',       auth, validate(setAddressSchema), setAddressController);
router.patch('/:id/shipment',      auth, validate(submitShipmentSchema), submitShipmentController);
router.patch('/:id/escrow',        auth, escrowDepositController);
router.patch('/:id/confirm',       auth, confirmController);
router.patch('/:id/dispute',       auth, validate(disputeSchema), disputeController);
router.patch('/:id/topup',         auth, topUpController);

module.exports = router;
