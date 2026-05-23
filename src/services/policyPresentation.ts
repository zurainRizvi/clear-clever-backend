import type { PolicyCategorySlug } from '../constants/categories';
import type { IPolicyDocument } from '../models/Policy';
import type { IInsurerProfileDocument } from '../models/InsurerProfile';

export interface PublicInsurerSummary {
  id: string;
  slug: string;
  companyName: string;
}

export interface PublicPolicy {
  id: string;
  slug: string;
  name: string;
  category: PolicyCategorySlug;
  description: string;
  premiumMonthlyPkr: number;
  premiumYearlyPkr: number;
  coverageSummary: string;
  features: string[];
  deductiblePkr: number;
  status: IPolicyDocument['status'];
  insurer: PublicInsurerSummary;
}

export function toPublicInsurerSummary(profile: IInsurerProfileDocument): PublicInsurerSummary {
  return {
    id: String(profile._id),
    slug: profile.slug,
    companyName: profile.companyName,
  };
}

export function toPublicPolicy(
  policy: IPolicyDocument,
  insurer: IInsurerProfileDocument
): PublicPolicy {
  return {
    id: String(policy._id),
    slug: policy.slug,
    name: policy.name,
    category: policy.category,
    description: policy.description,
    premiumMonthlyPkr: policy.premiumMonthlyPkr,
    premiumYearlyPkr: policy.premiumYearlyPkr,
    coverageSummary: policy.coverageSummary,
    features: policy.features,
    deductiblePkr: policy.deductiblePkr,
    status: policy.status,
    insurer: toPublicInsurerSummary(insurer),
  };
}

export async function loadInsurerMap(
  policies: IPolicyDocument[]
): Promise<Map<string, IInsurerProfileDocument>> {
  const { InsurerProfile } = await import('../models/InsurerProfile');
  const ids = [...new Set(policies.map((p) => String(p.insurerProfileId)))];
  const profiles = await InsurerProfile.find({ _id: { $in: ids } });
  return new Map(profiles.map((p) => [String(p._id), p]));
}

export async function enrichPolicies(
  policies: IPolicyDocument[]
): Promise<PublicPolicy[]> {
  const insurerMap = await loadInsurerMap(policies);
  return policies.map((policy) => {
    const insurer = insurerMap.get(String(policy.insurerProfileId));
    if (!insurer) {
      throw new Error(`Missing insurer profile for policy ${policy.slug}`);
    }
    return toPublicPolicy(policy, insurer);
  });
}
