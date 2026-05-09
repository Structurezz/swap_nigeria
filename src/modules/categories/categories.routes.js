const router = require('express').Router();
const Category = require('../../models/Category');

router.get('/', async (req, res, next) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json({ data: categories.map(c => c.toJSON()) });
  } catch (err) { next(err); }
});

module.exports = router;
