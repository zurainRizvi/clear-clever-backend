import type { Response } from 'express';
import type { ClaimStatus } from '../models/ClaimRequest';
import { ClaimRequest } from '../models/ClaimRequest';
import type { IPolicyQuestion } from '../models/Policy';
import { Lead } from '../models/Lead';
import { Notification } from '../models/Notification';
import { Policy } from '../models/Policy';
import { User } from '../models/User';
import { toInsurerClaimSummary } from '../services/claimPresentation';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import {
  getInsurerProfileForUser,
  toInsurerPolicyDetail,
  toInsurerPolicySummary,
  toInsurerProfileSummary,
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

export async function getInsurerProfile(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const profile = await getInsurerProfileForUser(req.user!._id);
  res.status(200).json(
    successResponse('Insurer profile retrieved', {
      profile: toInsurerProfileSummary(profile),
    })
  );
}

export async function updateInsurerProfile(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const profile = await getInsurerProfileForUser(req.user!._id);
  const body = req.body as Partial<{
    contactEmail: string;
    contactPhone: string;
    description: string;
  }>;

  if (body.contactEmail !== undefined) profile.contactEmail = body.contactEmail.trim().toLowerCase();
  if (body.contactPhone !== undefined) profile.contactPhone = body.contactPhone.trim();
  if (body.description !== undefined) profile.description = body.description.trim();

  await profile.save();

  res.status(200).json(
    successResponse('Insurer profile updated', {
      profile: toInsurerProfileSummary(profile),
    })
  );
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

export async function getInsurerPolicy(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const profile = await getInsurerProfileForUser(req.user!._id);
  const policy = await getOwnedPolicy(String(profile._id), String(req.params.id));

  res.status(200).json(
    successResponse('Insurer policy retrieved', {
      policy: toInsurerPolicyDetail(policy),
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

export async function listInsurerClaims(req: AuthenticatedRequest, res: Response): Promise<void> {
  const profile = await getInsurerProfileForUser(req.user!._id);
  const claims = await ClaimRequest.find({ insurerProfileId: profile._id }).sort({
    createdAt: -1,
  });

  res.status(200).json(
    successResponse('Insurer claims retrieved', {
      count: claims.length,
      claims: await Promise.all(claims.map(toInsurerClaimSummary)),
    })
  );
}

export async function updateInsurerClaimStatus(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const profile = await getInsurerProfileForUser(req.user!._id);
  const { status } = req.body as { status: ClaimStatus };
  const claim = await ClaimRequest.findOne({
    _id: req.params.id,
    insurerProfileId: profile._id,
  });

  if (!claim) {
    throw new AppError(404, 'Claim not found');
  }

  if (claim.status === 'approved' || claim.status === 'rejected') {
    throw new AppError(400, 'This claim has already been finalized');
  }

  const allowed: ClaimStatus[] =
    claim.status === 'submitted'
      ? ['in_review', 'approved', 'rejected']
      : ['approved', 'rejected'];

  if (!allowed.includes(status)) {
    throw new AppError(400, `Cannot move claim from ${claim.status} to ${status}`);
  }

  claim.status = status;
  await claim.save();

  const insurerName = profile.companyName;
  const statusCopy: Record<ClaimStatus, { title: string; body: string }> = {
    submitted: {
      title: 'Claim submitted',
      body: 'Your claim was sent to your insurer for review.',
    },
    in_review: {
      title: 'Claim under insurer review',
      body: `${insurerName} is reviewing your claim.`,
    },
    approved: {
      title: 'Claim approved',
      body: `${insurerName} approved your claim request.`,
    },
    rejected: {
      title: 'Claim rejected',
      body: `${insurerName} rejected your claim request. Contact them if you need more details.`,
    },
  };

  await Notification.create({
    userId: claim.userId,
    type: 'claim_status',
    title: statusCopy[status].title,
    body: statusCopy[status].body,
    metadata: {
      claimId: String(claim._id),
      purchaseId: String(claim.purchaseId),
      policyId: String(claim.policyId),
      status,
    },
  });

  res.status(200).json(
    successResponse('Claim status updated', {
      claim: await toInsurerClaimSummary(claim),
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
