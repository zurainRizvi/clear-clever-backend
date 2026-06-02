import { AppError } from '../utils/apiResponse';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function resetAssistantRateLimits(): void {
  buckets.clear();
}

export function checkAssistantRateLimit(key: string, limitPerMin: number): void {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 });
    return;
  }

  if (existing.count >= limitPerMin) {
    throw new AppError(429, 'Too many requests. Please try again in a minute.');
  }

  existing.count += 1;
}

export function getAssistantRateLimitStats(): {
  activeBuckets: number;
  totalTrackedRequests: number;
} {
  const now = Date.now();
  let activeBuckets = 0;
  let totalTrackedRequests = 0;

  for (const bucket of buckets.values()) {
    if (now < bucket.resetAt) {
      activeBuckets += 1;
      totalTrackedRequests += bucket.count;
    }
  }

  return { activeBuckets, totalTrackedRequests };
}

export function rateLimitKeyForRequest(input: {
  userId?: string;
  ip: string;
  route: string;
  anonymous?: boolean;
}): string {
  if (input.userId) {
    return `user:${input.userId}:${input.route}`;
  }
  return `ip:${input.ip}:${input.route}`;
}
