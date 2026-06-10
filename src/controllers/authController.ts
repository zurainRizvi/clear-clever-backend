import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { isBrevoConfigured, isSmtpConfigured, loadEnv } from '../config/env';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import { User } from '../models/User';
import { comparePassword, hashPassword, signToken, verifyPasswordResetToken } from '../services/auth';
import { createAndSendOtp, verifyOtpAndConsume } from '../services/otp';
import { createAndSendPasswordReset } from '../services/passwordReset';
import { buildAuthUserPayload } from '../services/insurerOnboarding';
import { ensureUserProfile, sanitizeUserProfile } from '../services/userProfile';
import { recordAuditEvent } from '../services/auditLogService';
import { AppError, successResponse } from '../utils/apiResponse';
import { normalizePkPhone } from '../validators/authValidators';
import { normalizeCnic } from '../utils/cnic';
import { assignUserCnic } from '../services/userCnicService';
import { OtpVerification } from '../models/OtpVerification';

export async function signup(req: AuthenticatedRequest, res: Response): Promise<void> {
  const env = loadEnv();
  const { fullName, email, phone, password, cnic } = req.body as {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    cnic?: string;
  };

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    throw new AppError(409, 'An account with this email already exists');
  }

  if (cnic?.trim()) {
    const normalizedCnic = normalizeCnic(cnic);
    const cnicTaken = await User.findOne({ cnic: normalizedCnic });
    if (cnicTaken) {
      throw new AppError(409, 'This CNIC is already registered to another account');
    }
  }

  const passwordHash = await hashPassword(password);
  const user = await User.create({
    fullName: fullName.trim(),
    email: normalizedEmail,
    phone: normalizePkPhone(phone),
    ...(cnic?.trim() ? { cnic: normalizeCnic(cnic) } : {}),
    passwordHash,
    role: 'user',
    status: 'pendingVerification',
  });
  const profile = await ensureUserProfile(user._id);
  void recordAuditEvent({
    action: 'User registered',
    subject: `${user.fullName} (${user.email})`,
    severity: 'low',
  }).catch(() => undefined);

  const awaitOtpForDebug =
    (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') &&
    env.OTP_DEBUG &&
    !isSmtpConfigured(env) &&
    !isBrevoConfigured(env);

  let delivery: Awaited<ReturnType<typeof createAndSendOtp>> | undefined;
  if (awaitOtpForDebug) {
    delivery = await createAndSendOtp(env, normalizedEmail, 'signup');
  } else {
    void createAndSendOtp(env, normalizedEmail, 'signup')
      .then((result) => {
        if (!result.emailSent && !result.debugCode) {
          console.error(
            `[ClearClever] OTP email not delivered to ${normalizedEmail}. Verify SMTP_* on Render (Gmail app password, SMTP_FROM matches SMTP_USER).`
          );
        }
      })
      .catch((err) => {
        console.error('[ClearClever] Background OTP send failed:', err);
      });
  }

  const payload: Record<string, unknown> = {
    email: normalizedEmail,
    profile: sanitizeUserProfile(profile),
    emailSent: delivery?.emailSent ?? null,
    message:
      delivery?.emailSent === true
        ? 'Verification code sent'
        : 'Account created. Check your inbox or resend the code on the next screen.',
  };
  if (
    delivery?.debugCode &&
    (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') &&
    env.OTP_DEBUG
  ) {
    payload.debugCode = delivery.debugCode;
  }

  res.status(201).json(successResponse('Account created. Please verify your email.', payload));
}

export async function sendOtp(req: AuthenticatedRequest, res: Response): Promise<void> {
  const env = loadEnv();
  const { email, purpose } = req.body as { email: string; purpose: 'signup' | 'reset' };

  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  if (purpose === 'signup') {
    if (!user) {
      throw new AppError(404, 'No account found for this email');
    }
    if (user.status === 'active') {
      throw new AppError(400, 'Account is already verified');
    }
  }

  if (purpose === 'reset') {
    if (!user) {
      throw new AppError(404, 'No account found for this email');
    }
    if (user.status !== 'active') {
      throw new AppError(400, 'Account must be verified before resetting password');
    }
  }

  const delivery = await createAndSendOtp(env, normalizedEmail, purpose);

  const payload: Record<string, unknown> = {
    email: normalizedEmail,
    emailSent: delivery.emailSent,
  };
  if (
    delivery.debugCode &&
    (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') &&
    env.OTP_DEBUG
  ) {
    payload.debugCode = delivery.debugCode;
  }

  res.status(200).json(successResponse('Verification code sent', payload));
}

export async function verifyOtp(req: AuthenticatedRequest, res: Response): Promise<void> {
  const env = loadEnv();
  const { email, purpose, code } = req.body as {
    email: string;
    purpose: 'signup' | 'reset';
    code: string;
  };

  const normalizedEmail = email.toLowerCase().trim();

  if (purpose === 'reset') {
    throw new AppError(400, 'Use the password reset link sent to your email instead');
  }

  await verifyOtpAndConsume(normalizedEmail, purpose, code);

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw new AppError(404, 'No account found for this email');
  }

  if (purpose === 'signup') {
    user.status = 'active';
    await user.save();
  }

  const token = signToken(env, user);

  res.status(200).json(
    successResponse('Email verified successfully', {
      token,
      user: await buildAuthUserPayload(user),
    })
  );
}

const FORGOT_PASSWORD_MESSAGE =
  'If an account exists for that email, we sent a password reset link. Check your inbox.';

export async function forgotPassword(req: AuthenticatedRequest, res: Response): Promise<void> {
  const env = loadEnv();
  const { email } = req.body as { email: string };
  const normalizedEmail = email.toLowerCase().trim();

  const user = await User.findOne({ email: normalizedEmail });

  if (user && user.status === 'active') {
    const delivery = await createAndSendPasswordReset(env, user._id.toString(), normalizedEmail);

    const payload: Record<string, unknown> = {
      message: FORGOT_PASSWORD_MESSAGE,
      emailSent: delivery.emailSent,
    };
    if (
      delivery.resetUrl &&
      (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') &&
      env.OTP_DEBUG
    ) {
      payload.resetUrl = delivery.resetUrl;
    }

    res.status(200).json(successResponse(FORGOT_PASSWORD_MESSAGE, payload));
    return;
  }

  res.status(200).json(
    successResponse(FORGOT_PASSWORD_MESSAGE, {
      message: FORGOT_PASSWORD_MESSAGE,
      emailSent: null,
    })
  );
}

export async function resetPassword(req: AuthenticatedRequest, res: Response): Promise<void> {
  const env = loadEnv();
  const { token, password } = req.body as {
    token: string;
    password: string;
    confirmPassword: string;
  };

  let payload;
  try {
    payload = verifyPasswordResetToken(env, token);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError(400, 'Password reset link has expired. Request a new one.');
    }
    throw new AppError(400, 'Invalid or expired password reset link');
  }

  const record = await OtpVerification.findById(payload.rid);
  if (
    !record ||
    record.purpose !== 'reset' ||
    record.email !== payload.email.toLowerCase().trim() ||
    record.usedAt
  ) {
    throw new AppError(400, 'Invalid or expired password reset link');
  }

  if (record.expiresAt.getTime() < Date.now()) {
    throw new AppError(400, 'Password reset link has expired. Request a new one.');
  }

  const user = await User.findById(payload.sub).select('+passwordHash');
  if (!user || user.email !== payload.email.toLowerCase().trim()) {
    throw new AppError(400, 'Invalid or expired password reset link');
  }

  if (user.status !== 'active') {
    throw new AppError(403, 'Account must be verified before resetting password');
  }

  user.passwordHash = await hashPassword(password);
  await user.save();

  record.usedAt = new Date();
  await record.save();

  res.status(200).json(
    successResponse('Password updated successfully. Sign in with your new password.', {
      message: 'Password updated successfully. Sign in with your new password.',
    })
  );
}

export async function login(req: AuthenticatedRequest, res: Response): Promise<void> {
  const env = loadEnv();
  const { email, password } = req.body as { email: string; password: string };

  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');

  if (!user) {
    throw new AppError(401, 'Invalid email or password');
  }

  if (user.status === 'pendingVerification' && user.role !== 'insurer') {
    throw new AppError(403, 'Please verify your email before signing in');
  }

  if (user.status === 'inactive') {
    throw new AppError(403, 'Account is inactive');
  }

  const passwordHash = user.passwordHash;
  if (!passwordHash) {
    throw new AppError(401, 'Invalid email or password');
  }

  const match = await comparePassword(password, passwordHash);
  if (!match) {
    throw new AppError(401, 'Invalid email or password');
  }

  const token = signToken(env, user);

  res.status(200).json(
    successResponse('Signed in successfully', {
      token,
      user: await buildAuthUserPayload(user),
    })
  );
}

export async function getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError(401, 'Authentication required');
  }
  res.status(200).json(
    successResponse('Profile retrieved', {
      user: await buildAuthUserPayload(req.user),
    })
  );
}

