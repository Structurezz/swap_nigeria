const axios = require('axios');

let config;
try {
  config = require('../config/env');
} catch (e) {
  config = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    TERMII_API_KEY: process.env.TERMII_API_KEY || '',
    TERMII_SENDER_ID: process.env.TERMII_SENDER_ID || 'SwapNaija',
  };
}

const sendOtpSms = async (phone, code) => {
  if (config.NODE_ENV !== 'production') {
    console.log(`[DEV OTP] Phone: ${phone} | Code: ${code}`);
    return { success: true, dev: true, code };
  }

  // Production: use Termii SMS API
  try {
    const response = await axios.post('https://api.ng.termii.com/api/sms/send', {
      to: phone,
      from: config.TERMII_SENDER_ID,
      sms: `Your SwapNaija verification code is: ${code}. Valid for 5 minutes. Do not share this code.`,
      type: 'plain',
      api_key: config.TERMII_API_KEY,
      channel: 'generic',
    });

    return { success: true, messageId: response.data?.message_id };
  } catch (err) {
    console.error('Termii SMS error:', err.response?.data || err.message);
    throw new Error('Failed to send OTP SMS');
  }
};

const sendSystemNotification = async (userId, type, data) => {
  // For future push notification integration
  console.log(`[Notification] User: ${userId} | Type: ${type}`, data);
};

module.exports = { sendOtpSms, sendSystemNotification };
