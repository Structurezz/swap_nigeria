/**
 * SwapNaija — Notification Preference Routes
 * GET  /api/notifications/preferences
 * PATCH /api/notifications/preferences
 * POST /api/notifications/test          (dev only)
 * POST /api/notifications/digest/trigger (dev only — force-send a digest)
 */
const router = require('express').Router();
const { auth } = require('../../middleware/auth');
const User = require('../../models/User');
const { sendMorningDigest, sendAfternoonDigest, sendNightDigest, notifyWelcome } = require('./notifications.service');

let config;
try { config = require('../../config/env'); }
catch (e) { config = { NODE_ENV: process.env.NODE_ENV || 'development' }; }

// GET /api/notifications/preferences
router.get('/preferences', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('emailPrefs');
    const prefs = user?.emailPrefs || {};
    res.json({
      data: {
        swapUpdates: prefs.swapUpdates !== false,
        dailyDigest: prefs.dailyDigest !== false,
        marketing:   prefs.marketing   === true,
      },
    });
  } catch (err) { next(err); }
});

// PATCH /api/notifications/preferences
router.patch('/preferences', auth, async (req, res, next) => {
  try {
    const { swapUpdates, dailyDigest, marketing } = req.body;
    const update = {};
    if (typeof swapUpdates === 'boolean') update['emailPrefs.swapUpdates'] = swapUpdates;
    if (typeof dailyDigest  === 'boolean') update['emailPrefs.dailyDigest']  = dailyDigest;
    if (typeof marketing    === 'boolean') update['emailPrefs.marketing']    = marketing;

    const user = await User.findByIdAndUpdate(
      req.user.id, { $set: update }, { new: true }
    ).select('emailPrefs');

    res.json({ data: user.emailPrefs });
  } catch (err) { next(err); }
});

// POST /api/notifications/unsubscribe — one-click unsubscribe all
router.post('/unsubscribe', auth, async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      $set: {
        'emailPrefs.swapUpdates': false,
        'emailPrefs.dailyDigest': false,
        'emailPrefs.marketing':   false,
      },
    });
    res.json({ data: { message: 'Unsubscribed from all emails.' } });
  } catch (err) { next(err); }
});

// ── Dev-only routes ───────────────────────────────────────────────────────────
if (config.NODE_ENV !== 'production') {
  // POST /api/notifications/test/welcome
  router.post('/test/welcome', auth, async (req, res, next) => {
    try {
      await notifyWelcome(req.user.id);
      res.json({ data: { sent: true } });
    } catch (err) { next(err); }
  });

  // POST /api/notifications/digest/trigger  body: { type: 'morning'|'afternoon'|'night' }
  router.post('/digest/trigger', auth, async (req, res, next) => {
    try {
      const type = req.body.type || 'morning';
      if (type === 'morning')   await sendMorningDigest(req.user.id);
      if (type === 'afternoon') await sendAfternoonDigest(req.user.id);
      if (type === 'night')     await sendNightDigest(req.user.id);
      res.json({ data: { sent: true, type } });
    } catch (err) { next(err); }
  });
}

module.exports = router;
