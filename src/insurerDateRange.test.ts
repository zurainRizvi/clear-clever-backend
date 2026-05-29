import {
  MAX_INSURER_RANGE_DAYS,
  dayLabelsInRange,
  parseInsurerDateRange,
} from './services/insurerDateRange';

describe('insurer date range parsing', () => {
  it('keeps accepted ranges bounded for dashboard and analytics work', () => {
    const range = parseInsurerDateRange('1900-01-01', '2100-01-01');

    expect(dayLabelsInRange(range).length).toBeLessThanOrEqual(MAX_INSURER_RANGE_DAYS);
  });

  it('preserves valid custom ranges within the maximum span', () => {
    const range = parseInsurerDateRange('2026-05-01', '2026-05-18');

    expect(range.from.toISOString().slice(0, 10)).toBe('2026-05-01');
    expect(range.to.toISOString().slice(0, 10)).toBe('2026-05-18');
  });
});
