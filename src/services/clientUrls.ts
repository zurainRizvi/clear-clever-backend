/** Production SPA — used when CLIENT_URL is unset (e.g. local preview scripts). */
export const PRODUCTION_CLIENT_URL = 'https://clear-clever-frontend.vercel.app';

export function resolveClientBaseUrl(): string {
  const raw = process.env.CLIENT_URL?.trim();
  if (!raw) return PRODUCTION_CLIENT_URL;
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/$/, '');
  return `https://${raw.replace(/^\/+/, '').replace(/\/$/, '')}`;
}

/** Deep links into the SPA (must match clear-clever-frontend App.tsx routes). */
export function clientAppUrls(base = resolveClientBaseUrl()) {
  const root = base.replace(/\/$/, '');
  return {
    home: root,
    signIn: `${root}/signin`,
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
