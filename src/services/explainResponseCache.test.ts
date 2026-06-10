import {
  buildExplainCacheKey,
  getExplainCacheEntry,
  resetExplainResponseCache,
  setExplainCacheEntry,
} from './explainResponseCache';

describe('explainResponseCache', () => {
  beforeEach(() => {
    resetExplainResponseCache();
  });

  it('stores and retrieves entries by key', () => {
    const key = buildExplainCacheKey({
      userId: 'u1',
      category: 'home',
      policyId: 'p1',
      answers: { city: 'Karachi' },
      score: 88,
    });

    setExplainCacheEntry(key, {
      reply: 'Great match for your apartment.',
      policyId: 'p1',
      policyName: 'Home Shield',
      score: 88,
    });

    const hit = getExplainCacheEntry(key);
    expect(hit?.reply).toContain('apartment');
    expect(hit?.policyName).toBe('Home Shield');
  });

  it('expires stale entries', () => {
    const key = buildExplainCacheKey({
      userId: 'u1',
      category: 'home',
      policyId: 'p1',
      answers: {},
      score: 80,
    });

    setExplainCacheEntry(key, {
      reply: 'cached',
      policyId: 'p1',
      policyName: 'Policy',
      score: 80,
    });

    const miss = getExplainCacheEntry(key, Date.now() + 25 * 60 * 60 * 1000);
    expect(miss).toBeUndefined();
  });

  it('changes key when answers change', () => {
    const a = buildExplainCacheKey({
      userId: 'u1',
      category: 'home',
      policyId: 'p1',
      answers: { city: 'Karachi' },
      score: 88,
    });
    const b = buildExplainCacheKey({
      userId: 'u1',
      category: 'home',
      policyId: 'p1',
      answers: { city: 'Lahore' },
      score: 88,
    });
    expect(a).not.toBe(b);
  });
});
