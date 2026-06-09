import {
  resetGeminiUpstreamRateLimit,
  checkGeminiUpstreamRateLimit,
  isGeminiDailyQuotaMessage,
  markGeminiDailyQuotaExhausted,
} from './geminiUpstreamRateLimit';

describe('geminiUpstreamRateLimit', () => {
  beforeEach(() => {
    resetGeminiUpstreamRateLimit();
  });

  it('blocks when process-wide RPM cap is exceeded', () => {
    for (let i = 0; i < 3; i += 1) {
      checkGeminiUpstreamRateLimit(3);
    }
    expect(() => checkGeminiUpstreamRateLimit(3)).toThrow(/capacity/i);
  });

  it('blocks when daily cap is exceeded', () => {
    for (let i = 0; i < 2; i += 1) {
      checkGeminiUpstreamRateLimit(10, 2);
    }
    expect(() => checkGeminiUpstreamRateLimit(10, 2)).toThrow(/daily/i);
  });

  it('detects Google daily quota error messages', () => {
    expect(
      isGeminiDailyQuotaMessage(
        'You exceeded your current quota, please check your plan and billing details. free_tier_requests'
      )
    ).toBe(true);
    expect(isGeminiDailyQuotaMessage('Please retry in 17.00s.')).toBe(false);
  });

  it('blocks after daily quota is marked exhausted externally', () => {
    markGeminiDailyQuotaExhausted();
    expect(() => checkGeminiUpstreamRateLimit(10, 100)).toThrow(/daily/i);
  });
});
