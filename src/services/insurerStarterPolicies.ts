import type { Types } from 'mongoose';
import {
  POLICY_STARTER_TEMPLATES,
  starterPolicySlug,
} from '../constants/policyStarterTemplates';
import type { IInsurerProfileDocument } from '../models/InsurerProfile';
import { Policy } from '../models/Policy';

export async function createStarterPoliciesForInsurer(
  profile: IInsurerProfileDocument
): Promise<number> {
  let created = 0;

  for (const template of POLICY_STARTER_TEMPLATES) {
    const slug = starterPolicySlug(profile.slug, template.category);
    const existing = await Policy.findOne({ slug });
    if (existing) {
      continue;
    }

    await Policy.create({
      insurerProfileId: profile._id,
      slug,
      name: template.nameSuffix,
      category: template.category,
      description: template.description,
      premiumMonthlyPkr: template.premiumMonthlyPkr,
      premiumYearlyPkr: template.premiumYearlyPkr,
      coverageSummary: template.coverageSummary,
      features: template.features,
      deductiblePkr: template.deductiblePkr,
      questions: template.questions,
      status: 'pending',
    });
    created += 1;
  }

  return created;
}

export async function countStarterPoliciesForProfile(
  insurerProfileId: Types.ObjectId | string
): Promise<number> {
  const policies = await Policy.find({ insurerProfileId });
  return policies.filter((policy) => policy.slug.endsWith('-starter')).length;
}
