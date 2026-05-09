const { z } = require('zod');

const sendOtpSchema = z.object({
  phone: z
    .string()
    .regex(/^\+234[0-9]{10}$/, 'Phone must be in Nigerian format: +234XXXXXXXXXX'),
});

const verifyOtpSchema = z.object({
  phone: z.string().min(1, 'Phone is required'),
  code: z.string().length(6, 'OTP must be exactly 6 digits'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

module.exports = { sendOtpSchema, verifyOtpSchema, refreshSchema, logoutSchema };
