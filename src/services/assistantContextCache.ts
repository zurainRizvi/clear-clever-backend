import type { AssistantContext } from './assistantContextService';

const TTL_MS = 60_000;

interface CacheEntry {
  context: AssistantContext;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(userId: string, sessionKey?: string): string {
  return `${userId}:${sessionKey ?? 'default'}`;
}

export function getCachedAssistantContext(
  userId: string,
  sessionKey?: string
): AssistantContext | undefined {
  const entry = cache.get(cacheKey(userId, sessionKey));
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(cacheKey(userId, sessionKey));
    return undefined;
  }
  return entry.context;
}

export function setCachedAssistantContext(
  userId: string,
  context: AssistantContext,
  sessionKey?: string
): void {
  cache.set(cacheKey(userId, sessionKey), {
    context,
    expiresAt: Date.now() + TTL_MS,
  });
}

/** @internal test helper */
export function clearAssistantContextCacheForTests(): void {
  cache.clear();
}
