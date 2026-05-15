const svc = require('./admin.service');

const getStatsController = async (req, res, next) => {
  try {
    const data = await svc.getStats();
    res.json({ data });
  } catch (err) { next(err); }
};

// Users
const listUsersController = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, status, isAdmin } = req.query;
    const data = await svc.listUsers({ page: +page, limit: +limit, search, status, isAdmin });
    res.json({ data });
  } catch (err) { next(err); }
};

const getUserDetailController = async (req, res, next) => {
  try {
    const data = await svc.getUserDetail(req.params.id);
    res.json({ data });
  } catch (err) { next(err); }
};

const updateUserStatusController = async (req, res, next) => {
  try {
    const { status } = req.body;
    const data = await svc.updateUserStatus(req.params.id, status);
    res.json({ data });
  } catch (err) { next(err); }
};

const toggleAdminController = async (req, res, next) => {
  try {
    const data = await svc.toggleAdmin(req.params.id, req.user.id);
    res.json({ data });
  } catch (err) { next(err); }
};

// Listings
const listListingsController = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, status, userId } = req.query;
    const data = await svc.listListings({ page: +page, limit: +limit, search, status, userId });
    res.json({ data });
  } catch (err) { next(err); }
};

const updateListingStatusController = async (req, res, next) => {
  try {
    const { status } = req.body;
    const data = await svc.updateListingStatus(req.params.id, status);
    res.json({ data });
  } catch (err) { next(err); }
};

// Swaps
const listSwapsController = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, disputedOnly } = req.query;
    const data = await svc.listSwaps({ page: +page, limit: +limit, status, disputedOnly });
    res.json({ data });
  } catch (err) { next(err); }
};

const resolveDisputeController = async (req, res, next) => {
  try {
    const { resolution, adminNote } = req.body;
    const data = await svc.resolveDispute(req.params.id, req.user.id, { resolution, adminNote });
    res.json({ data });
  } catch (err) { next(err); }
};

// Payments
const listPaymentsController = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, paymentType, userId } = req.query;
    const data = await svc.listPayments({ page: +page, limit: +limit, status, paymentType, userId });
    res.json({ data });
  } catch (err) { next(err); }
};

module.exports = {
  getStatsController,
  listUsersController, getUserDetailController, updateUserStatusController, toggleAdminController,
  listListingsController, updateListingStatusController,
  listSwapsController, resolveDisputeController,
  listPaymentsController,
};
