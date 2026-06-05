export interface AffiliateBranding {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  logoSvg: string;
}

const CLEARCLEVER_PRIMARY = '#2563EB';

const INSURER_LOGOS: Record<string, string> = {
  tpl: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40" fill="none" role="img" aria-label="TPL Insurance"><text x="0" y="28" font-family="Poppins, Inter, Arial, sans-serif" font-size="24" font-weight="800" fill="currentColor">TPL</text><text x="48" y="28" font-family="Poppins, Inter, Arial, sans-serif" font-size="11" font-weight="600" fill="currentColor">Insurance</text></svg>`,
  jubilee: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 40" fill="none" role="img" aria-label="Jubilee Insurance"><text x="0" y="18" font-family="Poppins, Inter, Arial, sans-serif" font-size="10" font-weight="600" fill="currentColor">Jubilee</text><text x="0" y="32" font-family="Poppins, Inter, Arial, sans-serif" font-size="14" font-weight="800" fill="currentColor">Insurance</text></svg>`,
  adamjee: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 40" fill="none" role="img" aria-label="Adamjee Insurance"><text x="0" y="18" font-family="Poppins, Inter, Arial, sans-serif" font-size="10" font-weight="600" fill="currentColor">Adamjee</text><text x="0" y="32" font-family="Poppins, Inter, Arial, sans-serif" font-size="14" font-weight="800" fill="currentColor">Insurance</text></svg>`,
};

const INSURER_COLORS: Record<string, { primary: string; primaryDark: string; primaryLight: string }> = {
  tpl: { primary: '#00A3E0', primaryDark: '#0077A8', primaryLight: '#E6F7FC' },
  jubilee: { primary: '#C8102E', primaryDark: '#9B0C24', primaryLight: '#FDE8EC' },
  adamjee: { primary: '#003DA5', primaryDark: '#002D7A', primaryLight: '#E8EEF8' },
};

export const CLEARCLEVER_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;

function insurerKeyFromSlug(slug: string): string {
  if (slug.includes('tpl')) return 'tpl';
  if (slug.includes('jubilee')) return 'jubilee';
  if (slug.includes('adamjee')) return 'adamjee';
  return 'default';
}

function fallbackLogo(companyName: string): string {
  const label = companyName.slice(0, 24);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 40" fill="none" role="img" aria-label="${label}"><text x="0" y="26" font-family="Poppins, Inter, Arial, sans-serif" font-size="16" font-weight="700" fill="currentColor">${label}</text></svg>`;
}

export function getAffiliateBranding(insurerSlug: string, companyName: string): AffiliateBranding {
  const key = insurerKeyFromSlug(insurerSlug);
  const colors = INSURER_COLORS[key] ?? {
    primary: CLEARCLEVER_PRIMARY,
    primaryDark: '#1D4ED8',
    primaryLight: '#EFF6FF',
  };

  return {
    ...colors,
    logoSvg: INSURER_LOGOS[key] ?? fallbackLogo(companyName),
  };
}
