import { PRODUCTION_CLIENT_URL, resolvePasswordResetClientBaseUrl } from './services/clientUrls';

describe('clientUrls', () => {
  it('uses production Vercel URL for reset links when CLIENT_URL is localhost', () => {
    expect(
      resolvePasswordResetClientBaseUrl('http://localhost:5173', 'development')
    ).toBe(PRODUCTION_CLIENT_URL);
  });

  it('keeps configured CLIENT_URL for reset links in production', () => {
    expect(
      resolvePasswordResetClientBaseUrl('https://clearclever.vercel.app', 'production')
    ).toBe('https://clearclever.vercel.app');
  });

  it('preserves localhost reset base in test env for Jest', () => {
    expect(
      resolvePasswordResetClientBaseUrl('http://localhost:5173', 'test')
    ).toBe('http://localhost:5173');
  });
});
