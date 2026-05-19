const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Payment = require('../../models/Payment');
const Swap = require('../../models/Swap');
const User = require('../../models/User');
const Listing = require('../../models/Listing');
const N = require('../notifications/notifications.service');

let config;
try {
  config = require('../../config/env');
} catch (e) {
  config = {
    PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY || '',
    NODE_ENV: process.env.NODE_ENV || 'development',
    FRONTEND_URL: process.env.FRONTEND_URL || 'https://swapnigeria.netlify.app',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  };
}

// FRONTEND_URL is set explicitly per environment (.env / hosting vars).
// It defaults to localhost:5173 in dev and the Netlify URL in production,
// so it is the correct signal — no need to inspect NODE_ENV.
const MOCK_FRONTEND = 'http://localhost:5173';
const CALLBACK_URL  = config.FRONTEND_URL || MOCK_FRONTEND;

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

// ─── Internal: create a Paystack checkout session ─────────────────────────────
const _paystackInit = async ({ payment, email, metadata }) => {
  if (!config.PAYSTACK_SECRET_KEY) {
    // Dev mock — redirect to localhost so you can test the flow without deploying
    return {
      paymentId: payment._id.toString(),
      authorizationUrl: `${MOCK_FRONTEND}/wallet?mock_ref=${payment._id}`,
      reference: `mock_${payment._id}`,
      mock: true,
    };
  }

  let paystackRes;
  try {
    paystackRes = await axios.post(
      `${PAYSTACK_BASE}/transaction/initialize`,
      {
        email,
        amount: payment.amountKobo,
        reference: payment._id.toString(),
        // After payment Paystack redirects the user's browser here
        callback_url: `${CALLBACK_URL}/wallet?ref=${payment._id}`,
        metadata,
      },
      { headers: paystackHeaders() }
    );
  } catch (axiosErr) {
    // Surface the actual Paystack error message instead of the generic axios one
    const paystackMsg = axiosErr.response?.data?.message || axiosErr.message;
    throw Object.assign(new Error(`Paystack error: ${paystackMsg}`), { status: 502 });
  }

  const { authorization_url, reference } = paystackRes.data.data;
  await Payment.findByIdAndUpdate(payment._id, { paystackRef: reference });

  return {
    paymentId: payment._id.toString(),
    authorizationUrl: authorization_url,
    reference,
  };
};

// ─── Internal: deduct from wallet atomically, throw if insufficient ───────────
const _deductWallet = async (userId, amountKobo, session) => {
  const user = await User.findOneAndUpdate(
    { _id: userId, walletBalance: { $gte: amountKobo } },
    { $inc: { walletBalance: -amountKobo } },
    { new: true, session }
  );
  if (!user) {
    throw Object.assign(
      new Error(`Insufficient wallet balance. Please top up your wallet.`),
      { status: 402 }
    );
  }
  return user;
};

// ─── Wallet top-up via Paystack ───────────────────────────────────────────────
const initiateTopup = async (userId, amountKobo, email) => {
  if (!amountKobo || amountKobo < 10000) {
    throw Object.assign(new Error('Minimum top-up is ₦100'), { status: 400 });
  }

  const user = await User.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  // Paystack requires an email — fall back to a generated one for phone-only users
  const resolvedEmail = email || user.email
    || `${user.phone.replace(/\D/g, '')}@swapnaija.ng`;

  const payment = await Payment.create({
    userId,
    amountKobo,
    paymentType: 'topup',
    status: 'pending',
  });

  return _paystackInit({
    payment,
    email: resolvedEmail,
    metadata: { userId, paymentType: 'topup' },
  });
};

// ─── Pay for verification from wallet ────────────────────────────────────────
const initiateVerification = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  if (user.verification === 'verified') {
    throw Object.assign(new Error('Account already verified'), { status: 409 });
  }

  // Deduct from wallet
  await _deductWallet(userId, VERIFICATION_AMOUNT_KOBO);

  // Record payment as success immediately (wallet deduction = payment)
  const payment = await Payment.create({
    userId,
    amountKobo: VERIFICATION_AMOUNT_KOBO,
    paymentType: 'verification',
    status: 'success',
  });

  // Fulfil instantly
  await User.findByIdAndUpdate(userId, {
    verification: 'verified',
    verifiedAt: new Date(),
  });

  // Return fresh user balance
  const updated = await User.findById(userId);
  return {
    payment: payment.toJSON(),
    walletBalance: updated.walletBalance,
    message: 'Account verified successfully!',
  };
};

