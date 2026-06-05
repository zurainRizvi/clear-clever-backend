import type { Response } from 'express';
import type { ClaimStatus } from '../models/ClaimRequest';
import { ClaimRequest } from '../models/ClaimRequest';
import { InsurerProfile } from '../models/InsurerProfile';
import type { IPolicyQuestion } from '../models/Policy';
import { Favorite } from '../models/Favorite';
import { Lead } from '../models/Lead';
import { Notification } from '../models/Notification';
import { Policy } from '../models/Policy';
import { Purchase } from '../models/Purchase';
import { User } from '../models/User';
import { toInsurerClaimSummary } from '../services/claimPresentation';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import {
  getInsurerProfileForUser,
  toInsurerPolicyDetail,
  toInsurerPolicySummary,
  toInsurerProfileSummary,
} from '../services/insurerContext';
import { buildInsurerAnalytics } from '../services/insurerAnalyticsService';
import { buildInsurerCustomerGroups } from '../services/insurerCustomerService';
import { buildInsurerDashboard } from '../services/insurerIntelligenceService';
import { createStarterPoliciesForInsurer } from '../services/insurerStarterPolicies';
import { applyPurchaseLifecycleAction } from '../services/purchaseLifecycleService';
import { AppError, successResponse } from '../utils/apiResponse';

export async function getInsurerAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
  const profile = await getInsurerProfileForUser(req.user!._id, req.user!);
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;

  const analytics = await buildInsurerAnalytics(profile._id, { from, to });

  res.status(200).json(
    successResponse('Insurer analytics retrieved', {
      analytics,
    })
  );
}

export async function getInsurerDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
  const profile = await getInsurerProfileForUser(req.user!._id, req.user!);
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;

  const dashboard = await buildInsurerDashboard(profile._id, { from, to });

  res.status(200).json(
    successResponse('Insurer dashboard intelligence retrieved', {
      dashboard,
    })
  );
}

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

export async function createInsurerProfile(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const user = req.user!;

  if (user.role !== 'insurer') {
    throw new AppError(403, 'Only insurance providers can create a provider profile');
  }

  if (user.status !== 'pendingVerification') {
    throw new AppError(400, 'Provider profile can only be created during onboarding');
  }

  const existing = await InsurerProfile.findOne({ userId: user._id });
  if (existing) {
    throw new AppError(409, 'Provider profile already exists for this account');
  }

  const body = req.body as {
    companyName: string;
    slug: string;
    contactPhone: string;
    description?: string;
    websiteUrl?: string;
  };

  const slug = body.slug.toLowerCase().trim();
  const slugTaken = await InsurerProfile.findOne({ slug });
  if (slugTaken) {
    throw new AppError(409, 'This portal slug is already taken');
  }

  const profile = await InsurerProfile.create({
    userId: user._id,
    companyName: body.companyName.trim(),
    slug,
    contactEmail: user.email,
    contactPhone: body.contactPhone.trim(),
    description: body.description?.trim(),
    websiteUrl: body.websiteUrl?.trim(),
  });

  const policiesCreated = await createStarterPoliciesForInsurer(profile);

  res.status(201).json(
    successResponse('Provider profile created', {
      profile: toInsurerProfileSummary(profile),
      policiesCreated,
    })
  );
}

