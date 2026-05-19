const { Resend } = require('resend');

let config;
try {
  config = require('../config/env');
} catch (e) {
  config = {
    RESEND_API_KEY: process.env.RESEND_API_KEY || '',
    RESEND_FROM:    process.env.RESEND_FROM    || 'SwapNaija <noreply@usebarter.online>',
    NODE_ENV:       process.env.NODE_ENV       || 'development',
    FRONTEND_URL:   process.env.FRONTEND_URL   || 'https://swapnaija.netlify.app',
  };
}

const getClient = () => new Resend(config.RESEND_API_KEY);
const FROM = () => config.RESEND_FROM || 'SwapNaija <noreply@usebarter.online>';
const FE  = () => config.FRONTEND_URL || 'https://swapnaija.netlify.app';

const logoHeader = () => `
  <div style="background: #FFFFFF; border-radius:12px; padding:16px 24px; margin-bottom:24px; text-align:center;">
    <img src="https://swapnigeria.netlify.app/swapnaija-logo.png" width="180" height="63" alt="SwapNaija" style="display:inline-block;" />
  </div>`;

const sendEmail = async ({ to, subject, html, text }) => {
  if (!config.RESEND_API_KEY) {
    console.warn(`[EMAIL] No RESEND_API_KEY set. Would send to ${to}: ${subject}`);
    return;
  }

  const { data, error } = await getClient().emails.send({
    from:    FROM(),
    to:      Array.isArray(to) ? to : [to],
    subject,
    html,
    text,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message || JSON.stringify(error)}`);
  }

  return data;
};

const sendOtpEmail = async (to, code) => {
  const subject = 'Your SwapNaija OTP Code';
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      ${logoHeader()}
      <h2 style="color: #1A1A1A;">Your verification code</h2>
      <p style="color: #666;">Use this code to verify your email address. It expires in 10 minutes.</p>
      <div style="background: #F0FDF9; border: 2px dashed #1D9E75; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
        <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1D9E75;">${code}</span>
      </div>
      <p style="color: #999; font-size: 12px;">If you didn't request this, ignore this email.</p>
    </div>
  `;
  await sendEmail({ to, subject, html, text: `Your SwapNaija OTP: ${code}` });
};

const sendPasswordResetEmail = async (to, code) => {
  const subject = 'Reset your SwapNaija password';
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      ${logoHeader()}
      <h2 style="color: #1A1A1A;">Reset your password</h2>
      <p style="color: #666;">Use this code to reset your password. It expires in 10 minutes.</p>
      <div style="background: #FFF8E6; border: 2px dashed #F59E0B; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
        <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #F59E0B;">${code}</span>
      </div>
      <p style="color: #999; font-size: 12px;">If you didn't request this, ignore this email. Your password won't change.</p>
    </div>
  `;
  await sendEmail({ to, subject, html, text: `Your SwapNaija password reset code: ${code}` });
};

module.exports = { sendEmail, sendOtpEmail, sendPasswordResetEmail };
