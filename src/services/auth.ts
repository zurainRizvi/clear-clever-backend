import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Env } from '../config/env';
import type { UserRole } from '../constants/roles';
import type { IUserDocument } from '../models/User';

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
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
