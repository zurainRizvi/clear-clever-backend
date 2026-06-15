import type { PolicyCategorySlug } from '../constants/categories';
import {
  AUTO_EVENTS_COVERED,
  HOME_PERILS,
  LIFE_BENEFITS,
  PET_CONDITIONS,
  type InsurerProfileForFeatures,
  mergeFeatureSectionsWithCompanyProfile,
  flattenFeatureSections,
} from '../constants/policyFeatureTemplates';
import type { IPolicyFeatureSection } from '../models/Policy';
import type { SeedInsurerRecord } from './insurerSeedData';
import type { SeedPolicyRecord } from './policySeedData';

type CoverageTier = 'basic' | 'standard' | 'comprehensive';

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

function inferTier(record: SeedPolicyRecord): CoverageTier {
  const text = `${record.name} ${record.description} ${record.coverageSummary}`.toLowerCase();
  if (
    text.includes('third-party') ||
    text.includes('third party') ||
    text.includes('budget') ||
    text.includes('basic') ||
    text.includes('limited own damage')
  ) {
    return 'basic';
  }
  if (
    text.includes('comprehensive') ||
    text.includes('premium') ||
    text.includes('full') ||
    text.includes('guard') ||
    text.includes('platinum') ||
    text.includes('elite')
  ) {
    return 'comprehensive';
  }
  return 'standard';
}

function tierIncludedKeys(tier: CoverageTier, total: number): Set<number> {
  if (tier === 'comprehensive') {
    return new Set(Array.from({ length: total }, (_, i) => i));
  }
  if (tier === 'standard') {
    return new Set([0, 1, 2, 4, 5, 7, 8].filter((i) => i < total));
  }
  return new Set([0, 7, 8].filter((i) => i < total));
}

function formatPkr(amount: number): string {
  return `Rs ${amount.toLocaleString('en-PK')}`;
}

function autoRatePercent(record: SeedPolicyRecord, tier: CoverageTier): string {
  const base = tier === 'basic' ? 1.75 : tier === 'standard' ? 2.25 : 2.75;
  const jitter = (hashSeed(record.slug) % 5) * 0.05;
  return `${(base + jitter).toFixed(2)} %`;
}

function autoTracker(record: SeedPolicyRecord, tier: CoverageTier): string {
  const h = hashSeed(record.slug);
  if (tier === 'basic') {
    return h % 3 === 0 ? 'Optional' : 'Not required';
  }
  const cost = 12000 + (h % 4) * 1000;
  return h % 2 === 0
    ? `Mandatory — additional ${formatPkr(cost)}`
    : `Optional — ${formatPkr(cost)} if added`;
}

function buildAutoSections(record: SeedPolicyRecord): IPolicyFeatureSection[] {
  const tier = inferTier(record);
  const included = tierIncludedKeys(tier, AUTO_EVENTS_COVERED.length);
  const policyKind =
    record.name.toLowerCase().includes('takaful') || record.slug.includes('takaful')
      ? 'Islamic (Takaful)'
      : 'Conventional';

  return [
    {
      id: 'basic_details',
      title: 'Basic Details',
      rows: [
        { key: 'rate', label: 'Rate', value: autoRatePercent(record, tier) },
        { key: 'tracker', label: 'Tracker', value: autoTracker(record, tier) },
        { key: 'policy_kind', label: 'Policy type', value: policyKind },
      ],
    },
    {
      id: 'events_covered',
      title: 'Events Covered',
      rows: AUTO_EVENTS_COVERED.map((event, index) => ({
        key: event.key,
        label: event.label,
        included: included.has(index),
      })),
    },
    {
      id: 'depreciation',
      title: 'Depreciation',
      rows: [
        {
          key: 'depreciation',
          label: 'Depreciation',
          value:
            tier === 'comprehensive'
              ? '10% per year (from year of manufacture)'
              : tier === 'standard'
                ? '12% per year (from year of manufacture)'
                : '15% per year (from year of manufacture)',
        },
      ],
    },
  ];
}

function buildHomeSections(record: SeedPolicyRecord): IPolicyFeatureSection[] {
  const tier = inferTier(record);
  const included = tierIncludedKeys(tier, HOME_PERILS.length);
  const buildingLimit = Math.round(record.premiumYearlyPkr * 45 / 1000) * 1000;

  return [
    {
      id: 'basic_details',
      title: 'Basic Details',
      rows: [
        {
          key: 'building_cover',
          label: 'Building cover limit',
          value: formatPkr(buildingLimit),
        },
        {
          key: 'contents_cover',
          label: 'Contents cover',
          value: formatPkr(Math.round(buildingLimit * 0.25)),
        },
        { key: 'deductible', label: 'Deductible', value: formatPkr(record.deductiblePkr) },
      ],
    },
    {
      id: 'perils_covered',
      title: 'Perils Covered',
      rows: HOME_PERILS.map((peril, index) => ({
        key: peril.key,
        label: peril.label,
        included: included.has(index),
      })),
    },
    {
      id: 'policy_terms',
      title: 'Policy Terms',
      rows: [
        {
          key: 'reinstatement',
          label: 'Reinstatement value',
          value: tier === 'comprehensive' ? 'Full rebuild cost' : 'Agreed value',
        },
        {
          key: 'claim_free_bonus',
          label: 'Claim-free bonus',
          value: tier === 'basic' ? 'Not applicable' : 'Up to 10% premium discount',
        },
      ],
    },
  ];
}

