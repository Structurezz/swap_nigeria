const OtpCode = require('../models/OtpCode');

let config;
try {
  config = require('../config/env');
} catch (e) {
  config = {
    OTP_EXPIRY_MINUTES: process.env.OTP_EXPIRY_MINUTES || '5',
    OTP_LENGTH: process.env.OTP_LENGTH || '6',
    NODE_ENV: process.env.NODE_ENV || 'development',
  };
}

const generateOtp = () => {
  const length = parseInt(config.OTP_LENGTH, 10) || 6;
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
};

const storeOtp = async (phone, code) => {
  const expiryMinutes = parseInt(config.OTP_EXPIRY_MINUTES, 10) || 5;
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  // Invalidate any existing unused OTPs for this phone
  await OtpCode.updateMany(
    { phone, used: false },
    { $set: { used: true } }
  );

  const otpDoc = await OtpCode.create({ phone, code, expiresAt, used: false });
  return otpDoc;
};

const verifyOtp = async (phone, code) => {
  const now = new Date();

  const otpDoc = await OtpCode.findOne({
    phone,
    code,
    used: false,
    expiresAt: { $gt: now },
  }).sort({ createdAt: -1 });

  if (!otpDoc) {
    return false;
  }

  otpDoc.used = true;
  await otpDoc.save();

  return true;
};

module.exports = { generateOtp, storeOtp, verifyOtp };
