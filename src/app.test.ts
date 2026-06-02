import request from 'supertest';
import { createApp } from './app';
import { applyTestEnv } from './test/setupEnv';

describe('GET /api/health', () => {
  beforeEach(() => {
    applyTestEnv();
  });

  it('returns 200 with healthy payload', async () => {
    const { loadEnv } = await import('./config/env');
    const env = loadEnv();
    const app = createApp(env);

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.service).toBe('clearclever-api');
    expect(res.body.data.environment).toBe('test');
    expect(res.body.data.infrastructure).toBeDefined();
    expect(res.body.data.infrastructure.render.ok).toBe(true);
    expect(res.body.data.infrastructure.mongodb).toBeDefined();
    expect(res.body.data.infrastructure.gemini).toBeDefined();
  });
});

describe('Unknown routes', () => {
  beforeEach(() => {
    applyTestEnv();
  });

  it('returns 404 JSON for unknown routes', async () => {
    const { loadEnv } = await import('./config/env');
    const app = createApp(loadEnv());

    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Route not found');
    expect(Array.isArray(res.body.errors)).toBe(true);
  });
});
