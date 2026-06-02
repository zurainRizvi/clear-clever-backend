import { getAssistantHealthReport } from './assistantHealthService';
import { recordAssistantUsage, resetAssistantUsageTracker } from './assistantUsageTracker';
import { applyTestEnv } from '../test/setupEnv';

describe('assistantHealthService', () => {
  beforeEach(() => {
    resetAssistantUsageTracker();
    applyTestEnv();
  });

  it('reports not configured when GEMINI_API_KEY is missing', async () => {
    applyTestEnv({});
    const { loadEnv, resetEnvCache } = await import('../config/env');
    resetEnvCache();
    const report = await getAssistantHealthReport(loadEnv());

    expect(report.configured).toBe(false);
    expect(report.ok).toBe(false);
    expect(report.diagnostics.some((line) => line.includes('GEMINI_API_KEY'))).toBe(true);
  });

  it('includes tracked usage totals in the health report', async () => {
    applyTestEnv({});
    const { loadEnv, resetEnvCache } = await import('../config/env');
    resetEnvCache();

    recordAssistantUsage({
      route: 'chat',
      ok: true,
      latencyMs: 120,
      model: 'gemini-2.5-flash',
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    });
    recordAssistantUsage({
      route: 'chat',
      ok: false,
      latencyMs: 80,
      model: 'gemini-2.5-flash',
      statusCode: 429,
      error: 'Quota exceeded',
    });

    const report = await getAssistantHealthReport(loadEnv());

    expect(report.usage.totalApiCalls).toBe(2);
    expect(report.usage.totalTokens).toBe(150);
    expect(report.usage.rateLimitErrors).toBe(1);
    expect(report.diagnostics.some((line) => line.includes('429'))).toBe(true);
  });
});
