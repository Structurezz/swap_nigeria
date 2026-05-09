const crypto = require('crypto');
const { initializePayment, verifyPayment, getPaymentHistory, handleWebhook } = require('./payments.service');

let config;
try {
  config = require('../../config/env');
} catch (e) {
  config = { PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY || '' };
}

const initializePaymentController = async (req, res, next) => {
  try {
    const result = await initializePayment(req.user.id, req.body);
    res.json({ data: result });
  } catch (err) { next(err); }
};

const verifyPaymentController = async (req, res, next) => {
  try {
    const result = await verifyPayment(req.params.reference);
    res.json({ data: result });
  } catch (err) { next(err); }
};

const getHistoryController = async (req, res, next) => {
  try {
    const result = await getPaymentHistory(req.user.id, req.query.page, req.query.limit);
    res.json({ data: result });
  } catch (err) { next(err); }
};

const webhookController = async (req, res, next) => {
  try {
    // Verify Paystack signature
    if (config.PAYSTACK_SECRET_KEY) {
      const hash = crypto
        .createHmac('sha512', config.PAYSTACK_SECRET_KEY)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (hash !== req.headers['x-paystack-signature']) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    await handleWebhook(req.body.event, req.body.data);
    res.sendStatus(200);
  } catch (err) { next(err); }
};

module.exports = { initializePaymentController, verifyPaymentController, getHistoryController, webhookController };
