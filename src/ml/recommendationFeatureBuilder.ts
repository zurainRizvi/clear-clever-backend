import type { PolicyCategorySlug } from '../constants/categories';
import type { IPolicyDocument } from '../models/Policy';
import { bucketCityRegion } from './featureEncoding';
import type { PolicyRankerCategory, PolicyRankerRawFeatures } from './types';

const RANKER_CATEGORIES: PolicyRankerCategory[] = ['home', 'auto', 'life', 'pet'];

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function resolveCity(category: PolicyRankerCategory, answers: Record<string, unknown>): string {
  if (category === 'auto') {
    const city = String(answers.registration_city ?? 'Karachi');
    if (city === 'Islamabad / Rawalpindi') {
      return 'Islamabad';
    }
    if (city === 'Other') {
      return 'Lahore';
    }
    return city;
  }
  return String(answers.city ?? 'Karachi');
}

function userValuePkr(category: PolicyRankerCategory, answers: Record<string, unknown>): number {
  if (category === 'home') {
    return toNumber(answers.property_value_pkr) ?? 3_000_000;
  }
  if (category === 'auto') {
    return toNumber(answers.vehicle_value_pkr) ?? 1_500_000;
  }
  if (category === 'life') {
    return toNumber(answers.annual_income_pkr) ?? 1_200_000;
  }
  const weight = toNumber(answers.pet_weight_kg) ?? 10;
  return weight * 50_000;
}

function firstAnswerValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.length > 0 ? String(value[0]) : 'other';
  }
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return 'other';
}

function categoricalField(
  category: PolicyRankerCategory,
  field: string,
  answers: Record<string, unknown>
): string {
  const raw = answers[field];
  if (field === 'coverage_type' && category === 'auto') {
    return firstAnswerValue(raw);
  }
  return firstAnswerValue(raw);
}

export function isPolicyRankerCategory(
  category: PolicyCategorySlug
): category is PolicyRankerCategory {
  return RANKER_CATEGORIES.includes(category as PolicyRankerCategory);
}

export function buildPolicyRankerFeatures(
  category: PolicyRankerCategory,
  answers: Record<string, unknown>,
  policy: IPolicyDocument
): PolicyRankerRawFeatures {
  const userValue = userValuePkr(category, answers);
  const cityRegion = bucketCityRegion(resolveCity(category, answers));
  const premiumToValue = policy.premiumYearlyPkr / Math.max(userValue, 1);

  const base: PolicyRankerRawFeatures = {
    user_value_pkr: userValue,
    policy_premium_monthly_pkr: policy.premiumMonthlyPkr,
    policy_feature_count: policy.features.length,
    policy_deductible_pkr: policy.deductiblePkr,
    premium_to_value_ratio: premiumToValue,
    city_region: cityRegion,
  };

  if (category === 'home') {
    return {
      ...base,
      property_type: categoricalField(category, 'property_type', answers),
      occupancy: categoricalField(category, 'occupancy', answers),
    };
  }
  if (category === 'auto') {
    return {
      ...base,
      vehicle_type: categoricalField(category, 'vehicle_type', answers),
      coverage_type: categoricalField(category, 'coverage_type', answers),
    };
  }
  if (category === 'life') {
    return {
      ...base,
      coverage_goal: categoricalField(category, 'coverage_goal', answers),
      age_band: categoricalField(category, 'age_band', answers),
    };
  }
  return {
    ...base,
    pet_type: categoricalField(category, 'pet_type', answers),
    vaccination_status: categoricalField(category, 'vaccination_status', answers),
  };
}