function buildLifeSections(record: SeedPolicyRecord): IPolicyFeatureSection[] {
  const tier = inferTier(record);
  const included = tierIncludedKeys(tier, LIFE_BENEFITS.length);
  const sumAssured = Math.max(500_000, record.premiumYearlyPkr * 120);

  return [
    {
      id: 'basic_details',
      title: 'Basic Details',
      rows: [
        { key: 'sum_assured', label: 'Sum assured (from)', value: formatPkr(sumAssured) },
        {
          key: 'premium_type',
          label: 'Premium type',
          value: record.name.toLowerCase().includes('takaful') ? 'Takaful contribution' : 'Annual premium',
        },
        {
          key: 'term',
          label: 'Policy term',
          value: tier === 'comprehensive' ? '10–25 years' : tier === 'standard' ? '5–15 years' : '1–5 years',
        },
      ],
    },
    {
      id: 'benefits_covered',
      title: 'Benefits Covered',
      rows: LIFE_BENEFITS.map((benefit, index) => ({
        key: benefit.key,
        label: benefit.label,
        included: included.has(index),
      })),
    },
    {
      id: 'waiting_periods',
      title: 'Waiting Periods',
      rows: [
        { key: 'suicide_clause', label: 'Suicide clause', value: '12 months' },
        {
          key: 'critical_illness_wait',
          label: 'Critical illness waiting',
          value: tier === 'comprehensive' ? '90 days' : '180 days',
        },
      ],
    },
  ];
}

function buildPetSections(record: SeedPolicyRecord): IPolicyFeatureSection[] {
  const tier = inferTier(record);
  const included = tierIncludedKeys(tier, PET_CONDITIONS.length);
  const annualLimit = Math.max(50_000, record.premiumYearlyPkr * 8);

  return [
    {
      id: 'basic_details',
      title: 'Basic Details',
      rows: [
        { key: 'annual_limit', label: 'Annual limit', value: formatPkr(annualLimit) },
        {
          key: 'copay',
          label: 'Copay',
          value: tier === 'comprehensive' ? '10%' : tier === 'standard' ? '20%' : '30%',
        },
        { key: 'deductible', label: 'Deductible per claim', value: formatPkr(record.deductiblePkr) },
      ],
    },
    {
      id: 'conditions_covered',
      title: 'Conditions Covered',
      rows: PET_CONDITIONS.map((condition, index) => ({
        key: condition.key,
        label: condition.label,
        included: included.has(index),
      })),
    },
    {
      id: 'exclusions_highlights',
      title: 'Exclusions Highlights',
      rows: [
        { key: 'pre_existing', label: 'Pre-existing conditions', value: '12-month waiting period' },
        {
          key: 'breed_restrictions',
          label: 'Breed restrictions',
          value: tier === 'basic' ? 'Some breeds excluded' : 'Standard breeds covered',
        },
      ],
    },
  ];
}

function buildCategorySections(
  category: PolicyCategorySlug,
  record: SeedPolicyRecord
): IPolicyFeatureSection[] {
  switch (category) {
    case 'auto':
      return buildAutoSections(record);
    case 'home':
      return buildHomeSections(record);
    case 'life':
      return buildLifeSections(record);
    case 'pet':
      return buildPetSections(record);
    default:
      return [];
  }
}

export function insurerProfileForFeatures(insurer: SeedInsurerRecord): InsurerProfileForFeatures {
  return {
    companyName: insurer.companyName,
    pacraRating: insurer.pacraRating,
    jcrVisRating: insurer.jcrVisRating,
    operationalSince: insurer.operationalSince,
    policyType: insurer.policyType,
  };
}

export function buildPolicyFeatureSections(
  record: SeedPolicyRecord,
  insurer: SeedInsurerRecord
): IPolicyFeatureSection[] {
  const sections = buildCategorySections(record.category, record);
  return mergeFeatureSectionsWithCompanyProfile(sections, insurerProfileForFeatures(insurer));
}

export function buildPolicyFeaturesFromSections(sections: IPolicyFeatureSection[]): string[] {
  return flattenFeatureSections(sections);
}
