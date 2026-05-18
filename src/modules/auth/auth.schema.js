const { z } = require('zod');

const sendOtpSchema = z.object({
  phone: z.string().regex(/^\+234[0-9]{10}$/, 'Phone must be in Nigerian format: +234XXXXXXXXXX'),
});

const verifyOtpSchema = z.object({
  phone: z.string().min(1),
  code: z.string().length(6, 'OTP must be exactly 6 digits'),
});

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2, 'Full name required').max(120),
  phone: z.string().regex(/^\+234[0-9]{10}$/).optional().or(z.literal('')),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6, 'Code must be 6 digits'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const sendEmailOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const verifyEmailOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  code: z.string().length(6, 'OTP must be exactly 6 digits'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(1),
});

module.exports = {
  sendOtpSchema, verifyOtpSchema,
  sendEmailOtpSchema, verifyEmailOtpSchema,
  registerSchema, loginSchema,
  forgotPasswordSchema, resetPasswordSchema, changePasswordSchema,
  refreshSchema, logoutSchema,
};
