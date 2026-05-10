const {
  proposeSwap, getSwap, respondToSwap, setMeetup,
  payEscrowDeposit, confirmCompletion, raiseDispute, getUserSwaps, payTopUp,
  ESCROW_DEPOSIT_KOBO, ESCROW_REFUND_KOBO, ESCROW_PLATFORM_FEE,
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

const setMeetupController = async (req, res, next) => {
  try {
    const swap = await setMeetup(req.params.id, req.user.id, req.body);
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
      depositKobo:    ESCROW_DEPOSIT_KOBO,
      refundKobo:     ESCROW_REFUND_KOBO,
      platformFeeKobo: ESCROW_PLATFORM_FEE,
      // Legacy fields kept for backward compat
      depositNgn:     ESCROW_DEPOSIT_KOBO / 100,
      refundNgn:      ESCROW_REFUND_KOBO  / 100,
      platformFeeNgn: ESCROW_PLATFORM_FEE / 100,
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
    const swaps = await getUserSwaps(req.user.id, req.query.status);
    res.json({ data: swaps });
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
  setMeetupController, escrowDepositController, escrowInfoController,
  confirmController, disputeController, getMySwapsController, topUpController,
};
