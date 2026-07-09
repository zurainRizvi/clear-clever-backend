import { Types } from 'mongoose';
import type { NextFunction, Response } from 'express';
import { Purchase } from '../models/Purchase';
import { User } from '../models/User';
import { isCheckoutTokenValid } from '../services/checkoutToken';
import { AppError } from '../utils/apiResponse';
import { authenticate, type AuthenticatedRequest } from './authenticate';

type PurchaseIdSource = 'param' | 'query';

function purchaseIdFromRequest(req: AuthenticatedRequest, source: PurchaseIdSource): string {
  const value = source === 'param' ? req.params.id : req.query.purchaseId;
  return typeof value === 'string' ? value : '';
}

function checkoutTokenFromRequest(req: AuthenticatedRequest): string {
  const headerToken = req.header('x-checkout-token');
  if (headerToken?.trim()) {
    return headerToken.trim();
  }
  const queryToken = req.query.token;
  return typeof queryToken === 'string' ? queryToken.trim() : '';
}

export function authenticateCheckoutToken(source: PurchaseIdSource) {
  return async (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const purchaseId = purchaseIdFromRequest(req, source);
      const token = checkoutTokenFromRequest(req);

      if (!Types.ObjectId.isValid(purchaseId) || !token) {
        throw new AppError(401, 'Invalid or expired checkout token');
      }

      const purchase = await Purchase.findById(purchaseId);
      if (!purchase || !isCheckoutTokenValid(purchase, token)) {
        throw new AppError(401, 'Invalid or expired checkout token');
      }

      const user = await User.findById(purchase.userId);
      if (!user) {
        throw new AppError(401, 'Invalid or expired checkout token');
      }
      if (user.status === 'inactive') {
        throw new AppError(403, 'Account is inactive');
      }

      req.user = user;
      next();
    } catch (err) {
      next(err instanceof AppError ? err : new AppError(401, 'Invalid or expired checkout token'));
    }
  };
}

export function authenticateSessionOrCheckoutToken(source: PurchaseIdSource) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (req.headers.authorization?.startsWith('Bearer ')) {
      await authenticate(req, res, next);
      return;
    }

    await authenticateCheckoutToken(source)(req, res, next);
  };
}
