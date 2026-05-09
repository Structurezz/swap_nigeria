const { proposeSwap, getSwap, respondToSwap, setMeetup, confirmCompletion, raiseDispute, getUserSwaps } = require('./swaps.service');

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

module.exports = { proposeSwapController, getSwapController, respondController, setMeetupController, confirmController, disputeController, getMySwapsController };
