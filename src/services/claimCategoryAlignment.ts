import type { ClaimType } from '../models/ClaimRequest';
import type { CategorySlug } from '../constants/categories';

const CLAIM_TYPE_CATEGORIES: Record<ClaimType, CategorySlug[]> = {
  accident: ['auto'],
  auto: ['auto'],
  theft: ['auto', 'home', 'others'],
  damage: ['auto', 'home', 'others'],
  medical: ['life'],
  life: ['life'],
  pet_care: ['pet'],
  pet: ['pet'],
  home: ['home'],
  other: ['home', 'auto', 'life', 'pet', 'others'],
};

export interface PolicyAlignmentResult {
  matchesPolicyCategory: boolean;
  reason: string;
}

export function assessClaimPolicyAlignment(input: {
  claimType: ClaimType;
  policyCategory?: string;
  analysisTypes: string[];
}): PolicyAlignmentResult {
  const category = (input.policyCategory ?? 'others') as CategorySlug;
  const allowed = CLAIM_TYPE_CATEGORIES[input.claimType] ?? ['others'];

  if (input.analysisTypes.includes('vehicle') && category !== 'auto') {
    return {
      matchesPolicyCategory: false,
      reason: `Vehicle damage was detected in your evidence, but the selected policy is ${category} insurance — not auto. File this claim under an auto policy.`,
    };
  }

  if (input.analysisTypes.includes('medical') && category !== 'life') {
    return {
      matchesPolicyCategory: false,
      reason: `Medical documentation was detected, but the linked policy is ${category} insurance — not health/life.`,
    };
  }

  if (input.claimType === 'accident' && category !== 'auto') {
    return {
      matchesPolicyCategory: false,
      reason: `Accident claims must be filed under an auto insurance policy. You selected a ${category} policy.`,
    };
  }

  if (input.claimType === 'pet_care' && category !== 'pet') {
    return {
      matchesPolicyCategory: false,
      reason: `Pet care claims require a pet insurance policy. The selected policy is ${category}.`,
    };
  }

  if (input.claimType === 'medical' && category !== 'life') {
    return {
      matchesPolicyCategory: false,
      reason: `Medical claims require a life/health policy. The selected policy is ${category}.`,
    };
  }

  if (!allowed.includes(category)) {
    return {
      matchesPolicyCategory: false,
      reason: `A "${input.claimType.replace(/_/g, ' ')}" claim does not match your ${category} insurance policy.`,
    };
  }

  return {
    matchesPolicyCategory: true,
    reason: `Claim type aligns with your ${category} policy.`,
  };
}

export function claimTypesForPolicyCategory(category: string | undefined): ClaimType[] {
  const slug = (category ?? 'others') as CategorySlug;
  switch (slug) {
    case 'home':
      return ['damage', 'theft', 'home', 'other'];
    case 'auto':
      return ['accident', 'damage', 'theft', 'auto', 'other'];
    case 'life':
      return ['medical', 'life', 'other'];
    case 'pet':
      return ['pet_care', 'pet', 'other'];
    default:
      return ['accident', 'damage', 'theft', 'medical', 'pet_care', 'other'];
  }
}
