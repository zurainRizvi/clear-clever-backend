import type { NextFunction, Response } from 'express';
import { Types } from 'mongoose';
import { Purchase } from '../models/Purchase';
import type { IPurchaseDocument } from '../models/Purchase';
import { User } from '../models/User';
import { verifyCheckoutToken } from '../services/checkoutToken';
import { AppError } from '../utils/apiResponse';
import type { AuthenticatedRequest } from './authenticate';

export interface CheckoutAuthenticatedRequest extends AuthenticatedRequest {
  checkoutPurchase?: IPurchaseDocument;
}

export async function authenticateCheckoutToken(
  req: CheckoutAuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const purchaseId = getPurchaseId(req);
    const token = getBearerToken(req) ?? getQueryToken(req);

    if (!purchaseId || !Types.ObjectId.isValid(purchaseId) || !token) {
      throw new AppError(401, 'Invalid or expired checkout link');
    }

    const purchase = await Purchase.findById(purchaseId).select('+checkoutTokenHash');
    if (!purchase || !verifyCheckoutToken(token, purchase.checkoutTokenHash)) {
      throw new AppError(401, 'Invalid or expired checkout link');
    }

    const user = await User.findById(purchase.userId);
    if (!user) {
      throw new AppError(401, 'Invalid or expired checkout link');
    }
    if (user.status === 'inactive') {
      throw new AppError(403, 'Account is inactive');
    }

    req.user = user;
    req.checkoutPurchase = purchase;
    next();
  } catch (err) {
    if (err instanceof AppError) {
      next(err);
      return;
    }
    next(new AppError(401, 'Invalid or expired checkout link'));
  }
}

function getPurchaseId(req: CheckoutAuthenticatedRequest): string | null {
  if (typeof req.params.id === 'string') {
    return req.params.id;
  }
  if (typeof req.query.purchaseId === 'string') {
    return req.query.purchaseId;
  }
  return null;
}

function getBearerToken(req: CheckoutAuthenticatedRequest): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return null;
  }
  const token = header.slice(7).trim();
  return token || null;
}

function getQueryToken(req: CheckoutAuthenticatedRequest): string | null {
  const token = req.query.token;
  if (typeof token !== 'string') {
    return null;
  }
  const trimmed = token.trim();
  return trimmed || null;
}
