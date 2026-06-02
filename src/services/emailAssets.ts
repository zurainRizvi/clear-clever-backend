/** Hosted hero art (absolute HTTPS for email clients). Swap to CLIENT_URL/public/email/* when assets ship on Vercel. */
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

/** Inline SVG — shield mark (no external fetch required for logo). */
export const CLEARCLEVER_LOGO_SVG =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44" fill="none">
      <rect width="44" height="44" rx="12" fill="#2563EB"/>
      <path d="M22 9L30 13.2V21.2C30 27.1 26.4 32.6 22 34.5C17.6 32.6 14 27.1 14 21.2V13.2L22 9Z" fill="white"/>
      <path d="M19.5 22.5L21.3 24.4L25.8 19.9" stroke="#2563EB" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
  );
