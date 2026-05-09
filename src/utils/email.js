const nodemailer = require('nodemailer');

let config;
try {
  config = require('../config/env');
} catch (e) {
  config = {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    SMTP_FROM: process.env.SMTP_FROM,
    NODE_ENV: process.env.NODE_ENV || 'development',
  };
}

const createTransport = () =>
  nodemailer.createTransport({
    host: config.SMTP_HOST || 'mail.orizu.online',
    port: parseInt(config.SMTP_PORT || '465'),
    secure: parseInt(config.SMTP_PORT || '465') === 465,
    auth: {
      user: config.SMTP_USER || 'noreply@orizu.online',
      pass: config.SMTP_PASS,
    },
  });

const sendEmail = async ({ to, subject, html, text }) => {
  if (!config.SMTP_PASS) {
    console.warn(`[EMAIL] No SMTP_PASS set. Would send to ${to}: ${subject}`);
    return;
  }

  const transporter = createTransport();
  await transporter.sendMail({
    from: `"SwapNaija" <${config.SMTP_FROM || config.SMTP_USER || 'noreply@orizu.online'}>`,
    to,
    subject,
    html,
    text,
  });
};

const sendOtpEmail = async (to, code) => {
  const subject = 'Your SwapNaija OTP Code';
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <div style="background: #1D9E75; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🔄 SwapNaija</h1>
      </div>
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
      <div style="background: #1D9E75; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🔄 SwapNaija</h1>
      </div>
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
