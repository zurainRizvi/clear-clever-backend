import crypto from 'crypto';
import type { IPurchaseDocument } from '../models/Purchase';

const CHECKOUT_TOKEN_BYTES = 32;
const CHECKOUT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export interface CheckoutTokenIssue {
  token: string;
  checkoutTokenHash: string;
  checkoutTokenExpiresAt: Date;
}

export function hashCheckoutToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export function createCheckoutToken(now = new Date()): CheckoutTokenIssue {
  const token = crypto.randomBytes(CHECKOUT_TOKEN_BYTES).toString('base64url');
  return {
    token,
    checkoutTokenHash: hashCheckoutToken(token),
    checkoutTokenExpiresAt: new Date(now.getTime() + CHECKOUT_TOKEN_TTL_MS),
  };
}

export function isCheckoutTokenValid(
  purchase: Pick<IPurchaseDocument, 'checkoutTokenHash' | 'checkoutTokenExpiresAt'>,
  token: string,
  now = new Date()
): boolean {
  const expectedHash = purchase.checkoutTokenHash?.trim();
  const expiresAt = purchase.checkoutTokenExpiresAt;
  const normalizedToken = token.trim();

  if (!expectedHash || !expiresAt || !normalizedToken || expiresAt.getTime() <= now.getTime()) {
    return false;
  }

  const expected = Buffer.from(expectedHash, 'hex');
  const actual = Buffer.from(hashCheckoutToken(normalizedToken), 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}
