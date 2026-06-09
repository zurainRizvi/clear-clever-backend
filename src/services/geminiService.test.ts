import { loadEnv, resetEnvCache } from '../config/env';
import { applyTestEnv } from '../test/setupEnv';
import { resetAssistantUsageTracker } from './assistantUsageTracker';
import { resetGeminiUpstreamRateLimit } from './geminiUpstreamRateLimit';
import {
  buildGeminiContentsForTest,
  generateAssistantReply,
  parseRetryAfterSeconds,
  resetGeminiCallQueue,
} from './geminiService';

describe('geminiService', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    applyTestEnv({ GEMINI_API_KEY: 'test-key', GEMINI_UPSTREAM_RPM: '30' });
    resetEnvCache();
    resetGeminiCallQueue();
    resetGeminiUpstreamRateLimit();
    resetAssistantUsageTracker();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    resetGeminiCallQueue();
    resetGeminiUpstreamRateLimit();
  });

  it('serializes attachment parts as inline_data for the REST API', () => {
    const contents = buildGeminiContentsForTest({
      userMessage: 'What is in this image?',
      attachmentParts: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: 'abc123',
          },
        },
      ],
    });

    expect(contents).toHaveLength(1);
    expect(contents[0]?.parts).toEqual([
      {
        inline_data: {
          mime_type: 'image/jpeg',
          data: 'abc123',
        },
      },
      { text: 'What is in this image?' },
    ]);
  });

  it('parseRetryAfterSeconds extracts seconds from Google quota messages', () => {
    expect(parseRetryAfterSeconds('Please retry in 17.00s.')).toBe(17);
    expect(parseRetryAfterSeconds('no hint')).toBeUndefined();
  });

  it('does not retry on HTTP 429 (single upstream call)', async () => {
    let fetchCalls = 0;
    global.fetch = jest.fn(async () => {
      fetchCalls += 1;
      return new Response(
        JSON.stringify({
          error: {
            message:
              'Quota exceeded. Please retry in 22.32s. generate_content_free_tier_requests limit: 20',
          },
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    await expect(
      generateAssistantReply({
        systemInstruction: 'You are helpful.',
        userMessage: 'Hi',
        env: loadEnv(),
      })
    ).rejects.toMatchObject({
      statusCode: 429,
      message: expect.stringMatching(/daily ai quota|rate-limited|busy/i),
    });

    expect(fetchCalls).toBe(1);
  });

  it('retries at most once on HTTP 503', async () => {
    let fetchCalls = 0;
    global.fetch = jest.fn(async () => {
      fetchCalls += 1;
      if (fetchCalls === 1) {
        return new Response(JSON.stringify({ error: { message: 'unavailable' } }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'Hello' }] } }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    const result = await generateAssistantReply({
      systemInstruction: 'You are helpful.',
      userMessage: 'Hi',
      env: loadEnv(),
    });

    expect(result.text).toBe('Hello');
    expect(fetchCalls).toBe(2);
  });
});
