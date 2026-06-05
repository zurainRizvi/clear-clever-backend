import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { Env } from '../config/env';
import { OtpVerification } from '../models/OtpVerification';
import { AppError } from '../utils/apiResponse';
import { signPasswordResetToken } from './auth';
import { clientAppUrls, resolvePasswordResetClientBaseUrl } from './clientUrls';
import { formatEmailError, isOutboundEmailConfigured, sendPasswordResetEmailDelivery } from './emailDelivery';

const RESET_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const BCRYPT_ROUNDS = 10;

export interface PasswordResetDeliveryResult {
  emailSent: boolean;
  resetUrl?: string;
}

async function hashInternalSecret(secret: string): Promise<string> {
  return bcrypt.hash(secret, BCRYPT_ROUNDS);
}

export async function createAndSendPasswordReset(
  env: Env,
  userId: string,
  email: string
): Promise<PasswordResetDeliveryResult> {
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await OtpVerification.findOne({
    email: normalizedEmail,
    purpose: 'reset',
    usedAt: { $exists: false },
  }).sort({ createdAt: -1 });

  if (existing && Date.now() - existing.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    const waitSec = Math.ceil(
      (RESEND_COOLDOWN_MS - (Date.now() - existing.lastSentAt.getTime())) / 1000
    );
    throw new AppError(429, `Please wait ${waitSec} seconds before requesting a new reset link`);
  }

  const internalSecret = crypto.randomBytes(32).toString('hex');
  const codeHash = await hashInternalSecret(internalSecret);
  const now = new Date();

  await OtpVerification.updateMany(
    { email: normalizedEmail, purpose: 'reset', usedAt: { $exists: false } },
    { $set: { usedAt: now } }
  );

  const record = await OtpVerification.create({
    email: normalizedEmail,
    codeHash,
    purpose: 'reset',
    expiresAt: new Date(Date.now() + RESET_TTL_MS),
    attempts: 0,
    lastSentAt: now,
  });

  const token = signPasswordResetToken(env, userId, normalizedEmail, record._id.toString());
  const resetBase = resolvePasswordResetClientBaseUrl(env.CLIENT_URL, env.NODE_ENV);
  const resetUrl = `${clientAppUrls(resetBase).resetPassword}?token=${encodeURIComponent(token)}`;

  const emailReady = isOutboundEmailConfigured(env);

  if (emailReady) {
    try {
      await sendPasswordResetEmailDelivery(env, normalizedEmail, resetUrl);
      return { emailSent: true };
    } catch (error) {
      console.error('[ClearClever] Failed to send password reset email:', formatEmailError(error));
      return { emailSent: false };
    }
  }

  if ((env.NODE_ENV === 'development' || env.NODE_ENV === 'test') && env.OTP_DEBUG) {
    if (env.NODE_ENV === 'development') {
      console.log(`[ClearClever password reset] ${normalizedEmail} → ${resetUrl}`);
    }
    return { emailSent: false, resetUrl };
  }

  if (env.NODE_ENV === 'production') {
    console.error(
      '[ClearClever] Email not configured in production — password reset link was not sent'
    );
    return { emailSent: false };
  }

  throw new AppError(
    503,
    'Email service not configured. Set SMTP_* or BREVO_* variables, or OTP_DEBUG=true for local development.'
  );
}
