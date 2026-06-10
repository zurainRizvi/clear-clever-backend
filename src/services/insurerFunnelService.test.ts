import { buildInsurerFunnel } from './insurerFunnelService';
import type { InsurerDateRange } from './insurerDateRange';

function makeRange(): InsurerDateRange {
  const from = new Date('2025-01-01T00:00:00.000Z');
  const to = new Date('2025-01-31T23:59:59.999Z');
  return { from, to, label: 'Jan 2025' };
}

describe('buildInsurerFunnel', () => {
  it('builds a sequential cascade where each step is a subset of the previous', () => {
    const range = makeRange();
    const mid = new Date('2025-01-15T12:00:00.000Z');

    const { steps } = buildInsurerFunnel({
      range,
      questionnaireResponses: [
        { userId: 'u1', updatedAt: mid },
        { userId: 'u2', updatedAt: mid },
        { userId: 'u3', updatedAt: mid },
      ],
      currentLeads: [
        {
          userId: 'u1',
          type: 'inquiry',
          createdAt: mid,
          metadata: { source: 'recommend' },
        },
        {
          userId: 'u1',
          type: 'favorite',
          createdAt: mid,
          metadata: { source: 'favorite' },
        },
        {
          userId: 'u2',
          type: 'inquiry',
          createdAt: mid,
          metadata: { source: 'recommend' },
        },
      ] as never[],
      purchases: [
        {
          userId: 'u1',
          status: 'completed',
          createdAt: mid,
          paymentProcessedAt: mid,
          completedAt: mid,
        },
      ] as never[],
    });

    expect(steps).toHaveLength(6);
    expect(steps[0]?.users).toBe(3);
    expect(steps[1]?.users).toBe(2);
    expect(steps[2]?.users).toBe(1);
    expect(steps[6 - 1]?.users).toBe(1);

    for (let i = 1; i < steps.length; i += 1) {
      expect(steps[i]?.users).toBeLessThanOrEqual(steps[i - 1]?.users ?? 0);
      const prev = steps[i - 1]?.users ?? 0;
      const curr = steps[i]?.users ?? 0;
      if (prev > 0) {
        const pct = Number.parseInt(String(steps[i]?.conversion), 10);
        expect(pct).toBeLessThanOrEqual(100);
        expect(steps[i]?.dropOff).toBe(prev - curr);
      }
    }
  });

  it('caps conversion at 100%', () => {
    const range = makeRange();
    const mid = new Date('2025-01-10T12:00:00.000Z');

    const { steps } = buildInsurerFunnel({
      range,
      questionnaireResponses: [{ userId: 'u1', updatedAt: mid }],
      currentLeads: [
        {
          userId: 'u1',
          type: 'inquiry',
          createdAt: mid,
          metadata: { source: 'recommend' },
        },
      ] as never[],
      purchases: [],
    });

    expect(steps[1]?.conversion).toBe('100%');
  });
});
