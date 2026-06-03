import { resetGeminiUpstreamRateLimit, checkGeminiUpstreamRateLimit } from './geminiUpstreamRateLimit';

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
});
