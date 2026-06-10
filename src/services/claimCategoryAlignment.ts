import type { ClaimType } from '../models/ClaimRequest';
import type { CategorySlug } from '../constants/categories';

const CLAIM_TYPE_CATEGORIES: Record<ClaimType, CategorySlug[]> = {
  accident: ['auto'],
  auto: ['auto'],
  theft: ['auto', 'home', 'pet', 'others'],
  damage: ['auto', 'home', 'pet', 'others'],
  medical: ['life', 'pet'],
  life: ['life'],
  pet_care: ['pet'],
  pet: ['pet'],
  home: ['home'],
  other: ['home', 'auto', 'life', 'pet', 'others'],
};

const PET_CLAIM_TYPES: ClaimType[] = ['pet_care', 'pet'];
const LIFE_CLAIM_TYPES: ClaimType[] = ['medical', 'life'];

export interface PolicyAlignmentResult {
  matchesPolicyCategory: boolean;
  reason: string;
}

function isPetContext(category: CategorySlug, claimType: ClaimType): boolean {
  return category === 'pet' || PET_CLAIM_TYPES.includes(claimType);
}

function isLifeHealthContext(category: CategorySlug, claimType: ClaimType): boolean {
  return category === 'life' || LIFE_CLAIM_TYPES.includes(claimType);
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

  // Injury photos on pet policies are often tagged "medical" by AI (vet injury) — that is expected.
  if (input.analysisTypes.includes('medical')) {
    if (isPetContext(category, input.claimType)) {
      // Pet injury / vet treatment evidence aligns with pet insurance.
    } else if (isLifeHealthContext(category, input.claimType)) {
      // Human health evidence on life/health policies.
    } else if (category === 'auto' || category === 'home') {
      return {
        matchesPolicyCategory: false,
        reason: `Injury or treatment evidence was detected, but your linked policy is ${category} insurance. Use a pet or life/health policy if this is a veterinary or medical claim.`,
      };
    }
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

  if (input.claimType === 'medical' && category !== 'life' && category !== 'pet') {
    return {
      matchesPolicyCategory: false,
      reason: `Medical or veterinary claims require a life/health or pet policy. The selected policy is ${category}.`,
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
      return ['pet_care', 'damage', 'pet', 'other'];
    default:
      return ['accident', 'damage', 'theft', 'medical', 'pet_care', 'other'];
  }
}