// ─── Pay for listing boost from wallet ───────────────────────────────────────
const initiateBoost = async (userId, listingId, plan) => {
  const planData = BOOST_PLANS[plan];
  if (!planData) throw Object.assign(new Error('Invalid boost plan. Use 7d or 30d'), { status: 400 });

  const listing = await Listing.findById(listingId);
  if (!listing) throw Object.assign(new Error('Listing not found'), { status: 404 });
  if (listing.userId.toString() !== userId) throw Object.assign(new Error('Not your listing'), { status: 403 });

  // Deduct from wallet
  await _deductWallet(userId, planData.amountKobo);

  // Record payment as success immediately
  const payment = await Payment.create({
    userId,
    listingId,
    amountKobo: planData.amountKobo,
    paymentType: 'boost',
    status: 'success',
    meta: { plan, days: planData.days },
  });

  // Activate boost
  const boostExpires = new Date(Date.now() + planData.days * 24 * 60 * 60 * 1000);
  await Listing.findByIdAndUpdate(listingId, { isBoosted: true, boostExpires });

  const updated = await User.findById(userId);
  return {
    payment: payment.toJSON(),
    walletBalance: updated.walletBalance,
    boostExpires,
    message: `Listing boosted for ${planData.days} days!`,
  };
};

// ─── Legacy: escrow payment (still uses Paystack directly) ────────────────────
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

  const user = await User.findById(userId);
  return _paystackInit({
    payment,
    email: email || user?.email,
    metadata: { swapId, userId, paymentType },
  });
};

// ─── Verify a Paystack payment (topup callback / webhook) ────────────────────
const verifyPayment = async (reference) => {
  const payment = await Payment.findOne({
    $or: [
      { paystackRef: reference },
      { _id: reference.replace('mock_', '') },
    ],
  });
  if (!payment) throw Object.assign(new Error('Payment not found'), { status: 404 });
  if (payment.status === 'success') return payment.toJSON(); // idempotent

  // Verify with Paystack (skip in mock mode)
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

  // ── Fulfillment ───────────────────────────────────────────────────────────
  if (payment.paymentType === 'topup') {
    await User.findByIdAndUpdate(payment.userId, {
      $inc: { walletBalance: payment.amountKobo },
    });
    // Notify user their wallet was credited
    N.notifyWalletTopup(payment.userId, payment.amountKobo).catch(() => {});
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

  const [payments, total, user] = await Promise.all([
    Payment.find({ userId })
      .populate('swapId', 'status')
      .populate('listingId', 'title')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Payment.countDocuments({ userId }),
    User.findById(userId).select('walletBalance'),
  ]);

  return {
    payments: payments.map(p => p.toJSON()),
    total,
    page,
    pages: Math.ceil(total / limit),
    walletBalance: user?.walletBalance || 0,
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

// ─── Gemini KYC document analyser ────────────────────────────────────────────
const ID_TYPE_LABELS = {
  nin:             'National Identity Number (NIN) slip',
  passport:        'International Passport',
  drivers_license: "Driver's License",
  voters_card:     "Voter's Card",
};

const _analyseKycWithGemini = async (docUrl, idType, idNumber) => {
  if (!config.GEMINI_API_KEY) {
    // No key — fall back to auto-approve
    return { approved: true, confidence: 'high', reason: 'Auto-approved (no Gemini key configured)' };
  }

  const genAI  = new GoogleGenerativeAI(config.GEMINI_API_KEY);
  const model  = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const base64Data = docUrl.replace(/^data:image\/\w+;base64,/, '');
  const mimeType   = docUrl.match(/^data:(image\/[\w+]+);base64,/)?.[1] || 'image/jpeg';

  const prompt = `You are a KYC verification system for SwapNaija, a Nigerian barter marketplace.
Analyse this ID document image.

Claimed document type: ${ID_TYPE_LABELS[idType] || idType}
User-provided ID number: ${idNumber}

Check:
1. Is this a valid government-issued Nigerian ID document (not a selfie, random photo, or blank image)?
2. Does the document type match the claimed type?
3. Does the ID number visible on the document match or closely resemble "${idNumber}"? (be lenient — partial visibility and minor formatting differences are acceptable)

Respond ONLY with a valid JSON object, no markdown, no extra text:
{"approved":true,"confidence":"high","reason":"brief explanation"}

Reject only if: the image is clearly not an ID, the document type is completely wrong, or the submission looks fraudulent.`;

  try {
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType } },
    ]);
    const text      = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) throw new Error('No JSON in Gemini response');
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('Gemini KYC analysis failed:', err.message);
    // On Gemini failure, fall back to approve so the user isn't blocked
    return { approved: true, confidence: 'low', reason: 'Fallback approval — Gemini unavailable' };
  }
};