export async function updateMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError(401, 'Authentication required');
  }

  const profile = await ensureUserProfile(req.user._id);
  const body = req.body as {
    profilePhotoDataUrl?: string | null;
    cnic?: string;
    addressLine?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    notificationPreferences?: Partial<{
      emailUpdates: boolean;
      claimAlerts: boolean;
      policyReminders: boolean;
    }>;
  };

  if (Object.prototype.hasOwnProperty.call(body, 'profilePhotoDataUrl')) {
    profile.profilePhotoDataUrl = body.profilePhotoDataUrl || undefined;
  }

  if (body.notificationPreferences) {
    profile.notificationPreferences = {
      emailUpdates:
        body.notificationPreferences.emailUpdates ??
        profile.notificationPreferences.emailUpdates,
      claimAlerts:
        body.notificationPreferences.claimAlerts ??
        profile.notificationPreferences.claimAlerts,
      policyReminders:
        body.notificationPreferences.policyReminders ??
        profile.notificationPreferences.policyReminders,
    };
  }

  if (body.cnic?.trim()) {
    await assignUserCnic(req.user, body.cnic);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'addressLine')) {
    profile.addressLine = body.addressLine?.trim() || undefined;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'city')) {
    profile.city = body.city?.trim() || undefined;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'province')) {
    profile.province = body.province?.trim() || undefined;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'postalCode')) {
    profile.postalCode = body.postalCode?.trim() || undefined;
  }

  await profile.save();

  const freshUser = await User.findById(req.user._id);
  if (!freshUser) {
    throw new AppError(404, 'User not found');
  }

  res.status(200).json(
    successResponse('Profile updated', {
      user: await buildAuthUserPayload(freshUser),
    })
  );
}

export async function setRole(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError(401, 'Authentication required');
  }

  const { role } = req.body as { role: 'user' | 'insurer' };

  if (req.user.status !== 'active') {
    throw new AppError(403, 'Verify your email before selecting a role');
  }

  req.user.role = role;
  if (role === 'insurer') {
    req.user.status = 'pendingVerification';
  } else {
    req.user.status = 'active';
  }
  await req.user.save();

  res.status(200).json(
    successResponse('Role updated', {
      user: await buildAuthUserPayload(req.user),
    })
  );
}

/** Express async wrapper for authenticated routes */
export function asyncHandler(
  fn: (req: AuthenticatedRequest, res: Response) => Promise<void>
) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}

/** Express async wrapper for public routes */
export function asyncPublicHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}
