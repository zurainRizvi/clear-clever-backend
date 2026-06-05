import { getAffiliateBranding } from './constants/affiliateBranding';

describe('Affiliate branding', () => {
  it('returns TPL colors and logo for tpl-insurance slug', () => {
    const branding = getAffiliateBranding('tpl-insurance', 'TPL Insurance');
    expect(branding.primary).toBe('#00A3E0');
    expect(branding.logoSvg).toContain('TPL');
  });

  it('returns Jubilee colors for jubilee-insurance slug', () => {
    const branding = getAffiliateBranding('jubilee-insurance', 'Jubilee General Insurance');
    expect(branding.primary).toBe('#C8102E');
    expect(branding.logoSvg).toContain('Jubilee');
  });

  it('falls back to ClearClever blue for unknown insurers', () => {
    const branding = getAffiliateBranding('new-partner-insurance', 'New Partner Insurance');
    expect(branding.primary).toBe('#2563EB');
    expect(branding.logoSvg).toContain('New Partner Insurance');
  });
});
