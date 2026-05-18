const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const redisClient = require('../../config/redis');
const User = require('../../models/User');
const { generateOtp, storeOtp, verifyOtp } = require('../../utils/otp');
const { sendOtpSms } = require('../../utils/notifications');
const { sendOtpEmail, sendPasswordResetEmail } = require('../../utils/email');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../../utils/jwt');
const { notifyWelcome } = require('../notifications/notifications.service');

let config;
try {
  config = require('../../config/env');
} catch (e) {
  config = { NODE_ENV: process.env.NODE_ENV || 'development' };
}

const generateReferralCode = () => crypto.randomBytes(4).toString('hex').toUpperCase();

const OTP_RATE_LIMIT_PREFIX = 'otp_limit:';
const REFRESH_TOKEN_PREFIX = 'refresh:';
const RESET_OTP_PREFIX = 'reset_otp:';
const EMAIL_OTP_PREFIX = 'email_otp:';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const redisGet = async (key) => { try { return await redisClient.get(key); } catch { return null; } };
const redisSet = async (key, ttl, val) => { try { await redisClient.setex(key, ttl, val); } catch {} };
const redisDel = async (key) => { try { await redisClient.del(key); } catch {} };

const buildTokens = async (user) => {
  const payload = { id: user._id.toString(), phone: user.phone, isAdmin: user.isAdmin };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  await redisSet(`${REFRESH_TOKEN_PREFIX}${user._id}`, 7 * 24 * 60 * 60, refreshToken);
  return { accessToken, refreshToken };
};

// ─── Phone OTP ────────────────────────────────────────────────────────────────
const sendOtp = async (phone) => {
  try {
    const key = `${OTP_RATE_LIMIT_PREFIX}${phone}`;
    const count = await redisClient.incr(key);
    if (count === 1) await redisClient.expire(key, 10 * 60);
    if (count > 3) {
      const ttl = await redisClient.ttl(key);
      throw Object.assign(new Error(`Too many OTP requests. Try again in ${Math.ceil(ttl / 60)} minutes`), { status: 429 });
    }
  } catch (err) {
    if (err.status === 429) throw err;
    console.warn('Redis unavailable, skipping OTP rate limit:', err.message);
  }

  const code = generateOtp();
  await storeOtp(phone, code);
  await sendOtpSms(phone, code);

  const result = { message: 'OTP sent successfully' };
  if (config.NODE_ENV !== 'production') result.code = code;
  return result;
};

const verifyOtpAndLogin = async (phone, code) => {
  const valid = await verifyOtp(phone, code);
  if (!valid) throw Object.assign(new Error('Invalid or expired OTP'), { status: 400 });

  try { await redisDel(`${OTP_RATE_LIMIT_PREFIX}${phone}`); } catch {}

  let user = await User.findOne({ phone });
  const isNewUser = !user;

  if (!user) {
    user = await User.create({ phone, status: 'active', referralCode: generateReferralCode() });
  } else if (user.status === 'suspended') {
    throw Object.assign(new Error('Account suspended. Contact support'), { status: 403 });
  } else {
    // Backfill missing referral code for existing users
    const needsSave = !user.referralCode || user.status === 'pending';
    if (!user.referralCode) user.referralCode = generateReferralCode();
    if (user.status === 'pending') user.status = 'active';
    if (needsSave) await user.save();
  }

  const { accessToken, refreshToken } = await buildTokens(user);
  // Welcome email for new users — no-op if they haven't added an email yet
  if (isNewUser) notifyWelcome(user._id).catch(() => {});
  return { accessToken, refreshToken, user: user.toJSON(), isNewUser };
};

// ─── Email OTP ────────────────────────────────────────────────────────────────
const sendEmailOtp = async (email) => {
  const normalised = email.toLowerCase().trim();
  // Rate limit: max 3 per 10 min
  try {
    const rlKey = `${OTP_RATE_LIMIT_PREFIX}email:${normalised}`;
    const count = await redisClient.incr(rlKey);
    if (count === 1) await redisClient.expire(rlKey, 10 * 60);
    if (count > 3) {
      const ttl = await redisClient.ttl(rlKey);
      throw Object.assign(new Error(`Too many OTP requests. Try again in ${Math.ceil(ttl / 60)} minutes`), { status: 429 });
    }
  } catch (err) {
    if (err.status === 429) throw err;
  }

  const code = generateOtp();
  await redisSet(`${EMAIL_OTP_PREFIX}${normalised}`, 10 * 60, code);
  await sendOtpEmail(normalised, code);

  const result = { message: 'OTP sent to your email' };
  if (config.NODE_ENV !== 'production') result.code = code;
  return result;
};

const verifyEmailOtpAndLogin = async (email, code) => {
  const normalised = email.toLowerCase().trim();
  const key = `${EMAIL_OTP_PREFIX}${normalised}`;
  const stored = await redisGet(key);
  if (!stored || stored !== code) {
    throw Object.assign(new Error('Invalid or expired OTP'), { status: 400 });
  }
  await redisDel(key);
  try { await redisDel(`${OTP_RATE_LIMIT_PREFIX}email:${normalised}`); } catch {}

  let user = await User.findOne({ email: normalised });
  const isNewUser = !user;

  if (!user) {
    user = await User.create({
      email: normalised,
      status: 'active',
      referralCode: generateReferralCode(),
    });
  } else if (user.status === 'suspended') {
    throw Object.assign(new Error('Account suspended. Contact support'), { status: 403 });
  } else {
    if (!user.referralCode) { user.referralCode = generateReferralCode(); await user.save(); }
    if (user.status === 'pending') { user.status = 'active'; await user.save(); }
  }

  const { accessToken, refreshToken } = await buildTokens(user);
  if (isNewUser) notifyWelcome(user._id).catch(() => {});
  return { accessToken, refreshToken, user: user.toJSON(), isNewUser };
};

