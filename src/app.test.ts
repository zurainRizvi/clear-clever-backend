import request from 'supertest';
import { createApp } from './app';
import { resetEnvCache } from './config/env';

describe('GET /api/health', () => {
  beforeEach(() => {
    resetEnvCache();
    process.env.NODE_ENV = 'test';
    process.env.PORT = '5000';
    process.env.MONGODB_URI = 'mongodb://localhost:27017/clearclever-test';
    process.env.CORS_ORIGINS = 'http://localhost:5173';
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
  });
});

describe('Unknown routes', () => {
  beforeEach(() => {
    resetEnvCache();
    process.env.NODE_ENV = 'test';
    process.env.PORT = '5000';
    process.env.MONGODB_URI = 'mongodb://localhost:27017/clearclever-test';
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
