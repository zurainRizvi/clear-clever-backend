import { normalizePublicUrl } from './config/env';
import { loadEnv, resetEnvCache } from './config/env';
import { applyTestEnv } from './test/setupEnv';

describe('env URL normalization', () => {
  it('adds https when protocol is omitted', () => {
    expect(normalizePublicUrl('clearclever.vercel.app', 'http://localhost:5173')).toBe(
      'https://clearclever.vercel.app'
    );
  });

  it('accepts host-only API_PUBLIC_URL for production-style values', () => {
    applyTestEnv({
      MONGODB_URI: 'mongodb://127.0.0.1:27017/test',
      API_PUBLIC_URL: 'clear-clever-backend.onrender.com',
      CLIENT_URL: 'https://clearclever.vercel.app',
    });
    resetEnvCache();
    const env = loadEnv();
    expect(env.API_PUBLIC_URL).toBe('https://clear-clever-backend.onrender.com');
  });
});
