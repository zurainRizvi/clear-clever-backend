import type { Types } from 'mongoose';
import type { PolicyCategorySlug } from '../constants/categories';
import { Lead, type LeadType } from '../models/Lead';

export type LeadSource =
  | 'recommend'
  | 'favorite'
  | 'checkout'
  | 'message'
  | 'compare'
  | 'purchase';

export interface UpsertLeadInput {
  insurerProfileId: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  policyId?: Types.ObjectId | string;
  type: LeadType;
  summary?: string;
  metadata?: Record<string, unknown>;
}

export async function upsertLead(input: UpsertLeadInput) {
  const filter: Record<string, unknown> = {
    insurerProfileId: input.insurerProfileId,
    userId: input.userId,
    type: input.type,
  };
  if (input.policyId) {
    filter.policyId = input.policyId;
  }

  return Lead.findOneAndUpdate(
    filter,
    {
      insurerProfileId: input.insurerProfileId,
      userId: input.userId,
      policyId: input.policyId,
      type: input.type,
      status: 'new',
      summary: input.summary,
      metadata: input.metadata,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function trackRecommendationLeads(input: {
  userId: Types.ObjectId | string;
  category: PolicyCategorySlug;
  recommendations: Array<{
    policy: { id: string; name: string; insurer: { id: string } };
  }>;
}) {
  const tasks = input.recommendations.map((rec) =>
    upsertLead({
      insurerProfileId: rec.policy.insurer.id,
      userId: input.userId,
      policyId: rec.policy.id,
      type: 'inquiry',
      summary: `Viewed recommendation: ${rec.policy.name}`,
      metadata: {
        category: input.category,
        source: 'recommend' as LeadSource,
        policyId: rec.policy.id,
      },
    })
  );
  await Promise.all(tasks);
}

export async function trackCompareLeads(input: {
  userId: Types.ObjectId | string;
  policies: Array<{
    id: string;
    name: string;
    category: PolicyCategorySlug;
    insurer: { id: string };
  }>;
}) {
  const tasks = input.policies.map((policy) =>
    upsertLead({
      insurerProfileId: policy.insurer.id,
      userId: input.userId,
      policyId: policy.id,
      type: 'inquiry',
      summary: `Compared policy: ${policy.name}`,
      metadata: {
        category: policy.category,
        source: 'compare' as LeadSource,
        policyId: policy.id,
      },
    })
  );
  await Promise.all(tasks);
}

export async function trackFavoriteLead(input: {
  userId: Types.ObjectId | string;
  policyId: Types.ObjectId | string;
  insurerProfileId: Types.ObjectId | string;
  policyName: string;
  category: PolicyCategorySlug;
}) {
  return upsertLead({
    insurerProfileId: input.insurerProfileId,
    userId: input.userId,
    policyId: input.policyId,
    type: 'favorite',
    summary: `Saved policy: ${input.policyName}`,
    metadata: {
      category: input.category,
      source: 'favorite' as LeadSource,
      policyId: String(input.policyId),
    },
  });
}

export async function trackCheckoutLead(input: {
  userId: Types.ObjectId | string;
  policyId: Types.ObjectId | string;
  insurerProfileId: Types.ObjectId | string;
  policyName: string;
  category: PolicyCategorySlug;
  purchaseId: string;
}) {
  return upsertLead({
    insurerProfileId: input.insurerProfileId,
    userId: input.userId,
    policyId: input.policyId,
    type: 'inquiry',
    summary: `Started checkout: ${input.policyName}`,
    metadata: {
      category: input.category,
      source: 'checkout' as LeadSource,
      policyId: String(input.policyId),
      purchaseId: input.purchaseId,
    },
  });
}

export async function trackInquiryLead(input: {
  userId: Types.ObjectId | string;
  insurerProfileId: Types.ObjectId | string;
  policyId?: Types.ObjectId | string;
  policyName?: string;
  category?: PolicyCategorySlug;
  source: LeadSource;
}) {
  return upsertLead({
    insurerProfileId: input.insurerProfileId,
    userId: input.userId,
    policyId: input.policyId,
    type: 'inquiry',
    summary: input.policyName
      ? `Inquiry about ${input.policyName}`
      : 'Messaged insurer',
    metadata: {
      category: input.category,
      source: input.source,
      policyId: input.policyId ? String(input.policyId) : undefined,
    },
  });
}