// ─── Apply a KYC verdict (shared by submit and startup re-processor) ──────────
const KYC_DELAY_MS  = 5 * 60 * 1000; // 5 minutes
const KYC_STALE_MS  = 7 * 60 * 1000; // consider stale after 7 minutes (restart safety)

const _applyKycVerdict = (userId, verdict) => {
  setTimeout(async () => {
    try {
      if (verdict.approved) {
        await User.findByIdAndUpdate(userId, {
          'kyc.status': 'approved',
          'kyc.reviewedAt': new Date(),
          verification: 'premium',
          verifiedAt: new Date(),
        });
      } else {
        await User.findByIdAndUpdate(userId, {
          'kyc.status': 'rejected',
          'kyc.reviewedAt': new Date(),
          'kyc.rejectionReason': verdict.reason || 'Document could not be verified',
        });
      }
    } catch (err) {
      console.error('KYC verdict apply failed for user', userId, err.message);
    }
  }, KYC_DELAY_MS);
};

// ─── Re-process KYCs that were pending when server restarted ─────────────────
const reprocessStaleKycs = async () => {
  try {
    const staleThreshold = new Date(Date.now() - KYC_STALE_MS);
    const staleUsers = await User.find({
      'kyc.status': 'pending',
      'kyc.submittedAt': { $lt: staleThreshold },
    }).select('_id kyc');

    for (const u of staleUsers) {
      _analyseKycWithGemini(u.kyc.docUrl, u.kyc.idType, u.kyc.idNumber)
        .then((verdict) => _applyKycVerdict(u._id.toString(), verdict))
        .catch((err) => console.error('Stale KYC re-process error:', err.message));
    }

    if (staleUsers.length) {
      console.log(`[KYC] Re-processing ${staleUsers.length} stale pending KYC(s)`);
    }
  } catch (err) {
    console.error('[KYC] reprocessStaleKycs error:', err.message);
  }
};

// ─── Submit Premium KYC ───────────────────────────────────────────────────────
const submitPremiumKyc = async (userId, { idType, idNumber, docUrl }) => {
  const VALID_ID_TYPES = ['nin', 'passport', 'drivers_license', 'voters_card'];
  if (!VALID_ID_TYPES.includes(idType)) {
    throw Object.assign(new Error('Invalid ID type'), { status: 400 });
  }
  if (!idNumber || idNumber.trim().length < 5) {
    throw Object.assign(new Error('ID number is required'), { status: 400 });
  }
  if (!docUrl) {
    throw Object.assign(new Error('ID document photo is required'), { status: 400 });
  }

  const user = await User.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  if (user.verification === 'premium') {
    throw Object.assign(new Error('Account already has premium verification'), { status: 409 });
  }

  // Block only if a fresh pending exists (submitted within the stale window)
  const freshPending =
    user.kyc?.status === 'pending' &&
    user.kyc?.submittedAt &&
    Date.now() - new Date(user.kyc.submittedAt).getTime() < KYC_STALE_MS;

  if (freshPending) {
    throw Object.assign(new Error('Your KYC is already being processed. Please wait a few minutes.'), { status: 409 });
  }

  // Save as pending immediately
  await User.findByIdAndUpdate(userId, {
    kyc: {
      idType,
      idNumber: idNumber.trim(),
      docUrl,
      status: 'pending',
      submittedAt: new Date(),
    },
  });

  // Run Gemini analysis now (fast), apply the verdict after 5-minute delay
  _analyseKycWithGemini(docUrl, idType, idNumber.trim())
    .then((verdict) => _applyKycVerdict(userId, verdict))
    .catch((err) => console.error('KYC Gemini pipeline error:', err.message));

  const updated = await User.findById(userId);
  return {
    kyc: updated.kyc,
    message: 'KYC submitted! Your verification is being processed.',
  };
};

// ─── Boost plan info ──────────────────────────────────────────────────────────
const getBoostPlans = () => Object.entries(BOOST_PLANS).map(([id, p]) => ({ id, ...p }));

module.exports = {
  initializePayment,
  initiateTopup,
  initiateBoost,
  initiateVerification,
  submitPremiumKyc,
  reprocessStaleKycs,
  verifyPayment,
  getPaymentHistory,
  handleWebhook,
  getBoostPlans,
  VERIFICATION_AMOUNT_KOBO,
  BOOST_PLANS,
};
