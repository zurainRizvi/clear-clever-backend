import {
  compactHistoryForGemini,
  HISTORY_MAX_CHARS_PER_TURN,
  HISTORY_MAX_TURNS,
  trimHistoryContent,
} from './assistantHistoryTrim';

describe('assistantHistoryTrim', () => {
  it('limits turn count and truncates long content', () => {
    const history = Array.from({ length: 12 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'model') as 'user' | 'model',
      content: `turn-${i}-${'x'.repeat(2000)}`,
    }));

    const compact = compactHistoryForGemini(history);

    expect(compact).toHaveLength(HISTORY_MAX_TURNS);
    expect(compact?.[0]?.content).toMatch(/^turn-6-/);
    expect(compact?.[0]?.content.length).toBeLessThanOrEqual(HISTORY_MAX_CHARS_PER_TURN);
    expect(compact?.[0]?.content.endsWith('…')).toBe(true);
  });

  it('returns undefined for empty history', () => {
    expect(compactHistoryForGemini([])).toBeUndefined();
    expect(compactHistoryForGemini(undefined)).toBeUndefined();
  });

  it('trimHistoryContent leaves short text unchanged', () => {
    expect(trimHistoryContent('hello')).toBe('hello');
  });
});
