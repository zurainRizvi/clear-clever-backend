import type { PolicyCategorySlug } from '../constants/categories';
import type { InsurerPolicyType } from '../models/InsurerProfile';
import type { IPolicyDocument, IPolicyFeatureSection } from '../models/Policy';
import type { IInsurerProfileDocument } from '../models/InsurerProfile';
import {
  buildCompanyProfileSection,
  flattenFeatureSections,
  mergeFeatureSectionsWithCompanyProfile,
  type InsurerProfileForFeatures,
} from '../constants/policyFeatureTemplates';

export interface PublicInsurerSummary {
  id: string;
  slug: string;
  companyName: string;
  profilePhotoDataUrl?: string;
  pacraRating?: string;
  jcrVisRating?: string;
  operationalSince?: number;
  policyType?: InsurerPolicyType;
}

export interface PublicPolicyFeatureRow {
  key: string;
  label: string;
  value?: string;
  included?: boolean;
}

export interface PublicPolicyFeatureSection {
  id: string;
  title: string;
  rows: PublicPolicyFeatureRow[];
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
  featureSections: PublicPolicyFeatureSection[];
  deductiblePkr: number;
  status: IPolicyDocument['status'];
  insurer: PublicInsurerSummary;
}

function insurerForFeatures(insurer: IInsurerProfileDocument): InsurerProfileForFeatures {
  return {
    companyName: insurer.companyName,
    pacraRating: insurer.pacraRating,
    jcrVisRating: insurer.jcrVisRating,
    operationalSince: insurer.operationalSince,
    policyType: insurer.policyType,
  };
}

export function resolvePolicyFeatureSections(
  policy: IPolicyDocument,
  insurer: IInsurerProfileDocument
): IPolicyFeatureSection[] {
  if (policy.featureSections && policy.featureSections.length > 0) {
    return mergeFeatureSectionsWithCompanyProfile(policy.featureSections, insurerForFeatures(insurer));
  }
  return [buildCompanyProfileSection(insurerForFeatures(insurer))];
}

export function toPublicInsurerSummary(profile: IInsurerProfileDocument): PublicInsurerSummary {
  return {
    id: String(profile._id),
    slug: profile.slug,
    companyName: profile.companyName,
    profilePhotoDataUrl: profile.profilePhotoDataUrl,
    pacraRating: profile.pacraRating,
    jcrVisRating: profile.jcrVisRating,
    operationalSince: profile.operationalSince,
    policyType: profile.policyType,
  };
}

export function toPublicPolicy(
  policy: IPolicyDocument,
  insurer: IInsurerProfileDocument
): PublicPolicy {
  const featureSections = resolvePolicyFeatureSections(policy, insurer);
  const features =
    policy.features.length > 0 ? policy.features : flattenFeatureSections(featureSections);

  return {
    id: String(policy._id),
    slug: policy.slug,
    name: policy.name,
    category: policy.category,
    description: policy.description,
    premiumMonthlyPkr: policy.premiumMonthlyPkr,
    premiumYearlyPkr: policy.premiumYearlyPkr,
    coverageSummary: policy.coverageSummary,
    features,
    featureSections,
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

export function syncPolicyFeaturesFromSections(
  featureSections: IPolicyFeatureSection[] | undefined,
  existingFeatures: string[]
): { featureSections?: IPolicyFeatureSection[]; features: string[] } {
  if (!featureSections || featureSections.length === 0) {
    return { features: existingFeatures };
  }
  const withoutCompany = featureSections.filter((s) => s.id !== 'company_profile');
  const flattened = flattenFeatureSections(withoutCompany);
  return {
    featureSections: withoutCompany,
    features: flattened.length > 0 ? flattened : existingFeatures,
  };
}
