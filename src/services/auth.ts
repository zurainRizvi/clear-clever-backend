import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Env } from '../config/env';
import type { UserRole } from '../constants/roles';
import type { IUserDocument } from '../models/User';
import { maskCnic } from '../utils/cnic';

const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface PasswordResetJwtPayload {
  sub: string;
  email: string;
  typ: 'password_reset';
  rid: string;
}

const PASSWORD_RESET_EXPIRES_IN = '10m';

export function signPasswordResetToken(
  env: Env,
  userId: string,
  email: string,
  resetRecordId: string
): string {
  const payload: PasswordResetJwtPayload = {
    sub: userId,
    email,
    typ: 'password_reset',
    rid: resetRecordId,
  };
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: PASSWORD_RESET_EXPIRES_IN,
  });
}

export function verifyPasswordResetToken(env: Env, token: string): PasswordResetJwtPayload {
  const payload = jwt.verify(token, env.JWT_SECRET) as PasswordResetJwtPayload;
  if (payload.typ !== 'password_reset' || !payload.rid || !payload.sub || !payload.email) {
    throw new Error('Invalid password reset token');
  }
  return payload;
}

export function signToken(env: Env, user: IUserDocument): string {
  const payload: JwtPayload = {
    sub: user._id.toString(),
    email: user.email,
    role: user.role,
  };
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(env: Env, token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}

export function sanitizeUser(user: IUserDocument) {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    cnicMasked: user.cnic ? maskCnic(user.cnic) : undefined,
    hasCnic: Boolean(user.cnic),
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
