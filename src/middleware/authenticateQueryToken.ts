import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from './authenticate';
import { authenticate } from './authenticate';

/** Allows JWT via `?token=` for browser redirects (e.g. purchase complete). */
export async function authenticateQueryToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const queryToken = req.query.token;
  if (typeof queryToken === 'string' && queryToken.trim() && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${queryToken.trim()}`;
  }
  return authenticate(req, res, next);
}
