import type { PolicyCategorySlug } from '../constants/categories';

const MIN_FEATURES = 6;
const MAX_FEATURES = 8;

const CATEGORY_FEATURE_POOL: Record<PolicyCategorySlug, string[]> = {
  home: [
    'Fire, lightning & explosion cover',
    'Theft & burglary protection',
    'Earthquake & flood rider (where applicable)',
    'Temporary accommodation during repairs',
    'Contents & household valuables cover',
    '24/7 claims helpline (Lahore, Karachi, Islamabad)',
    'Cashless surveyor network across major cities',
    'Domestic staff liability optional add-on',
    'Smart home device protection',
    'Monsoon rainwater damage cover',
  ],
  auto: [
    'Own damage & third-party liability',
    'Theft & total loss protection',
    'Roadside assistance (24/7 Pakistan-wide)',
    'Windscreen & glass cover',
    'Agency / authorized workshop repairs',
    'Courtesy car during repairs',
    'Passenger liability cover',
    'Digital policy card & instant renewal',
    'Zero depreciation option (selected plans)',
    'Tracker discount for anti-theft devices',
  ],
  life: [
    'Natural death benefit payout',
    'Accidental death double benefit',
    'Critical illness rider available',
    'Premium waiver on disability',
    'Education milestone payouts',
    'Tax documentation support (where applicable)',
    'Online nomination & beneficiary update',
    'Sharia-compliant takaful option',
    'Monthly annuity / retirement option',
    'Free annual policy review',
  ],
  pet: [
    'Accident & emergency vet cover',
    'Surgery & hospitalization benefit',
    'Vaccination & wellness allowance',
    'Partner clinic cashless network',
    'Tele-vet consultation included',
    'Chronic illness management',
    'Emergency pet boarding',
    'Lost pet poster & search support',
    'Multi-pet household discount',
    'Dental cleaning (annual limit)',
  ],
};

const FALLBACK_POOL = [
  'Flexible coverage limits',
  'Dedicated claims coordinator',
  'Annual policy review',
  'Digital document vault',
];

function normalizeFeature(value: string): string {
  return value.trim().toLowerCase();
}

/** Ensure each seeded policy has enough category-relevant features for compare UI. */
export function enrichPolicyFeatures(
  category: PolicyCategorySlug,
  existing: string[]
): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const feature of existing) {
    const key = normalizeFeature(feature);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(feature.trim());
  }

  const pool = CATEGORY_FEATURE_POOL[category] ?? FALLBACK_POOL;
  for (const candidate of pool) {
    if (merged.length >= MAX_FEATURES) break;
    const key = normalizeFeature(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(candidate);
  }

  while (merged.length < MIN_FEATURES && pool.length > 0) {
    for (const candidate of pool) {
      const key = normalizeFeature(candidate);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(candidate);
      if (merged.length >= MIN_FEATURES) break;
    }
    break;
  }

  return merged.slice(0, MAX_FEATURES);
}
