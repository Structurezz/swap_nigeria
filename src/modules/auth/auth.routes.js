const router = require('express').Router();
const { validate } = require('../../middleware/validate');
const { sendOtpSchema, verifyOtpSchema, refreshSchema, logoutSchema } = require('./auth.schema');
const { sendOtpController, verifyOtpController, refreshController, logoutController } = require('./auth.controller');
const { otpLimiter } = require('../../middleware/rateLimiter');

router.post('/send-otp', otpLimiter, validate(sendOtpSchema), sendOtpController);
router.post('/verify-otp', validate(verifyOtpSchema), verifyOtpController);
router.post('/refresh', validate(refreshSchema), refreshController);
router.post('/logout', validate(logoutSchema), logoutController);

module.exports = router;