export async function getInsurerProfile(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const profile = await getInsurerProfileForUser(req.user!._id, req.user!);
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
  const profile = await getInsurerProfileForUser(req.user!._id, req.user!);
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
  const profile = await getInsurerProfileForUser(req.user!._id, req.user!);
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
  const profile = await getInsurerProfileForUser(req.user!._id, req.user!);
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
  const profile = await getInsurerProfileForUser(req.user!._id, req.user!);
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
  const profile = await getInsurerProfileForUser(req.user!._id, req.user!);
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
  const profile = await getInsurerProfileForUser(req.user!._id, req.user!);
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
  const profile = await getInsurerProfileForUser(req.user!._id, req.user!);
  const body = req.body as { status: ClaimStatus; revert?: boolean };
  const { status } = body;
  const claim = await ClaimRequest.findOne({
    _id: req.params.id,
    insurerProfileId: profile._id,
  });

  if (!claim) {
    throw new AppError(404, 'Claim not found');
  }

  if ((claim.status === 'approved' || claim.status === 'rejected') && status === 'in_review') {
    if (!body.revert) {
      throw new AppError(400, 'Use revert: true to reopen a finalized claim');
    }
    claim.status = 'in_review';
    await claim.save();
    await Notification.create({
      userId: claim.userId,
      type: 'claim_status',
      title: 'Claim review reopened',
      body: `${profile.companyName} reopened your claim for further review.`,
      metadata: {
        claimId: String(claim._id),
        purchaseId: String(claim.purchaseId),
        policyId: String(claim.policyId),
        status: 'in_review',
      },
    });
    res.status(200).json(
      successResponse('Claim status updated', {
        claim: await toInsurerClaimSummary(claim),
      })
    );
    return;
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
  const profile = await getInsurerProfileForUser(req.user!._id, req.user!);
  const [leads, customers] = await Promise.all([
    Lead.find({ insurerProfileId: profile._id }).sort({ createdAt: -1 }),
    buildInsurerCustomerGroups(profile._id),
  ]);

  const userIds = [...new Set(leads.map((lead) => String(lead.userId)))];
  const policyIds = [
    ...new Set(leads.filter((lead) => lead.policyId).map((lead) => String(lead.policyId))),
  ];

  const [users, policies] = await Promise.all([
    User.find({ _id: { $in: userIds } }),
    policyIds.length > 0
      ? Policy.find({ _id: { $in: policyIds }, insurerProfileId: profile._id })
      : Promise.resolve([]),
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
      seenAt: lead.seenAt?.toISOString(),
      isNew: lead.status === 'new' && !lead.seenAt,
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
      unseenNewCount: customers.filter((customer) => customer.isNew).length,
      leads: items,
      customers,
    })
  );
}

export async function revokeInsurerPurchase(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const profile = await getInsurerProfileForUser(req.user!._id, req.user!);
  const purchase = await applyPurchaseLifecycleAction(
    String(req.params.id),
    profile._id,
    req.user!._id,
    'revoke'
  );

  res.status(200).json(
    successResponse('Purchase revoked', {
      purchase: {
        id: String(purchase._id),
        status: purchase.status,
      },
    })
  );
}

export async function terminateInsurerPurchase(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const profile = await getInsurerProfileForUser(req.user!._id, req.user!);
  const purchase = await applyPurchaseLifecycleAction(
    String(req.params.id),
    profile._id,
    req.user!._id,
    'terminate'
  );

  res.status(200).json(
    successResponse('Purchase terminated', {
      purchase: {
        id: String(purchase._id),
        status: purchase.status,
      },
    })
  );
}

export async function markInsurerLeadSeen(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const profile = await getInsurerProfileForUser(req.user!._id, req.user!);
  const lead = await Lead.findOne({
    _id: req.params.id,
    insurerProfileId: profile._id,
  });

  if (!lead) {
    throw new AppError(404, 'Lead not found');
  }

  if (!lead.seenAt) {
    lead.seenAt = new Date();
    await lead.save();
  }

  res.status(200).json(
    successResponse('Lead marked as seen', {
      lead: {
        id: String(lead._id),
        seenAt: lead.seenAt.toISOString(),
        isNew: false,
      },
    })
  );
}

export async function deleteInsurerPolicy(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const profile = await getInsurerProfileForUser(req.user!._id, req.user!);
  const policy = await getOwnedPolicy(String(profile._id), String(req.params.id));

  const [purchaseCount, claimCount] = await Promise.all([
    Purchase.countDocuments({ policyId: policy._id }),
    ClaimRequest.countDocuments({ policyId: policy._id }),
  ]);

  if (purchaseCount > 0 || claimCount > 0) {
    throw new AppError(
      409,
      'Cannot delete a policy with existing purchases or claims. Contact support if you need archival.'
    );
  }

  if (policy.status === 'approved' && purchaseCount > 0) {
    throw new AppError(409, 'Approved policies with purchase history cannot be deleted');
  }

  await Promise.all([
    Lead.deleteMany({ policyId: policy._id }),
    Favorite.deleteMany({ policyId: policy._id }),
    Policy.deleteOne({ _id: policy._id }),
  ]);

  res.status(200).json(
    successResponse('Policy deleted', {
      policyId: String(policy._id),
    })
  );
}
