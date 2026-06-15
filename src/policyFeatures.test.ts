import {
  buildCompanyProfileSection,
  flattenFeatureSections,
} from './constants/policyFeatureTemplates';
import { buildPolicyFeatureSections } from './seed/policyFeatureSeedBuilder';
import { SEED_INSURER_BY_KEY } from './seed/insurerSeedData';
import {
  resolveScheduledAtFromAnswers,
  scheduledAtFromPreferredSlot,
} from './services/purchaseScheduling';
import { toPublicPolicy } from './services/policyPresentation';
import type { IPolicyDocument } from './models/Policy';
import type { IInsurerProfileDocument } from './models/InsurerProfile';

describe('policy feature sections', () => {
  it('builds auto feature sections with company profile from seed metadata', () => {
    const insurer = SEED_INSURER_BY_KEY.get('tpl');
    expect(insurer).toBeDefined();
    const sections = buildPolicyFeatureSections(
      {
        seedKey: 'test',
        insurerSeedKey: 'tpl',
        slug: 'tpl-auto-comprehensive',
        name: 'TPL Auto Comprehensive',
        category: 'auto',
        description: 'Full motor cover',
        premiumMonthlyPkr: 6200,
        premiumYearlyPkr: 70680,
        coverageSummary: 'Comprehensive cover',
        features: ['Own damage'],
        deductiblePkr: 20000,
        questions: [],
        status: 'approved',
      },
      insurer!
    );

    expect(sections.some((section) => section.id === 'events_covered')).toBe(true);
    expect(sections.some((section) => section.id === 'company_profile')).toBe(true);
    const company = sections.find((section) => section.id === 'company_profile');
    expect(company?.rows.find((row) => row.key === 'pacra_rating')?.value).toBe('A+');
  });

  it('flattens checklist rows into feature strings', () => {
    const flattened = flattenFeatureSections([
      {
        id: 'events_covered',
        title: 'Events Covered',
        rows: [
          { key: 'accident', label: 'Accident', included: true },
          { key: 'fire', label: 'Fire', included: false },
        ],
      },
      {
        id: 'basic_details',
        title: 'Basic Details',
        rows: [{ key: 'rate', label: 'Rate', value: '2.75 %' }],
      },
    ]);

    expect(flattened).toContain('Accident');
    expect(flattened).toContain('Rate: 2.75 %');
    expect(flattened).not.toContain('Fire');
  });

  it('includes featureSections on public policy payload', () => {
    const insurer = {
      _id: 'insurer1',
      companyName: 'TPL Insurance',
      slug: 'tpl-insurance',
      pacraRating: 'A+',
      operationalSince: 2005,
    } as unknown as IInsurerProfileDocument;

    const policy = {
      _id: 'policy1',
      slug: 'tpl-auto-comprehensive',
      name: 'TPL Auto Comprehensive',
      category: 'auto',
      description: 'desc',
      premiumMonthlyPkr: 6200,
      premiumYearlyPkr: 70680,
      coverageSummary: 'cover',
      features: ['Own damage'],
      featureSections: [
        {
          id: 'basic_details',
          title: 'Basic Details',
          rows: [{ key: 'rate', label: 'Rate', value: '2.75 %' }],
        },
      ],
      deductiblePkr: 20000,
      status: 'approved',
    } as unknown as IPolicyDocument;

    const publicPolicy = toPublicPolicy(policy, insurer);
    expect(publicPolicy.featureSections.length).toBeGreaterThan(0);
    expect(publicPolicy.insurer.pacraRating).toBe('A+');
    expect(
      publicPolicy.featureSections.some((section) => section.id === 'company_profile')
    ).toBe(true);
  });

  it('builds company profile section from insurer ratings', () => {
    const section = buildCompanyProfileSection({
      companyName: 'TPL Insurance',
      pacraRating: 'A+',
      jcrVisRating: 'AA-',
      operationalSince: 2005,
    });
    expect(section.rows).toHaveLength(3);
  });
});

describe('purchase scheduling from answers', () => {
  it('parses preferred call date and slot into scheduledAt', () => {
    const scheduled = scheduledAtFromPreferredSlot('2030-06-17', '1:00 PM – 5:00 PM');
    expect(scheduled).toBeInstanceOf(Date);
    expect(Number.isNaN(scheduled.getTime())).toBe(false);
  });

  it('uses preferred answers when valid', () => {
    const scheduled = resolveScheduledAtFromAnswers({
      preferred_call_date: '2030-06-17',
      preferred_call_time_slot: '9:00 AM – 12:00 PM',
    });
    expect(scheduled.getTime()).toBeGreaterThan(Date.now());
  });
});
