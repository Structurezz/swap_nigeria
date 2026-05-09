const {
  sendOtp, verifyOtpAndLogin,
  register, loginWithEmail,
  forgotPassword, resetPassword, changePassword,
  deleteAccount,
  refreshTokenService, logout,
} = require('./auth.service');

const handle = (fn) => async (req, res, next) => {
  try {
    const result = await fn(req, res);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
};

const sendOtpController       = handle((req) => sendOtp(req.body.phone));
const verifyOtpController     = handle((req) => verifyOtpAndLogin(req.body.phone, req.body.code));
const registerController      = handle((req) => register(req.body));
const loginController         = handle((req) => loginWithEmail(req.body));
const forgotPasswordController= handle((req) => forgotPassword(req.body.email));
const resetPasswordController = handle((req) => resetPassword(req.body));
const changePasswordController= handle((req) => changePassword(req.user.id, req.body));
const deleteAccountController = handle((req) => deleteAccount(req.user.id, req.body.password));
const refreshController       = handle((req) => refreshTokenService(req.body.refreshToken));
const logoutController        = handle((req) => logout(req.body.refreshToken));

module.exports = {
  sendOtpController, verifyOtpController,
  registerController, loginController,
  forgotPasswordController, resetPasswordController, changePasswordController,
  deleteAccountController,
  refreshController, logoutController,
};
