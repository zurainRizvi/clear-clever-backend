/** Production SPA — used when CLIENT_URL is unset (e.g. local preview scripts). */
export const PRODUCTION_CLIENT_URL = 'https://clearclever.vercel.app';

const LOCALHOST_CLIENT_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

export function resolveClientBaseUrl(): string {
  const raw = process.env.CLIENT_URL?.trim();
  if (!raw) return PRODUCTION_CLIENT_URL;
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/$/, '');
  return `https://${raw.replace(/^\/+/, '').replace(/\/$/, '')}`;
}

/**
 * Base URL for password-reset links in emails.
 * Uses the configured CLIENT_URL in production; falls back to the live Vercel app when env still points at localhost.
 */
export function resolvePasswordResetClientBaseUrl(
  clientUrl: string,
  nodeEnv: string = process.env.NODE_ENV ?? 'development'
): string {
  const normalized = clientUrl.replace(/\/$/, '');
  if (nodeEnv === 'test') return normalized;
  if (LOCALHOST_CLIENT_PATTERN.test(normalized)) {
    return PRODUCTION_CLIENT_URL;
  }
  return normalized;
}

/** Deep links into the SPA (must match clear-clever-frontend App.tsx routes). */
export function clientAppUrls(base = resolveClientBaseUrl()) {
  const root = base.replace(/\/$/, '');
  return {
    home: root,
    signIn: `${root}/signin`,
    resetPassword: `${root}/reset-password`,
    forgotPassword: `${root}/forgot-password`,
    dashboard: `${root}/dashboard`,
    purchases: `${root}/dashboard/purchases`,
    claims: `${root}/dashboard/claims`,
    notifications: `${root}/dashboard/notifications`,
    providerDashboard: `${root}/provider-dashboard`,
    providerPolicies: `${root}/provider-dashboard/policies`,
    contactSupport: `${root}/contact-us`,
    helpCenter: `${root}/help-center`,
  };
}
