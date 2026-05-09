const redisClient = require('../../config/redis');
const User = require('../../models/User');
const { generateOtp, storeOtp, verifyOtp } = require('../../utils/otp');
const { sendOtpSms } = require('../../utils/notifications');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../../utils/jwt');

let config;
try {
  config = require('../../config/env');
} catch (e) {
  config = { NODE_ENV: process.env.NODE_ENV || 'development' };
}

const OTP_RATE_LIMIT_PREFIX = 'otp_limit:';
const REFRESH_TOKEN_PREFIX = 'refresh:';

const sendOtp = async (phone) => {
  // Redis rate limit check: 3 per 10 min per phone (skipped if Redis unavailable)
  try {
    const rateLimitKey = `${OTP_RATE_LIMIT_PREFIX}${phone}`;
    const count = await redisClient.incr(rateLimitKey);

    if (count === 1) {
      await redisClient.expire(rateLimitKey, 10 * 60);
    }

    if (count > 3) {
      const ttl = await redisClient.ttl(rateLimitKey);
      throw Object.assign(new Error(`Too many OTP requests. Try again in ${Math.ceil(ttl / 60)} minutes`), { status: 429 });
    }
  } catch (err) {
    if (err.status === 429) throw err; // re-throw rate limit errors
    console.warn('Redis unavailable, skipping OTP rate limit:', err.message);
  }

  const code = generateOtp();
  await storeOtp(phone, code);
  await sendOtpSms(phone, code);

  const result = { message: 'OTP sent successfully' };

  // Return OTP in dev mode
  if (config.NODE_ENV !== 'production') {
    result.code = code;
  }

  return result;
};

const verifyOtpAndLogin = async (phone, code) => {
  const valid = await verifyOtp(phone, code);

  if (!valid) {
    throw Object.assign(new Error('Invalid or expired OTP'), { status: 400 });
  }

  // Reset rate limit on success
  try { await redisClient.del(`${OTP_RATE_LIMIT_PREFIX}${phone}`); } catch (_) {}

  // Upsert user
  let user = await User.findOne({ phone });
  const isNewUser = !user;

  if (!user) {
    user = await User.create({ phone, status: 'active' });
  } else if (user.status === 'suspended') {
    throw Object.assign(new Error('Account suspended. Contact support'), { status: 403 });
  } else if (user.status === 'pending') {
    user.status = 'active';
    await user.save();
  }

  const tokenPayload = {
    id: user._id.toString(),
    phone: user.phone,
    isAdmin: user.isAdmin,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  // Store refresh token in Redis (7 days)
  const refreshKey = `${REFRESH_TOKEN_PREFIX}${user._id}`;
  try { await redisClient.setex(refreshKey, 7 * 24 * 60 * 60, refreshToken); } catch (_) {}

  return {
    accessToken,
    refreshToken,
    user: user.toJSON(),
    isNewUser,
  };
};

const refreshTokenService = async (token) => {
  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch (err) {
    throw Object.assign(new Error('Invalid refresh token'), { status: 401 });
  }

  // Check Redis has this refresh token (skip check if Redis unavailable)
  const refreshKey = `${REFRESH_TOKEN_PREFIX}${payload.id}`;
  try {
    const storedToken = await redisClient.get(refreshKey);
    if (storedToken && storedToken !== token) {
      throw Object.assign(new Error('Refresh token revoked'), { status: 401 });
    }
  } catch (err) {
    if (err.status === 401) throw err;
    console.warn('Redis unavailable, skipping refresh token check:', err.message);
  }

  // Verify user still exists and is active
  const user = await User.findById(payload.id);
  if (!user || user.status === 'suspended') {
    throw Object.assign(new Error('User not found or suspended'), { status: 401 });
  }

  const newAccessToken = generateAccessToken({
    id: user._id.toString(),
    phone: user.phone,
    isAdmin: user.isAdmin,
  });

  return { accessToken: newAccessToken };
};

const logout = async (token) => {
  try {
    const payload = verifyRefreshToken(token);
    const refreshKey = `${REFRESH_TOKEN_PREFIX}${payload.id}`;
    await redisClient.del(refreshKey);
  } catch (err) {
    // Token might already be invalid, that's fine
  }
  return { message: 'Logged out successfully' };
};

module.exports = { sendOtp, verifyOtpAndLogin, refreshTokenService, logout };
