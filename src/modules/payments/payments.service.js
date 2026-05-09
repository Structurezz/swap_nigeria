const axios = require('axios');
const Payment = require('../../models/Payment');
const Swap = require('../../models/Swap');
const User = require('../../models/User');
const Listing = require('../../models/Listing');

let config;
try {
  config = require('../../config/env');
} catch (e) {
  config = {
    PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY || '',
    NODE_ENV: process.env.NODE_ENV || 'development',
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  };
}

const PAYSTACK_BASE = 'https://api.paystack.co';

const BOOST_PLANS = {
  '7d':  { days: 7,  amountKobo: 50000,  label: '7 days – ₦500'  },
  '30d': { days: 30, amountKobo: 150000, label: '30 days – ₦1,500' },
};

const VERIFICATION_AMOUNT_KOBO = 100000; // ₦1,000

const paystackHeaders = () => ({
  Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}`,
  'Content-Type': 'application/json',
});

// ─── Generic Paystack init ────────────────────────────────────────────────────
const _paystackInit = async ({ payment, email, metadata }) => {
  if (!config.PAYSTACK_SECRET_KEY) {
    return {
      paymentId: payment._id.toString(),
      authorizationUrl: `${config.FRONTEND_URL}/wallet?mock_ref=${payment._id}`,
      reference: `mock_${payment._id}`,
      mock: true,
    };
  }

  const paystackRes = await axios.post(
    `${PAYSTACK_BASE}/transaction/initialize`,
    {
      email,
      amount: payment.amountKobo,
      reference: payment._id.toString(),
      metadata,
    },
    { headers: paystackHeaders() }
  );

  const { authorization_url, reference } = paystackRes.data.data;
  await Payment.findByIdAndUpdate(payment._id, { paystackRef: reference });

  return {
    paymentId: payment._id.toString(),
    authorizationUrl: authorization_url,
    reference,
  };
};

// ─── Legacy: escrow payment (requires swapId) ─────────────────────────────────
const initializePayment = async (userId, data) => {
  const { swapId, amountKobo, email, paymentType = 'escrow' } = data;

  if (swapId) {
    const swap = await Swap.findById(swapId);
    if (!swap) throw Object.assign(new Error('Swap not found'), { status: 404 });
    const isParticipant =
      swap.initiatorId.toString() === userId ||
      swap.receiverId.toString() === userId;
    if (!isParticipant) throw Object.assign(new Error('Not a participant'), { status: 403 });
  }

  const payment = await Payment.create({
    userId,
    swapId: swapId || undefined,
    amountKobo,
    paymentType,
    status: 'pending',
  });

  return _paystackInit({
    payment,
    email,
    metadata: { swapId, userId, paymentType },
  });
};

// ─── Boost a listing ──────────────────────────────────────────────────────────
const initiateBoost = async (userId, listingId, plan, email) => {
  const planData = BOOST_PLANS[plan];
  if (!planData) throw Object.assign(new Error('Invalid boost plan. Use 7d or 30d'), { status: 400 });

  const listing = await Listing.findById(listingId);
  if (!listing) throw Object.assign(new Error('Listing not found'), { status: 404 });
  if (listing.userId.toString() !== userId) throw Object.assign(new Error('Not your listing'), { status: 403 });

  const payment = await Payment.create({
    userId,
    listingId,
    amountKobo: planData.amountKobo,
    paymentType: 'boost',
    status: 'pending',
    meta: { plan, days: planData.days },
  });

  return _paystackInit({
    payment,
    email,
    metadata: { listingId, userId, paymentType: 'boost', plan },
  });
};

// ─── Initiate account verification ───────────────────────────────────────────
const initiateVerification = async (userId, email) => {
  const user = await User.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  if (user.verification === 'verified') {
    throw Object.assign(new Error('Account already verified'), { status: 409 });
  }

  const payment = await Payment.create({
    userId,
    amountKobo: VERIFICATION_AMOUNT_KOBO,
    paymentType: 'verification',
    status: 'pending',
  });

  return _paystackInit({
    payment,
    email: email || user.email,
    metadata: { userId, paymentType: 'verification' },
  });
};

// ─── Verify + fulfil payment ──────────────────────────────────────────────────
const verifyPayment = async (reference) => {
  const payment = await Payment.findOne({
    $or: [{ paystackRef: reference }, { _id: reference.replace('mock_', '') }],
  });
  if (!payment) throw Object.assign(new Error('Payment not found'), { status: 404 });

  if (payment.status === 'success') return payment.toJSON(); // idempotent

  if (config.PAYSTACK_SECRET_KEY && !reference.startsWith('mock_')) {
    const paystackRes = await axios.get(
      `${PAYSTACK_BASE}/transaction/verify/${reference}`,
      { headers: paystackHeaders() }
    );
    const { status, amount } = paystackRes.data.data;
    if (status !== 'success') {
      payment.status = 'failed';
      await payment.save();
      throw Object.assign(new Error('Payment not successful'), { status: 400 });
    }
    payment.amountKobo = amount;
  }

  payment.status = 'success';
  await payment.save();

  // ── Post-payment fulfillment ──────────────────────────────────────────────
  if (payment.paymentType === 'boost' && payment.listingId) {
    const days = payment.meta?.days || 7;
    const boostExpires = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await Listing.findByIdAndUpdate(payment.listingId, {
      isBoosted: true,
      boostExpires,
    });
  }

  if (payment.paymentType === 'verification') {
    await User.findByIdAndUpdate(payment.userId, {
      verification: 'verified',
      verifiedAt: new Date(),
    });
  }

  if (payment.paymentType === 'escrow' && payment.swapId) {
    await Swap.findByIdAndUpdate(payment.swapId, {
      escrowActive: true,
      platformFeePaid: true,
    });
  }

  return payment.toJSON();
};

// ─── Payment history ──────────────────────────────────────────────────────────
const getPaymentHistory = async (userId, page = 1, limit = 20) => {
  page = parseInt(page) || 1;
  limit = parseInt(limit) || 20;

  const [payments, total] = await Promise.all([
    Payment.find({ userId })
      .populate('swapId', 'status')
      .populate('listingId', 'title')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Payment.countDocuments({ userId }),
  ]);

  return {
    payments: payments.map(p => p.toJSON()),
    total,
    page,
    pages: Math.ceil(total / limit),
  };
};

// ─── Webhook ──────────────────────────────────────────────────────────────────
const handleWebhook = async (event, data) => {
  if (event === 'charge.success') {
    const { reference } = data;
    try {
      await verifyPayment(reference);
    } catch (err) {
      console.error('Webhook payment verification failed:', err.message);
    }
  }
};

// ─── Boost plan info ──────────────────────────────────────────────────────────
const getBoostPlans = () => Object.entries(BOOST_PLANS).map(([id, p]) => ({ id, ...p }));

module.exports = {
  initializePayment,
  initiateBoost,
  initiateVerification,
  verifyPayment,
  getPaymentHistory,
  handleWebhook,
  getBoostPlans,
  VERIFICATION_AMOUNT_KOBO,
};
