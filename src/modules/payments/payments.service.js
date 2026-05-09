const axios = require('axios');
const Payment = require('../../models/Payment');
const Swap = require('../../models/Swap');

let config;
try {
  config = require('../../config/env');
} catch (e) {
  config = {
    PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY || '',
    NODE_ENV: process.env.NODE_ENV || 'development',
  };
}

const PAYSTACK_BASE = 'https://api.paystack.co';

const paystackHeaders = () => ({
  Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}`,
  'Content-Type': 'application/json',
});

const initializePayment = async (userId, data) => {
  const { swapId, amountKobo, email, paymentType = 'escrow_fee' } = data;

  const swap = await Swap.findById(swapId);
  if (!swap) throw Object.assign(new Error('Swap not found'), { status: 404 });

  const isParticipant =
    swap.initiatorId.toString() === userId ||
    swap.receiverId.toString() === userId;
  if (!isParticipant) throw Object.assign(new Error('Not a participant'), { status: 403 });

  // Create pending payment record
  const payment = await Payment.create({
    userId,
    swapId,
    amountKobo,
    paymentType,
    status: 'pending',
    provider: 'paystack',
  });

  if (!config.PAYSTACK_SECRET_KEY) {
    // Dev mode: mock payment
    return {
      paymentId: payment._id.toString(),
      authorizationUrl: `http://localhost:5173/wallet?mock_ref=${payment._id}`,
      reference: `mock_${payment._id}`,
      mock: true,
    };
  }

  const paystackRes = await axios.post(
    `${PAYSTACK_BASE}/transaction/initialize`,
    {
      email,
      amount: amountKobo,
      reference: payment._id.toString(),
      metadata: { swapId, userId, paymentType },
    },
    { headers: paystackHeaders() }
  );

  const { authorization_url, reference } = paystackRes.data.data;

  await Payment.findByIdAndUpdate(payment._id, { reference });

  return {
    paymentId: payment._id.toString(),
    authorizationUrl: authorization_url,
    reference,
  };
};

const verifyPayment = async (reference) => {
  const payment = await Payment.findOne({ reference }).populate('swapId');
  if (!payment) throw Object.assign(new Error('Payment not found'), { status: 404 });

  if (config.PAYSTACK_SECRET_KEY) {
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

    payment.status = 'success';
    payment.amountKobo = amount;
  } else {
    // Dev mock
    payment.status = 'success';
  }

  await payment.save();

  // Update swap escrow if applicable
  if (payment.paymentType === 'escrow_fee' && payment.swapId) {
    await Swap.findByIdAndUpdate(payment.swapId, {
      escrowActive: true,
      platformFeePaid: true,
    });
  }

  return payment.toJSON();
};

const getPaymentHistory = async (userId, page = 1, limit = 20) => {
  const [payments, total] = await Promise.all([
    Payment.find({ userId })
      .populate('swapId', 'status initiatorId receiverId')
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

// Paystack webhook handler
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

module.exports = { initializePayment, verifyPayment, getPaymentHistory, handleWebhook };
