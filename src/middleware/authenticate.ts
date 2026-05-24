import type { NextFunction, Request, Response } from 'express';
import { loadEnv } from '../config/env';
import { User } from '../models/User';
import type { IUserDocument } from '../models/User';
import { verifyToken } from '../services/auth';
import { AppError } from '../utils/apiResponse';

export interface AuthenticatedRequest extends Request {
  user?: IUserDocument;
  tokenPayload?: ReturnType<typeof verifyToken>;
}

export async function authenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new AppError(401, 'Authentication required');
    }

    const token = header.slice(7);
    const env = loadEnv();
    const payload = verifyToken(env, token);

    const user = await User.findById(payload.sub);
    if (!user) {
      throw new AppError(401, 'Invalid or expired token');
    }
    if (user.status === 'inactive') {
      throw new AppError(403, 'Account is inactive');
    }

    req.user = user;
    req.tokenPayload = payload;
    next();
  } catch (err) {
    if (err instanceof AppError) {
      next(err);
      return;
    }
    next(new AppError(401, 'Invalid or expired token'));
  }
}

export async function optionalAuthenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next();
    return;
  }

  try {
    const token = header.slice(7);
    const env = loadEnv();
    const payload = verifyToken(env, token);
    const user = await User.findById(payload.sub);
    if (user && user.status !== 'inactive') {
      req.user = user;
      req.tokenPayload = payload;
    }
  } catch {
    // Public discovery endpoints should continue to work without a valid session.
  }

  next();
}
