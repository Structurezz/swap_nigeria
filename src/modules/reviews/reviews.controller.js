const { createReview, getUserReviews } = require('./reviews.service');

const createReviewController = async (req, res, next) => {
  try {
    const review = await createReview(req.user.id, req.body);
    res.status(201).json({ data: review });
  } catch (err) { next(err); }
};

const getUserReviewsController = async (req, res, next) => {
  try {
    const result = await getUserReviews(req.params.userId, req.query.page, req.query.limit);
    res.json({ data: result });
  } catch (err) { next(err); }
};

module.exports = { createReviewController, getUserReviewsController };
