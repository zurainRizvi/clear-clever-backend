import type { NextFunction, Request, Response } from 'express';
import { isSmtpConfigured, loadEnv } from '../config/env';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import { User } from '../models/User';
import { comparePassword, hashPassword, sanitizeUser, signToken } from '../services/auth';
import { createAndSendOtp, verifyOtpAndConsume } from '../services/otp';
import { ensureUserProfile, sanitizeUserProfile } from '../services/userProfile';
import { AppError, successResponse } from '../utils/apiResponse';
import { normalizePkPhone } from '../validators/authValidators';

export async function signup(req: AuthenticatedRequest, res: Response): Promise<void> {
  const env = loadEnv();
  const { fullName, email, phone, password } = req.body as {
    fullName: string;
    email: string;
    phone: string;
    password: string;
  };

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    throw new AppError(409, 'An account with this email already exists');
  }

  const passwordHash = await hashPassword(password);
  const user = await User.create({
    fullName: fullName.trim(),
    email: normalizedEmail,
    phone: normalizePkPhone(phone),
    passwordHash,
    role: 'user',
    status: 'pendingVerification',
  });
  const profile = await ensureUserProfile(user._id);

  const awaitOtpForDebug =
    (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') &&
    env.OTP_DEBUG &&
    !isSmtpConfigured(env);

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
      user: {
        ...sanitizeUser(user),
        profile: sanitizeUserProfile(await ensureUserProfile(user._id)),
      },
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

  if (user.status === 'pendingVerification') {
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
      user: {
        ...sanitizeUser(user),
        profile: sanitizeUserProfile(await ensureUserProfile(user._id)),
      },
    })
  );
}

export async function getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError(401, 'Authentication required');
  }
  const profile = await ensureUserProfile(req.user._id);
  res.status(200).json(
    successResponse('Profile retrieved', {
      user: {
        ...sanitizeUser(req.user),
        profile: sanitizeUserProfile(profile),
      },
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

  await profile.save();

  res.status(200).json(
    successResponse('Profile updated', {
      user: {
        ...sanitizeUser(req.user),
        profile: sanitizeUserProfile(profile),
      },
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
  await req.user.save();

  const profile = await ensureUserProfile(req.user._id);

  res.status(200).json(
    successResponse('Role updated', {
      user: {
        ...sanitizeUser(req.user),
        profile: sanitizeUserProfile(profile),
      },
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
