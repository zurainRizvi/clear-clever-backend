import { assessClaimPolicyAlignment } from './services/claimCategoryAlignment';

describe('assessClaimPolicyAlignment', () => {
  it('allows medical analysis on pet policies (vet injury photos)', () => {
    const result = assessClaimPolicyAlignment({
      claimType: 'pet_care',
      policyCategory: 'pet',
      analysisTypes: ['medical', 'general'],
    });

    expect(result.matchesPolicyCategory).toBe(true);
  });

  it('allows medical analysis on life policies', () => {
    const result = assessClaimPolicyAlignment({
      claimType: 'medical',
      policyCategory: 'life',
      analysisTypes: ['medical'],
    });

    expect(result.matchesPolicyCategory).toBe(true);
  });

  it('flags medical analysis on auto policies', () => {
    const result = assessClaimPolicyAlignment({
      claimType: 'damage',
      policyCategory: 'auto',
      analysisTypes: ['medical'],
    });

    expect(result.matchesPolicyCategory).toBe(false);
    expect(result.reason).toMatch(/injury or treatment evidence/i);
  });

  it('allows damage claim type on pet policies', () => {
    const result = assessClaimPolicyAlignment({
      claimType: 'damage',
      policyCategory: 'pet',
      analysisTypes: ['general'],
    });

    expect(result.matchesPolicyCategory).toBe(true);
  });

  it('flags vehicle analysis on non-auto policies', () => {
    const result = assessClaimPolicyAlignment({
      claimType: 'other',
      policyCategory: 'pet',
      analysisTypes: ['vehicle'],
    });

    expect(result.matchesPolicyCategory).toBe(false);
    expect(result.reason).toMatch(/vehicle damage/i);
  });
});
