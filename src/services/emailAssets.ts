import { PRODUCTION_CLIENT_URL, resolveClientBaseUrl } from './clientUrls';

/** Hosted hero art (absolute HTTPS for email clients). */
export const EMAIL_HERO_IMAGES = {
  premiumEarly:
    'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=640&q=80',
  premiumMid:
    'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=640&q=80',
  premiumUrgent:
    'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=640&q=80',
  premiumDue:
    'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=640&q=80',
  claim:
    'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=640&q=80',
  approval:
    'https://images.unsplash.com/photo-1454165804603-c3d57bc86b40?auto=format&fit=crop&w=640&q=80',
  completion:
    'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=640&q=80',
} as const;

const BRAND_PATH = '/brand';

export function emailBrandAssetUrls(clientBase = resolveClientBaseUrl()) {
  const base = clientBase.replace(/\/$/, '');
  return {
    logoHorizontal: `${base}${BRAND_PATH}/clearclever-logo-horizontal.svg`,
    logoMark: `${base}${BRAND_PATH}/clearclever-mark.svg`,
  };
}

/** Fallback data-URI mark when hosted logo is unavailable (offline tests). */
export const CLEARCLEVER_LOGO_FALLBACK =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="44" viewBox="0 0 240 44" fill="none">
      <rect width="44" height="44" rx="12" fill="#2563EB"/>
      <path d="M22 9.5L29.5 13.4V20.6C29.5 26 26.2 31 22 32.8C17.8 31 14.5 26 14.5 20.6V13.4L22 9.5Z" fill="white"/>
      <text x="56" y="30" font-family="Arial,sans-serif" font-size="26" font-weight="700" fill="#0F172A">ClearClever</text>
    </svg>`
  );

export function resolveEmailLogoUrl(clientBase?: string): string {
  const base = clientBase ?? resolveClientBaseUrl();
  if (base.includes('localhost') || base.includes('127.0.0.1')) {
    return emailBrandAssetUrls(PRODUCTION_CLIENT_URL).logoHorizontal;
  }
  return emailBrandAssetUrls(base).logoHorizontal;
}
