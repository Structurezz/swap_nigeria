const {
  proposeSwap, getSwap, respondToSwap,
  setDeliveryAddress, submitShipment,
  payEscrowDeposit, confirmCompletion, raiseDispute, getUserSwaps, payTopUp,
  ESCROW_PLATFORM_FEE_PCT, ESCROW_MIN_DEPOSIT_KOBO, ESCROW_DEFAULT_COLLATERAL_PCT,
} = require('./swaps.service');

const proposeSwapController = async (req, res, next) => {
  try {
    const swap = await proposeSwap(req.user.id, req.body);
    res.status(201).json({ data: swap });
  } catch (err) { next(err); }
};

const getSwapController = async (req, res, next) => {
  try {
    const swap = await getSwap(req.params.id, req.user.id);
    res.json({ data: swap });
  } catch (err) { next(err); }
};

const respondController = async (req, res, next) => {
  try {
    const swap = await respondToSwap(req.params.id, req.user.id, req.body.action);
    res.json({ data: swap });
  } catch (err) { next(err); }
};

const setAddressController = async (req, res, next) => {
  try {
    const swap = await setDeliveryAddress(req.params.id, req.user.id, req.body);
    res.json({ data: swap });
  } catch (err) { next(err); }
};

const submitShipmentController = async (req, res, next) => {
  try {
    const swap = await submitShipment(req.params.id, req.user.id, req.body);
    res.json({ data: swap });
  } catch (err) { next(err); }
};

const escrowDepositController = async (req, res, next) => {
  try {
    const swap = await payEscrowDeposit(req.params.id, req.user.id);
    res.json({ data: swap });
  } catch (err) { next(err); }
};

const escrowInfoController = (req, res) => {
  res.json({
    data: {
      platformFeePct:       ESCROW_PLATFORM_FEE_PCT,        // 0.02
      platformFeeDisplay:   `${ESCROW_PLATFORM_FEE_PCT * 100}%`, // "2%"
      minDepositKobo:       ESCROW_MIN_DEPOSIT_KOBO,
      defaultCollateralPct: ESCROW_DEFAULT_COLLATERAL_PCT,
    },
  });
};

const confirmController = async (req, res, next) => {
  try {
    const swap = await confirmCompletion(req.params.id, req.user.id);
    res.json({ data: swap });
  } catch (err) { next(err); }
};

const disputeController = async (req, res, next) => {
  try {
    const swap = await raiseDispute(req.params.id, req.user.id, req.body.reason);
    res.json({ data: swap });
  } catch (err) { next(err); }
};

const getMySwapsController = async (req, res, next) => {
  try {
    const { status, page, limit } = req.query;
    const result = await getUserSwaps(
      req.user.id,
      status,
      page  ? parseInt(page)  : 1,
      limit ? parseInt(limit) : 20,
    );
    res.json({ data: result });
  } catch (err) { next(err); }
};

const topUpController = async (req, res, next) => {
  try {
    const swap = await payTopUp(req.params.id, req.user.id);
    res.json({ data: swap });
  } catch (err) { next(err); }
};

module.exports = {
  proposeSwapController, getSwapController, respondController,
  setAddressController, submitShipmentController,
  escrowDepositController, escrowInfoController,
  confirmController, disputeController, getMySwapsController, topUpController,
};
