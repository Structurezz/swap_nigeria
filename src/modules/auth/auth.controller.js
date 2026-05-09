const { sendOtp, verifyOtpAndLogin, refreshTokenService, logout } = require('./auth.service');

const sendOtpController = async (req, res, next) => {
  try {
    const result = await sendOtp(req.body.phone);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
};

const verifyOtpController = async (req, res, next) => {
  try {
    const result = await verifyOtpAndLogin(req.body.phone, req.body.code);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
};

const refreshController = async (req, res, next) => {
  try {
    const result = await refreshTokenService(req.body.refreshToken);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
};

const logoutController = async (req, res, next) => {
  try {
    const result = await logout(req.body.refreshToken);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
};

module.exports = { sendOtpController, verifyOtpController, refreshController, logoutController };
