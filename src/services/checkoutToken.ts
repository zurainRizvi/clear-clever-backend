import crypto from 'crypto';

const TOKEN_BYTES = 32;

export function createCheckoutToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(TOKEN_BYTES).toString('base64url');
  return { token, hash: hashCheckoutToken(token) };
}

export function hashCheckoutToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function verifyCheckoutToken(token: string, expectedHash?: string): boolean {
  if (!token || !expectedHash) {
    return false;
  }

  const actual = Buffer.from(hashCheckoutToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
