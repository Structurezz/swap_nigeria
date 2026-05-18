const router = require('express').Router();
const { validate } = require('../../middleware/validate');
const { auth } = require('../../middleware/auth');
const { otpLimiter } = require('../../middleware/rateLimiter');
const {
  sendOtpSchema, verifyOtpSchema,
  sendEmailOtpSchema, verifyEmailOtpSchema,
  registerSchema, loginSchema,
  forgotPasswordSchema, resetPasswordSchema, changePasswordSchema,
  refreshSchema, logoutSchema,
} = require('./auth.schema');
const {
  sendOtpController, verifyOtpController,
  sendEmailOtpController, verifyEmailOtpController,
  registerController, loginController,
  forgotPasswordController, resetPasswordController, changePasswordController,
  deleteAccountController,
  refreshController, logoutController,
} = require('./auth.controller');

// Phone OTP
router.post('/send-otp',  otpLimiter, validate(sendOtpSchema),  sendOtpController);
router.post('/verify-otp', validate(verifyOtpSchema), verifyOtpController);

// Email OTP
router.post('/send-email-otp',   otpLimiter, validate(sendEmailOtpSchema),   sendEmailOtpController);
router.post('/verify-email-otp', validate(verifyEmailOtpSchema), verifyEmailOtpController);

// Email / Password
router.post('/register',        validate(registerSchema),       registerController);
router.post('/login',           validate(loginSchema),          loginController);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPasswordController);
router.post('/reset-password',  validate(resetPasswordSchema),  resetPasswordController);
router.put('/change-password',  auth, validate(changePasswordSchema), changePasswordController);
router.delete('/account',       auth, deleteAccountController);

// Token management
router.post('/refresh', validate(refreshSchema), refreshController);
router.post('/logout',  validate(logoutSchema),  logoutController);

module.exports = router;
