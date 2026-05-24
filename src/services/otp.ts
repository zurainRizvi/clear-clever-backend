import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { Env } from '../config/env';
import { isSmtpConfigured } from '../config/env';
import type { OtpPurpose } from '../constants/roles';
import { OtpVerification } from '../models/OtpVerification';
import { AppError } from '../utils/apiResponse';
import { formatSmtpError, sendOtpEmail } from './mail';

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const BCRYPT_ROUNDS = 10;

export function generateOtpCode(): string {
  return crypto.randomInt(100_000, 1_000_000).toString();
}

async function hashOtpCode(code: string): Promise<string> {
  return bcrypt.hash(code, BCRYPT_ROUNDS);
}

export async function verifyOtpCode(code: string, codeHash: string): Promise<boolean> {
  return bcrypt.compare(code, codeHash);
}

export interface OtpDeliveryResult {
  /** Dev-only when OTP_DEBUG=true and SMTP not configured */
  debugCode?: string;
  /** Whether the OTP was delivered via SMTP */
  emailSent: boolean;
}

export async function createAndSendOtp(
  env: Env,
  email: string,
  purpose: OtpPurpose
): Promise<OtpDeliveryResult> {
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await OtpVerification.findOne({
    email: normalizedEmail,
    purpose,
    usedAt: { $exists: false },
  }).sort({ createdAt: -1 });

  if (existing && Date.now() - existing.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    const waitSec = Math.ceil(
      (RESEND_COOLDOWN_MS - (Date.now() - existing.lastSentAt.getTime())) / 1000
    );
    throw new AppError(429, `Please wait ${waitSec} seconds before requesting a new code`);
  }

  const code = generateOtpCode();
  const codeHash = await hashOtpCode(code);
  const now = new Date();

  await OtpVerification.updateMany(
    { email: normalizedEmail, purpose, usedAt: { $exists: false } },
    { $set: { usedAt: now } }
  );

  await OtpVerification.create({
    email: normalizedEmail,
    codeHash,
    purpose,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
    attempts: 0,
    lastSentAt: now,
  });

  const smtpReady = isSmtpConfigured(env);

  if (smtpReady) {
    try {
      await sendOtpEmail(env, normalizedEmail, code, purpose);
      return { emailSent: true };
    } catch (error) {
      console.error('[ClearClever] Failed to send OTP email:', formatSmtpError(error));
      return { emailSent: false };
    }
  }

  if ((env.NODE_ENV === 'development' || env.NODE_ENV === 'test') && env.OTP_DEBUG) {
    if (env.NODE_ENV === 'development') {
      console.log(`[ClearClever OTP:${purpose}] ${normalizedEmail} → ${code}`);
    }
    return { debugCode: code, emailSent: false };
  }

  if (env.NODE_ENV === 'production') {
    console.error(
      '[ClearClever] SMTP not configured in production — OTP saved but email was not sent'
    );
    return { emailSent: false };
  }

  throw new AppError(
    503,
    'Email service not configured. Set SMTP_* variables or OTP_DEBUG=true for local development.'
  );
}

export async function verifyOtpAndConsume(
  email: string,
  purpose: OtpPurpose,
  code: string
): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  const record = await OtpVerification.findOne({
    email: normalizedEmail,
    purpose,
    usedAt: { $exists: false },
  }).sort({ createdAt: -1 });

  if (!record) {
    throw new AppError(400, 'Invalid or expired verification code');
  }

  if (record.expiresAt.getTime() < Date.now()) {
    throw new AppError(400, 'Verification code has expired');
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    throw new AppError(
      400,
      'Too many failed attempts. Request a new verification code.'
    );
  }

  const valid = await verifyOtpCode(code, record.codeHash);
  if (!valid) {
    record.attempts += 1;
    await record.save();
    if (record.attempts >= MAX_ATTEMPTS) {
      throw new AppError(
        400,
        'Too many failed attempts. Request a new verification code.'
      );
    }
    throw new AppError(400, 'Invalid verification code');
  }

  record.usedAt = new Date();
  await record.save();
}
