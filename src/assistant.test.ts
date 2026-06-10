import request from 'supertest';
import { createApp } from './app';
import { loadEnv, resetEnvCache } from './config/env';
import { QuestionnaireResponse } from './models/QuestionnaireResponse';
import { SEED_DEFAULT_PASSWORD } from './seed/userSeedData';
import { seedAll } from './seed/seedCatalog';
import { applyTestEnv } from './test/setupEnv';
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from './test/mongoSetup';
import * as geminiService from './services/geminiService';
import { resetAssistantRateLimits } from './services/assistantRateLimit';
import { resetExplainResponseCache } from './services/explainResponseCache';

jest.mock('./services/geminiService', () => {
  const actual = jest.requireActual<typeof import('./services/geminiService')>(
    './services/geminiService'
  );
  return {
    ...actual,
    generateAssistantReply: jest.fn((input) => actual.generateAssistantReply(input)),
  };
});

const mockGenerate = geminiService.generateAssistantReply as jest.MockedFunction<
  typeof geminiService.generateAssistantReply
>;

describe('Assistant — Gemini proxy', () => {
  let testMongoUri = '';
  let app: ReturnType<typeof createApp>;
  let seekerToken = '';
  let insurerToken = '';

  const homeAnswers = {
    property_type: 'Apartment',
    occupancy: 'Owner occupied',
    property_value_pkr: 5000000,
    contents_cover: 'Yes — full contents',
    city: 'Karachi',
  };

  beforeAll(async () => {
    testMongoUri = await connectTestDatabase();
    applyTestEnv({ MONGODB_URI: testMongoUri });
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    applyTestEnv({ MONGODB_URI: testMongoUri });
    resetEnvCache();
    resetAssistantRateLimits();
    resetExplainResponseCache();
    mockGenerate.mockReset();
    mockGenerate.mockImplementation((input) =>
      jest
        .requireActual<typeof import('./services/geminiService')>('./services/geminiService')
        .generateAssistantReply(input)
    );
    await seedAll();

    app = createApp(loadEnv());

    const seekerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'seeker@clearclever.com', password: SEED_DEFAULT_PASSWORD });
    seekerToken = seekerLogin.body.data.token;

    const insurerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'insurer.tpl@clearclever.com', password: SEED_DEFAULT_PASSWORD });
    insurerToken = insurerLogin.body.data.token;
  });

  describe('GET /api/assistant/status', () => {
    it('reports not configured without GEMINI_API_KEY', async () => {
      const res = await request(app).get('/api/assistant/status');
      expect(res.status).toBe(200);
      expect(res.body.data.configured).toBe(false);
    });

    it('reports configured when key is set', async () => {
      applyTestEnv({ MONGODB_URI: testMongoUri, GEMINI_API_KEY: 'test-key' });
      resetEnvCache();
      app = createApp(loadEnv());

      const res = await request(app).get('/api/assistant/status');
      expect(res.status).toBe(200);
      expect(res.body.data.configured).toBe(true);
      expect(res.body.data.model).toBeTruthy();
    });
  });

  describe('POST /api/assistant/chat', () => {
    it('returns 503 when Gemini is not configured', async () => {
      const res = await request(app)
        .post('/api/assistant/chat')
        .send({ message: 'Compare pet insurance options for my dog in Lahore' });

      expect(res.status).toBe(503);
    });

    it('allows anonymous chat when configured', async () => {
      applyTestEnv({ MONGODB_URI: testMongoUri, GEMINI_API_KEY: 'test-key' });
      resetEnvCache();
      app = createApp(loadEnv());
      mockGenerate.mockResolvedValue({ text: 'ClearClever compares insurance in Pakistan.' });

      const res = await request(app)
        .post('/api/assistant/chat')
        .send({ message: 'Hello' });

      expect(res.status).toBe(200);
      expect(res.body.data.reply).toContain('ClearClever');
      expect(res.body.data.personalized).toBe(false);
    });

    it('returns personalized flag for signed-in seeker', async () => {
      applyTestEnv({ MONGODB_URI: testMongoUri, GEMINI_API_KEY: 'test-key' });
      resetEnvCache();
      app = createApp(loadEnv());
      mockGenerate.mockResolvedValue({ text: 'Hello seeker.' });

      const res = await request(app)
        .post('/api/assistant/chat')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({ message: 'What policies fit me?' });

      expect(res.status).toBe(200);
      expect(res.body.data.personalized).toBe(true);
    });

    it('forwards attachments to Gemini and accepts image-only messages', async () => {
      applyTestEnv({ MONGODB_URI: testMongoUri, GEMINI_API_KEY: 'test-key' });
      resetEnvCache();
      app = createApp(loadEnv());
      mockGenerate.mockResolvedValue({ text: 'I see a policy document in your photo.' });

      const res = await request(app)
        .post('/api/assistant/chat')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({
          attachments: [
            {
              mimeType: 'image/png',
              fileName: 'policy.png',
              dataBase64: 'aGVsbG8=',
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.reply).toContain('policy document');
      expect(mockGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          attachmentParts: [
            {
              inlineData: {
                mimeType: 'image/png',
                data: 'aGVsbG8=',
              },
            },
          ],
        })
      );
    });

    it('answers common FAQ without calling Gemini', async () => {
      applyTestEnv({ MONGODB_URI: testMongoUri, GEMINI_API_KEY: 'test-key' });
      resetEnvCache();
      app = createApp(loadEnv());

      const res = await request(app)
        .post('/api/assistant/chat')
        .send({ message: 'What is ClearClever?' });

      expect(res.status).toBe(200);
      expect(res.body.data.reply).toContain('ClearClever');
      expect(mockGenerate).not.toHaveBeenCalled();
    });

    it('rate limits anonymous chat', async () => {
      applyTestEnv({
        MONGODB_URI: testMongoUri,
        GEMINI_API_KEY: 'test-key',
        ASSISTANT_RATE_LIMIT_PER_MIN: '2',
      });
      resetEnvCache();
      app = createApp(loadEnv());
      mockGenerate.mockResolvedValue({ text: 'ok' });

      const first = await request(app).post('/api/assistant/chat').send({ message: 'a' });
      const second = await request(app).post('/api/assistant/chat').send({ message: 'b' });

      expect(first.status).toBe(200);
      expect(second.status).toBe(429);
    });
  });

  describe('POST /api/assistant/explain', () => {
    beforeEach(async () => {
      applyTestEnv({ MONGODB_URI: testMongoUri, GEMINI_API_KEY: 'test-key' });
      resetEnvCache();
      app = createApp(loadEnv());

      const seeker = await request(app)
        .post('/api/auth/login')
        .send({ email: 'seeker@clearclever.com', password: SEED_DEFAULT_PASSWORD });
      seekerToken = seeker.body.data.token;

      await request(app)
        .post('/api/recommend')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({ category: 'home', answers: homeAnswers });

      mockGenerate.mockResolvedValue({
        text: 'This policy offers strong coverage with an affordable monthly premium in PKR.',
      });
    });

    it('explains top recommendation for seeker with questionnaire', async () => {
      const res = await request(app)
        .post('/api/assistant/explain')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({ category: 'home' });

      expect(res.status).toBe(200);
      expect(res.body.data.reply).toBeTruthy();
      expect(res.body.data.policyName).toBeTruthy();
      expect(typeof res.body.data.score).toBe('number');
      expect(mockGenerate).toHaveBeenCalledTimes(1);
    });

    it('serves cached explain on repeat request without calling Gemini again', async () => {
      const first = await request(app)
        .post('/api/assistant/explain')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({ category: 'home' });
      expect(first.status).toBe(200);

      mockGenerate.mockClear();

      const second = await request(app)
        .post('/api/assistant/explain')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({ category: 'home' });

      expect(second.status).toBe(200);
      expect(second.body.data.reply).toBe(first.body.data.reply);
      expect(mockGenerate).not.toHaveBeenCalled();
    });

    it('rejects insurer role', async () => {
      const res = await request(app)
        .post('/api/assistant/explain')
        .set('Authorization', `Bearer ${insurerToken}`)
        .send({ category: 'home' });

      expect(res.status).toBe(403);
    });

    it('returns 400 without questionnaire', async () => {
      await QuestionnaireResponse.deleteMany({});

      const res = await request(app)
        .post('/api/assistant/explain')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({ category: 'home' });

      expect(res.status).toBe(400);
    });
  });
});
