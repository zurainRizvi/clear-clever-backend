import type { Response } from 'express';
import type { IPolicyQuestion } from '../models/Policy';
import { Lead } from '../models/Lead';
import { Policy } from '../models/Policy';
import { User } from '../models/User';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import {
  getInsurerProfileForUser,
  toInsurerPolicyDetail,
  toInsurerPolicySummary,
} from '../services/insurerContext';
import { AppError, successResponse } from '../utils/apiResponse';

async function getOwnedPolicy(insurerProfileId: string, policyId: string) {
  const policy = await Policy.findById(policyId);
  if (!policy) {
    throw new AppError(404, 'Policy not found');
  }
  if (String(policy.insurerProfileId) !== insurerProfileId) {
    throw new AppError(403, 'You do not have permission to modify this policy');
  }
  return policy;
}

export async function listInsurerPolicies(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const profile = await getInsurerProfileForUser(req.user!._id);
  const policies = await Policy.find({ insurerProfileId: profile._id }).sort({ updatedAt: -1 });

  res.status(200).json(
    successResponse('Insurer policies retrieved', {
      count: policies.length,
      policies: policies.map(toInsurerPolicySummary),
    })
  );
}

export async function createInsurerPolicy(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const profile = await getInsurerProfileForUser(req.user!._id);
  const body = req.body as {
    slug: string;
    name: string;
    category: string;
    description: string;
    premiumMonthlyPkr: number;
    premiumYearlyPkr: number;
    coverageSummary: string;
    features: string[];
    deductiblePkr: number;
    questions?: IPolicyQuestion[];
  };

  const slug = body.slug.toLowerCase().trim();
  const existingSlug = await Policy.findOne({ slug });
  if (existingSlug) {
    throw new AppError(409, 'A policy with this slug already exists');
  }

  const policy = await Policy.create({
    insurerProfileId: profile._id,
    slug,
    name: body.name.trim(),
    category: body.category,
    description: body.description.trim(),
    premiumMonthlyPkr: body.premiumMonthlyPkr,
    premiumYearlyPkr: body.premiumYearlyPkr,
    coverageSummary: body.coverageSummary.trim(),
    features: body.features.map((feature) => feature.trim()),
    deductiblePkr: body.deductiblePkr,
    questions: body.questions ?? [],
    status: 'pending',
    rejectionReason: undefined,
    reviewedAt: undefined,
    reviewedBy: undefined,
  });

  res.status(201).json(
    successResponse('Policy submitted for approval', {
      policy: toInsurerPolicyDetail(policy),
    })
  );
}

export async function updateInsurerPolicy(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const profile = await getInsurerProfileForUser(req.user!._id);
  const policyId = String(req.params.id);
  const policy = await getOwnedPolicy(String(profile._id), policyId);

  const body = req.body as Partial<{
    slug: string;
    name: string;
    category: string;
    description: string;
    premiumMonthlyPkr: number;
    premiumYearlyPkr: number;
    coverageSummary: string;
    features: string[];
    deductiblePkr: number;
    questions: IPolicyQuestion[];
  }>;

  if (body.slug !== undefined) {
    const slug = body.slug.toLowerCase().trim();
    const duplicate = await Policy.findOne({ slug, _id: { $ne: policy._id } });
    if (duplicate) {
      throw new AppError(409, 'A policy with this slug already exists');
    }
    policy.slug = slug;
  }
  if (body.name !== undefined) policy.name = body.name.trim();
  if (body.category !== undefined) policy.category = body.category as typeof policy.category;
  if (body.description !== undefined) policy.description = body.description.trim();
  if (body.premiumMonthlyPkr !== undefined) policy.premiumMonthlyPkr = body.premiumMonthlyPkr;
  if (body.premiumYearlyPkr !== undefined) policy.premiumYearlyPkr = body.premiumYearlyPkr;
  if (body.coverageSummary !== undefined) policy.coverageSummary = body.coverageSummary.trim();
  if (body.features !== undefined) {
    policy.features = body.features.map((feature) => feature.trim());
  }
  if (body.deductiblePkr !== undefined) policy.deductiblePkr = body.deductiblePkr;
  if (body.questions !== undefined) policy.questions = body.questions;

  policy.status = 'pending';
  policy.rejectionReason = undefined;
  policy.reviewedAt = undefined;
  policy.reviewedBy = undefined;

  await policy.save();

  res.status(200).json(
    successResponse('Policy updated and resubmitted for approval', {
      policy: toInsurerPolicyDetail(policy),
    })
  );
}

export async function listInsurerLeads(req: AuthenticatedRequest, res: Response): Promise<void> {
  const profile = await getInsurerProfileForUser(req.user!._id);
  const leads = await Lead.find({ insurerProfileId: profile._id }).sort({ createdAt: -1 });

  const userIds = [...new Set(leads.map((lead) => String(lead.userId)))];
  const policyIds = [
    ...new Set(leads.filter((lead) => lead.policyId).map((lead) => String(lead.policyId))),
  ];

  const [users, policies] = await Promise.all([
    User.find({ _id: { $in: userIds } }),
    Policy.find({ _id: { $in: policyIds } }),
  ]);

  const userById = new Map(users.map((user) => [String(user._id), user]));
  const policyById = new Map(policies.map((policy) => [String(policy._id), policy]));

  const items = leads.map((lead) => {
    const user = userById.get(String(lead.userId));
    const policy = lead.policyId ? policyById.get(String(lead.policyId)) : undefined;

    return {
      id: String(lead._id),
      type: lead.type,
      status: lead.status,
      summary: lead.summary,
      metadata: lead.metadata,
      createdAt: lead.createdAt.toISOString(),
      seeker: user
        ? {
            id: String(user._id),
            fullName: user.fullName,
            email: user.email,
            phone: user.phone,
          }
        : undefined,
      policy: policy
        ? {
            id: String(policy._id),
            slug: policy.slug,
            name: policy.name,
            category: policy.category,
          }
        : undefined,
    };
  });

  res.status(200).json(
    successResponse('Insurer leads retrieved', {
      count: items.length,
      leads: items,
    })
  );
}
