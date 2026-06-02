import { resetEnvCache } from '../config/env';

export const TEST_JWT_SECRET = 'test-jwt-secret-minimum-32-characters-long';

export function applyTestEnv(overrides: Record<string, string> = {}): void {
  resetEnvCache();
  process.env.NODE_ENV = 'test';
  process.env.PORT = '5000';
  process.env.MONGODB_URI = overrides.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/clearclever-test';
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.CLIENT_URL = overrides.CLIENT_URL ?? 'http://localhost:5173';
  process.env.API_PUBLIC_URL = overrides.API_PUBLIC_URL ?? 'http://localhost:5000';
  process.env.OTP_DEBUG = overrides.OTP_DEBUG ?? 'true';
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.BREVO_API_KEY;
  delete process.env.BREVO_SENDER_EMAIL;
  delete process.env.BREVO_SENDER_NAME;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MODEL;
  Object.assign(process.env, overrides);
}