// ─── Email / Password ─────────────────────────────────────────────────────────
const register = async ({ email, password, fullName, phone }) => {
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw Object.assign(new Error('Email already registered'), { status: 409 });

  if (phone) {
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) throw Object.assign(new Error('Phone number already in use'), { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    email: email.toLowerCase(),
    passwordHash,
    fullName,
    phone: phone || undefined,
    status: 'active',
    referralCode: generateReferralCode(),
  });

  const { accessToken, refreshToken } = await buildTokens(user);
  // Send welcome email (non-blocking)
  notifyWelcome(user._id).catch(() => {});
  return { accessToken, refreshToken, user: user.toJSON(), isNewUser: true };
};

const loginWithEmail = async ({ email, password }) => {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !user.passwordHash) {
    throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  }
  if (user.status === 'suspended') {
    throw Object.assign(new Error('Account suspended. Contact support'), { status: 403 });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw Object.assign(new Error('Invalid email or password'), { status: 401 });

  // Backfill missing referral code for existing users
  if (!user.referralCode) {
    user.referralCode = generateReferralCode();
    await user.save();
  }

  const { accessToken, refreshToken } = await buildTokens(user);
  return { accessToken, refreshToken, user: user.toJSON(), isNewUser: false };
};

// ─── Forgot / Reset password ──────────────────────────────────────────────────
const forgotPassword = async (email) => {
  const user = await User.findOne({ email: email.toLowerCase() });
  // Always respond OK to avoid email enumeration
  if (!user) return { message: 'If that email is registered, a reset code has been sent.' };

  const code = generateOtp();
  // Store reset OTP in Redis (10 min) keyed by email
  await redisSet(`${RESET_OTP_PREFIX}${email.toLowerCase()}`, 10 * 60, code);

  await sendPasswordResetEmail(email, code);

  const result = { message: 'If that email is registered, a reset code has been sent.' };
  if (config.NODE_ENV !== 'production') result.code = code;
  return result;
};

const resetPassword = async ({ email, code, newPassword }) => {
  const key = `${RESET_OTP_PREFIX}${email.toLowerCase()}`;
  const stored = await redisGet(key);

  if (!stored || stored !== code) {
    throw Object.assign(new Error('Invalid or expired reset code'), { status: 400 });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();
  await redisDel(key);

  return { message: 'Password reset successfully. Please log in.' };
};

const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await User.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  if (!user.passwordHash) {
    throw Object.assign(new Error('Your account uses phone login. Set a password first via forgot password.'), { status: 400 });
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw Object.assign(new Error('Current password is incorrect'), { status: 401 });

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();

  return { message: 'Password changed successfully' };
};

// ─── Delete account ───────────────────────────────────────────────────────────
const deleteAccount = async (userId, password) => {
  const user = await User.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  // If user has a password, verify it; phone-only users just confirm with OTP (skip here)
  if (user.passwordHash && password) {
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw Object.assign(new Error('Incorrect password'), { status: 401 });
  }

  await User.findByIdAndDelete(userId);
  await redisDel(`${REFRESH_TOKEN_PREFIX}${userId}`);

  return { message: 'Account deleted successfully' };
};

// ─── Token refresh / Logout ───────────────────────────────────────────────────
const refreshTokenService = async (token) => {
  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw Object.assign(new Error('Invalid refresh token'), { status: 401 });
  }

  const key = `${REFRESH_TOKEN_PREFIX}${payload.id}`;
  try {
    const stored = await redisClient.get(key);
    if (stored && stored !== token) {
      throw Object.assign(new Error('Refresh token revoked'), { status: 401 });
    }
  } catch (err) {
    if (err.status === 401) throw err;
    console.warn('Redis unavailable, skipping refresh token check:', err.message);
  }

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
    await redisDel(`${REFRESH_TOKEN_PREFIX}${payload.id}`);
  } catch {}
  return { message: 'Logged out successfully' };
};

// ─── Login with password then send OTP (2-step login) ────────────────────────
const loginAndSendOtp = async ({ email, password }) => {
  const normalised = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalised });
  if (!user || !user.passwordHash) {
    throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  }
  if (user.status === 'suspended') {
    throw Object.assign(new Error('Account suspended. Contact support'), { status: 403 });
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw Object.assign(new Error('Invalid email or password'), { status: 401 });

  // Credentials OK — now send OTP instead of returning tokens
  const code = generateOtp();
  await redisSet(`${EMAIL_OTP_PREFIX}${normalised}`, 10 * 60, code);
  await sendOtpEmail(normalised, code);

  const result = { message: 'OTP sent to your email', email: normalised };
  if (config.NODE_ENV !== 'production') result.code = code;
  return result;
};

module.exports = {
  sendOtp, verifyOtpAndLogin,
  sendEmailOtp, verifyEmailOtpAndLogin,
  register, loginWithEmail,
  loginAndSendOtp,
  forgotPassword, resetPassword, changePassword,
  deleteAccount,
  refreshTokenService, logout,
};
