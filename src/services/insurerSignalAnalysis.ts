import type { PolicyCategorySlug } from '../constants/categories';

export function answerTokens(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => answerTokens(item));
  }
  if (typeof value === 'string') {
    return [value.toLowerCase()];
  }
  return [];
}

export function hasPositiveSignal(value: unknown, reject = ['no', 'none']): boolean {
  const values = Array.isArray(value)
    ? value.flatMap((item) => answerTokens(item))
    : answerTokens(value);
  return values.some((item) => item.trim() !== '' && !reject.some((word) => item.includes(word)));
}

export function collectAnswerEntries(
  responses: Array<{ category: string; answers: Record<string, unknown> }>
): Array<[string, unknown]> {
  return responses.flatMap((response) => Object.entries(response.answers));
}

export function hasAnswerSignal(
  entries: Array<[string, unknown]>,
  keys: string[],
  reject = ['no', 'none']
): boolean {
  return entries.some(([key, value]) => keys.includes(key) && hasPositiveSignal(value, reject));
}

export function signalText(entries: Array<[string, unknown]>, keys: string[]): string {
  return entries
    .filter(([key, value]) => keys.includes(key) && hasPositiveSignal(value))
    .map(([, value]) => answerTokens(value).join(' '))
    .join(' ');
}

export interface CategoryDemandSignal {
  category: PolicyCategorySlug;
  label: string;
  demandScore: number;
  growthPct: number;
  reason: string;
}

export function detectCategoryDemandSignals(
  currentByCategory: Map<PolicyCategorySlug, number>,
  previousByCategory: Map<PolicyCategorySlug, number>
): CategoryDemandSignal[] {
  const signals: CategoryDemandSignal[] = [];

  for (const category of ['home', 'auto', 'life', 'pet'] as PolicyCategorySlug[]) {
    const current = currentByCategory.get(category) ?? 0;
    const previous = previousByCategory.get(category) ?? 0;
    const growthPct =
      previous === 0 ? (current > 0 ? 100 : 0) : Math.round(((current - previous) / previous) * 100);

    if (current === 0 && growthPct <= 0) {
      continue;
    }

    const demandScore = current * 10 + Math.max(0, growthPct);
    const label =
      category === 'home'
        ? 'Home Insurance'
        : category === 'auto'
          ? 'Vehicle Insurance'
          : category === 'life'
            ? 'Life Insurance'
            : 'Pet Insurance';

    signals.push({
      category,
      label,
      demandScore,
      growthPct,
      reason:
        growthPct > 0
          ? `${label} demand rose ${growthPct}% versus the prior period based on your lead pipeline.`
          : `${label} remains active in your lead pipeline this period.`,
    });
  }

  return signals.sort((a, b) => b.demandScore - a.demandScore);
}

export interface BundleOpportunitySignal {
  title: string;
  description: string;
  expectedImprovementPct: number;
  primaryCategory: PolicyCategorySlug;
  secondaryCategory: PolicyCategorySlug;
}

export function detectBundleOpportunities(
  responses: Array<{ category: string; answers: Record<string, unknown> }>,
  insurerCategories: Set<PolicyCategorySlug>
): BundleOpportunitySignal[] {
  const entries = collectAnswerEntries(responses);
  const opportunities: BundleOpportunitySignal[] = [];

  const homeOwners = hasAnswerSignal(entries, ['home_owner', 'ownership_status']);
  const petOwners = hasAnswerSignal(entries, ['has_pet', 'pet_type']);

  if (
    homeOwners &&
    petOwners &&
    insurerCategories.has('home') &&
    !insurerCategories.has('pet')
  ) {
    opportunities.push({
      title: 'Home + Pet Bundle',
      description:
        'Seekers who completed home questionnaires also signal pet ownership. A bundled pet policy can capture follow-on demand.',
      expectedImprovementPct: 14,
      primaryCategory: 'home',
      secondaryCategory: 'pet',
    });
  }

  const vehicleSignal = signalText(entries, ['owns_vehicle', 'vehicle_type', 'vehicle_make_model']);
  if (
    vehicleSignal &&
    !vehicleSignal.includes('no') &&
    insurerCategories.has('auto') &&
    !insurerCategories.has('life') &&
    hasAnswerSignal(entries, ['family_dependents', 'dependents'])
  ) {
    opportunities.push({
      title: 'Auto + Life Bundle',
      description:
        'Vehicle owners with dependents appear in your questionnaire data. Family life cover is a natural bundle.',
      expectedImprovementPct: 12,
      primaryCategory: 'auto',
      secondaryCategory: 'life',
    });
  }

  return opportunities;
}

export function inferAudienceLabel(
  responses: Array<{ category: string; answers: Record<string, unknown> }>,
  category: PolicyCategorySlug
): string {
  const categoryResponses = responses.filter((r) => r.category === category);
  if (categoryResponses.length === 0) {
    return 'Policy seekers';
  }

  const entries = collectAnswerEntries(categoryResponses);

  if (category === 'home') {
    const property = signalText(entries, ['property_type', 'home_type']);
    if (property.includes('apartment')) return 'Apartment Families';
    if (property.includes('house')) return 'Homeowners';
    return 'Property owners';
  }

  if (category === 'pet') {
    const pet = signalText(entries, ['pet_type', 'has_pet']);
    if (pet.includes('dog')) return 'Dog owners';
    if (pet.includes('cat')) return 'Cat owners';
    return 'Pet Owners (25-40)';
  }

  if (category === 'auto') {
    const vehicle = signalText(entries, ['vehicle_type', 'owns_vehicle']);
    if (vehicle.includes('motorcycle') || vehicle.includes('bike')) return 'Motorcycle riders';
    if (vehicle.includes('car')) return 'Car owners';
    return 'Young Drivers';
  }

  if (category === 'life') {
    if (hasAnswerSignal(entries, ['family_dependents', 'dependents'])) {
      return 'Young Families';
    }
    if (hasAnswerSignal(entries, ['health_condition', 'occupation_risk'], ['no', 'none', 'office'])) {
      return 'Higher-risk profiles';
    }
    return 'Income planners';
  }

  return 'Policy seekers';
}
