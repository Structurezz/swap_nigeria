const { z } = require('zod');

const envSchema = z.object({
  PORT: z.string().default('5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 chars'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),

  RESEND_API_KEY: z.string().optional().default(''),
  RESEND_FROM:    z.string().default('SwapNaija <noreply@usebarter.online>'),

  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),

  TERMII_API_KEY: z.string().optional().default(''),
  TERMII_SENDER_ID: z.string().default('SwapNaija'),

  PAYSTACK_SECRET_KEY: z.string().optional().default(''),
  PAYSTACK_PUBLIC_KEY: z.string().optional().default(''),

  GEMINI_API_KEY: z.string().optional().default(''),

  OTP_EXPIRY_MINUTES: z.string().default('5'),
  OTP_LENGTH: z.string().default('6'),
});

let config;

try {
  config = envSchema.parse(process.env);
} catch (err) {
  console.error('Invalid environment variables:');
  if (err.errors) {
    err.errors.forEach((e) => {
      console.error(`  ${e.path.join('.')}: ${e.message}`);
    });
  }
  process.exit(1);
}

module.exports = config;
