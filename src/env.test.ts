import { normalizePublicUrl } from './config/env';
import { loadEnv, resetEnvCache } from './config/env';
import { applyTestEnv } from './test/setupEnv';

describe('env URL normalization', () => {
  it('adds https when protocol is omitted', () => {
    expect(normalizePublicUrl('clear-clever.vercel.app', 'http://localhost:5173')).toBe(
      'https://clear-clever.vercel.app'
    );
  });

  it('accepts host-only API_PUBLIC_URL for production-style values', () => {
    applyTestEnv({
      MONGODB_URI: 'mongodb://127.0.0.1:27017/test',
      API_PUBLIC_URL: 'clear-clever-backend.onrender.com',
      CLIENT_URL: 'https://clear-clever.vercel.app',
    });
    resetEnvCache();
    const env = loadEnv();
    expect(env.API_PUBLIC_URL).toBe('https://clear-clever-backend.onrender.com');
  });
});
