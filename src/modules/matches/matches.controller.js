const { findMatches, getSuggestedForUser } = require('./matches.service');

const getMatchesForListing = async (req, res, next) => {
  try {
    const result = await findMatches(req.params.listingId, req.user.id, req.query);
    res.json({ data: result });
  } catch (err) { next(err); }
};

const getSuggestedController = async (req, res, next) => {
  try {
    const result = await getSuggestedForUser(req.user.id, req.query);
    res.json({ data: result });
  } catch (err) { next(err); }
};

module.exports = { getMatchesForListing, getSuggestedController };
