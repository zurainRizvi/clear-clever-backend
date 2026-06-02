import { compactAssistantContext } from './assistantContextCompact';
import type { AssistantContext } from './assistantContextService';

describe('assistantContextCompact', () => {
  it('limits large context arrays before prompt serialization', () => {
    const context: AssistantContext = {
      audience: 'seeker',
      personalized: true,
      platformFaq: ['a', 'b', 'c', 'd', 'e'],
      categories: [],
      topRecommendations: Array.from({ length: 6 }, (_, index) => ({
        category: `cat-${index}`,
        policies: Array.from({ length: 5 }, (_, rank) => ({
          policyId: `${index}-${rank}`,
          name: `Policy ${rank}`,
          insurer: 'Insurer',
          premiumMonthlyPkr: 1000,
          coverageSummary: 'Coverage',
          score: 90,
          matchReasons: ['fit'],
          rank: rank + 1,
        })),
      })),
    };

    const compact = compactAssistantContext(context);

    expect(compact.platformFaq).toHaveLength(4);
    expect(compact.topRecommendations).toHaveLength(4);
    expect(compact.topRecommendations?.[0]?.policies).toHaveLength(3);
  });
});
