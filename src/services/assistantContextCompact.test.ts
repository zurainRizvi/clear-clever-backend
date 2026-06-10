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

    expect(compact.platformFaq).toHaveLength(3);
    expect(compact.topRecommendations).toHaveLength(4);
    expect(compact.topRecommendations?.[0]?.policies).toHaveLength(3);
    expect(compact.topRecommendations?.[0]?.policies[0]?.matchReasons).toHaveLength(1);

    const followUp = compactAssistantContext(context, { followUp: true });
    expect(followUp.platformFaq).toHaveLength(0);
    expect(followUp.categories).toHaveLength(0);
    expect(followUp.topRecommendations).toHaveLength(2);
  });
});
