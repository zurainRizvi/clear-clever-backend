import { createHash } from 'crypto';

export interface ExplainCacheEntry {
  reply: string;
  policyId: string;
  policyName: string;
  score: number;
  cachedAt: number;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 200;

const cache = new Map<string, ExplainCacheEntry>();

export function buildExplainCacheKey(input: {
  userId: string;
  category: string;
  policyId: string;
  answers: Record<string, unknown>;
  score: number;
}): string {
  const answersHash = createHash('sha256')
    .update(JSON.stringify(input.answers))
    .digest('hex')
    .slice(0, 16);

  return `${input.userId}:${input.category}:${input.policyId}:${input.score}:${answersHash}`;
}

export function getExplainCacheEntry(
  key: string,
  now = Date.now(),
  ttlMs = DEFAULT_TTL_MS
): ExplainCacheEntry | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (now - entry.cachedAt > ttlMs) {
    cache.delete(key);
    return undefined;
  }
  return entry;
}

export function setExplainCacheEntry(key: string, entry: Omit<ExplainCacheEntry, 'cachedAt'>): void {
  if (cache.size >= MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, { ...entry, cachedAt: Date.now() });
}

export function resetExplainResponseCache(): void {
  cache.clear();
}
