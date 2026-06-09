import type { Response } from 'express';
import { ADMIN_ROLES } from '../constants/roles';
import type { UserRole } from '../constants/roles';
import { ClaimRequest } from '../models/ClaimRequest';
import { Conversation } from '../models/Conversation';
import { InsurerProfile } from '../models/InsurerProfile';
import { Lead } from '../models/Lead';
import { Notification } from '../models/Notification';
import { Policy } from '../models/Policy';
import { Purchase } from '../models/Purchase';
import { User } from '../models/User';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import { enrichPolicies } from '../services/policyPresentation';
import { toInsurerPolicySummary } from '../services/insurerContext';
import { sanitizeUser } from '../services/auth';
import { deleteInsurerAccountPermanently } from '../services/insurerDeletion';
import { buildAdminMlOverview } from '../services/adminMlOverviewService';
import { getAssistantHealthReport } from '../services/assistantHealthService';
import { getInfrastructureHealth } from '../services/infrastructureHealth';
import { getDatabaseStatus } from '../config/db';
import { isBrevoConfigured, isSmtpConfigured, loadEnv } from '../config/env';
import { getSmtpProbeResult } from '../config/smtpStatus';
import { getEmailProvider, isOutboundEmailConfigured } from '../services/emailDelivery';
import { AppError, successResponse } from '../utils/apiResponse';

export async function listPendingPolicies(
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const policies = await Policy.find({ status: 'pending' }).sort({ createdAt: 1 });
  const insurerIds = [...new Set(policies.map((policy) => String(policy.insurerProfileId)))];
  const insurers = await InsurerProfile.find({ _id: { $in: insurerIds } });
  const insurerById = new Map(insurers.map((insurer) => [String(insurer._id), insurer]));

  res.status(200).json(
    successResponse('Pending policies retrieved', {
      count: policies.length,
      policies: policies.map((policy) => {
        const insurer = insurerById.get(String(policy.insurerProfileId));
        return {
          ...toInsurerPolicySummary(policy),
          description: policy.description,
          insurer: insurer
            ? {
                companyName: insurer.companyName,
                slug: insurer.slug,
              }
            : undefined,
        };
      }),
    })
  );
}

export async function approvePolicy(req: AuthenticatedRequest, res: Response): Promise<void> {
  const policy = await Policy.findById(req.params.id);
  if (!policy) {
    throw new AppError(404, 'Policy not found');
  }
  if (policy.status === 'approved') {
    res.status(200).json(
      successResponse('Policy is already approved', {
        policy: toInsurerPolicySummary(policy),
      })
    );
    return;
  }

  policy.status = 'approved';
  policy.rejectionReason = undefined;
  policy.reviewedAt = new Date();
  policy.reviewedBy = req.user!._id;
  await policy.save();

  const [publicPolicy] = await enrichPolicies([policy]);

  res.status(200).json(
    successResponse('Policy approved', {
      policy: toInsurerPolicySummary(policy),
      publicPolicy,
    })
  );
}

export async function rejectPolicy(req: AuthenticatedRequest, res: Response): Promise<void> {
  const policy = await Policy.findById(req.params.id);
  if (!policy) {
    throw new AppError(404, 'Policy not found');
  }

  const { reason } = req.body as { reason?: string };

  policy.status = 'rejected';
  policy.rejectionReason = reason?.trim() || undefined;
  policy.reviewedAt = new Date();
  policy.reviewedBy = req.user!._id;
  await policy.save();

  const insurer = await InsurerProfile.findById(policy.insurerProfileId);
  if (insurer) {
    const reasonText = policy.rejectionReason
      ? ` Reason: ${policy.rejectionReason}`
      : ' Update the policy and resubmit it for review.';
    await Notification.create({
      userId: insurer.userId,
      type: 'policy_review',
      title: 'Policy needs revision',
      body: `Your policy "${policy.name}" was rejected.${reasonText}`,
      metadata: {
        policyId: String(policy._id),
        status: 'rejected',
        rejectionReason: policy.rejectionReason,
      },
    });
  }

  res.status(200).json(
    successResponse('Policy rejected', {
      policy: toInsurerPolicySummary(policy),
    })
  );
}

export async function listUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  const filter =
    req.user!.role === 'superadmin' ? {} : { role: { $ne: 'superadmin' } };
  const users = await User.find(filter).sort({ createdAt: -1 });

  res.status(200).json(
    successResponse('Users retrieved', {
      count: users.length,
      users: users.map(sanitizeUser),
    })
  );
}

export async function changeUserRole(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { role } = req.body as { role: UserRole };
  const target = await User.findById(req.params.id);
  if (!target) {
    throw new AppError(404, 'User not found');
  }

  if (target.role === 'superadmin' && req.user!.role !== 'superadmin') {
    throw new AppError(403, 'Only a superadmin may change a superadmin account');
  }
  if (role === 'superadmin' && req.user!.role !== 'superadmin') {
    throw new AppError(403, 'Only a superadmin may assign the superadmin role');
  }
  if (String(target._id) === String(req.user!._id) && !ADMIN_ROLES.includes(role)) {
    throw new AppError(400, 'You cannot remove your own admin access');
  }

  target.role = role;
  await target.save();

  res.status(200).json(
    successResponse('User role updated', {
      user: sanitizeUser(target),
    })
  );
}

export async function deactivateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  const target = await User.findById(req.params.id);
  if (!target) {
    throw new AppError(404, 'User not found');
  }

  if (String(target._id) === String(req.user!._id)) {
    throw new AppError(400, 'You cannot deactivate your own account');
  }
  if (target.role === 'superadmin' && req.user!.role !== 'superadmin') {
    throw new AppError(403, 'Only a superadmin may deactivate a superadmin account');
  }

  target.status = 'inactive';
  await target.save();

  res.status(200).json(
    successResponse('User deactivated', {
      user: sanitizeUser(target),
    })
  );
}

export async function reactivateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  const target = await User.findById(req.params.id);
  if (!target) {
    throw new AppError(404, 'User not found');
  }

  if (target.role === 'superadmin' && req.user!.role !== 'superadmin') {
    throw new AppError(403, 'Only a superadmin may reactivate a superadmin account');
  }

  target.status = 'active';
  await target.save();

  res.status(200).json(
    successResponse('User reactivated', {
      user: sanitizeUser(target),
    })
  );
}

function assertSuperadmin(req: AuthenticatedRequest): void {
  if (req.user!.role !== 'superadmin') {
    throw new AppError(403, 'Only a superadmin may perform this action');
  }
}

async function loadInsurerTarget(userId: string) {
  const target = await User.findById(userId);
  if (!target || target.role !== 'insurer') {
    throw new AppError(404, 'Insurance provider not found');
  }
  const profile = await InsurerProfile.findOne({ userId: target._id });
  return { target, profile };
}

export async function listInsurers(_req: AuthenticatedRequest, res: Response): Promise<void> {
  const insurers = await User.find({ role: 'insurer' }).sort({ createdAt: -1 });
  const profiles = await InsurerProfile.find({
    userId: { $in: insurers.map((insurer) => insurer._id) },
  });
  const profileByUserId = new Map(profiles.map((profile) => [String(profile.userId), profile]));
  const profileIds = profiles.map((profile) => profile._id);
  const pendingByProfile = await Policy.aggregate<{ _id: typeof profileIds[number]; count: number }>([
    { $match: { insurerProfileId: { $in: profileIds }, status: 'pending' } },
    { $group: { _id: '$insurerProfileId', count: { $sum: 1 } } },
  ]);
  const pendingMap = new Map(pendingByProfile.map((row) => [String(row._id), row.count]));
  const starterByProfile = await Policy.aggregate<{ _id: typeof profileIds[number]; count: number }>([
    {
      $match: {
        insurerProfileId: { $in: profileIds },
        slug: { $regex: /-starter$/ },
      },
    },
    { $group: { _id: '$insurerProfileId', count: { $sum: 1 } } },
  ]);
  const starterMap = new Map(starterByProfile.map((row) => [String(row._id), row.count]));

  res.status(200).json(
    successResponse('Insurance providers retrieved', {
      count: insurers.length,
      insurers: insurers.map((insurer) => {
        const profile = profileByUserId.get(String(insurer._id));
        return {
          user: sanitizeUser(insurer),
          profile: profile
            ? {
                id: String(profile._id),
                companyName: profile.companyName,
                slug: profile.slug,
                contactEmail: profile.contactEmail,
                contactPhone: profile.contactPhone,
              }
            : null,
          pendingPolicies: profile ? pendingMap.get(String(profile._id)) ?? 0 : 0,
          starterPoliciesCount: profile ? starterMap.get(String(profile._id)) ?? 0 : 0,
        };
      }),
    })
  );
}

export async function approveInsurer(req: AuthenticatedRequest, res: Response): Promise<void> {
  assertSuperadmin(req);
  const { target, profile } = await loadInsurerTarget(String(req.params.id));

  if (target.status === 'active') {
    res.status(200).json(
      successResponse('Provider is already approved', {
        user: sanitizeUser(target),
        profile: profile
          ? { id: String(profile._id), companyName: profile.companyName, slug: profile.slug }
          : null,
      })
    );
    return;
  }

  if (target.status === 'inactive') {
    throw new AppError(
      400,
      'This provider was rejected or removed. Permanent deletion is required before they can re-apply with a new account.'
    );
  }

  target.status = 'active';
  await target.save();

  if (profile) {
    await Notification.create({
      userId: target._id,
      type: 'account_review',
      title: 'Provider account approved',
      body: `Your ClearClever provider account for ${profile.companyName} is now active. You can sign in and manage policies.`,
      metadata: { insurerProfileId: String(profile._id), status: 'approved' },
    });
  }

  res.status(200).json(
    successResponse('Insurance provider approved', {
      user: sanitizeUser(target),
      profile: profile
        ? { id: String(profile._id), companyName: profile.companyName, slug: profile.slug }
        : null,
    })
  );
}

export async function rejectInsurer(req: AuthenticatedRequest, res: Response): Promise<void> {
  assertSuperadmin(req);
  const { target, profile } = await loadInsurerTarget(String(req.params.id));

  if (target.status !== 'pendingVerification') {
    throw new AppError(400, 'Only pending provider applications can be rejected');
  }

  const { reason } = req.body as { reason?: string };
  target.status = 'inactive';
  await target.save();

  if (profile) {
    const reasonText = reason?.trim()
      ? ` Reason: ${reason.trim()}`
      : ' Contact support if you have questions.';
    await Notification.create({
      userId: target._id,
      type: 'account_review',
      title: 'Provider application not approved',
      body: `Your provider application for ${profile.companyName} was not approved.${reasonText}`,
      metadata: {
        insurerProfileId: String(profile._id),
        status: 'rejected',
        rejectionReason: reason?.trim(),
      },
    });
  }

  res.status(200).json(
    successResponse('Insurance provider rejected', {
      user: sanitizeUser(target),
    })
  );
}

export async function revokeInsurer(req: AuthenticatedRequest, res: Response): Promise<void> {
  assertSuperadmin(req);
  const { target, profile } = await loadInsurerTarget(String(req.params.id));

  if (target.status !== 'active') {
    throw new AppError(400, 'Only approved providers can be removed from the platform');
  }

  target.status = 'inactive';
  await target.save();

  if (profile) {
    await Notification.create({
      userId: target._id,
      type: 'account_review',
      title: 'Provider access removed',
      body: `Your ClearClever provider account for ${profile.companyName} has been removed. Sign-in is disabled until a super admin reactivates or deletes the account.`,
      metadata: { insurerProfileId: String(profile._id), status: 'revoked' },
    });
  }

  res.status(200).json(
    successResponse('Insurance provider removed from platform', {
      user: sanitizeUser(target),
    })
  );
}

export async function deleteInsurerPermanently(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  assertSuperadmin(req);
  const { target } = await loadInsurerTarget(String(req.params.id));

  await deleteInsurerAccountPermanently(target._id);

  res.status(200).json(
    successResponse('Insurance provider permanently deleted', {
      deletedUserId: String(target._id),
      message:
        'The provider account and all related data were permanently removed. They must create a new account to return.',
    })
  );
}

export async function getAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
  const [
    totalUsers,
    activeUsers,
    inactiveUsers,
    usersByRole,
    policiesPending,
    policiesApproved,
    policiesRejected,
    totalLeads,
    leadsNew,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ status: 'active' }),
    User.countDocuments({ status: 'inactive' }),
    User.aggregate<{ _id: UserRole; count: number }>([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]),
    Policy.countDocuments({ status: 'pending' }),
    Policy.countDocuments({ status: 'approved' }),
    Policy.countDocuments({ status: 'rejected' }),
    Lead.countDocuments(),
    Lead.countDocuments({ status: 'new' }),
  ]);

  const roleCounts = Object.fromEntries(
    usersByRole.map((entry) => [entry._id, entry.count])
  ) as Record<UserRole, number>;

  const payload: Record<string, unknown> = {
    users: {
      total: totalUsers,
      active: activeUsers,
      inactive: inactiveUsers,
      byRole: roleCounts,
    },
    policies: {
      pending: policiesPending,
      approved: policiesApproved,
      rejected: policiesRejected,
      total: policiesPending + policiesApproved + policiesRejected,
    },
    leads: {
      total: totalLeads,
      new: leadsNew,
    },
  };

  if (req.user!.role === 'superadmin') {
    const [
      insurersTotal,
      insurersPending,
      insurersActive,
      insurersInactive,
      staffAdmins,
      purchasesTotal,
      claimsTotal,
      conversationsTotal,
    ] = await Promise.all([
      User.countDocuments({ role: 'insurer' }),
      User.countDocuments({ role: 'insurer', status: 'pendingVerification' }),
      User.countDocuments({ role: 'insurer', status: 'active' }),
      User.countDocuments({ role: 'insurer', status: 'inactive' }),
      User.countDocuments({ role: { $in: ['admin', 'superadmin'] } }),
      Purchase.countDocuments(),
      ClaimRequest.countDocuments(),
      Conversation.countDocuments(),
    ]);

    payload.platform = {
      insurers: {
        total: insurersTotal,
        pendingVerification: insurersPending,
        active: insurersActive,
        inactive: insurersInactive,
      },
      staff: {
        admins: staffAdmins,
        superadmins: roleCounts.superadmin ?? 0,
      },
      purchases: purchasesTotal,
      claims: claimsTotal,
      conversations: conversationsTotal,
    };
  }

  res.status(200).json(successResponse('Analytics retrieved', payload));
}

export async function getAdminSystemHealth(_req: AuthenticatedRequest, res: Response): Promise<void> {
  const env = loadEnv();
  const dbStatus = getDatabaseStatus();
  const emailProbe = getSmtpProbeResult();
  const provider = getEmailProvider(env);
  const infrastructure = await getInfrastructureHealth();
  const assistant = await getAssistantHealthReport(env);

  res.status(200).json(
    successResponse('System health retrieved', {
      service: 'clearclever-api',
      environment: env.NODE_ENV,
      database: dbStatus,
      email: {
        provider,
        configured: isOutboundEmailConfigured(env),
        ready: emailProbe?.ok === true,
        error: emailProbe && !emailProbe.ok ? emailProbe.error : undefined,
        brevoKeySet: isBrevoConfigured(env),
        smtpVarsSet: isSmtpConfigured(env),
        hint:
          !isBrevoConfigured(env) && env.NODE_ENV === 'production'
            ? 'Add BREVO_API_KEY on Render, Save, then Manual Deploy (env changes do not apply until redeploy).'
            : !emailProbe?.ok && isBrevoConfigured(env)
              ? 'Brevo key is set but verify failed — check API key and that sender Gmail is verified in Brevo.'
              : undefined,
        renderFreeTierNote:
          provider === 'smtp' && env.NODE_ENV === 'production'
            ? 'Gmail SMTP is blocked on Render free tier; set BREVO_API_KEY or upgrade Render.'
            : undefined,
      },
      infrastructure: {
        ...infrastructure,
        gemini: {
          ok: assistant.configured ? assistant.ok : false,
          latencyMs: assistant.latencyMs,
          label: assistant.label,
          detail: assistant.detail,
        },
      },
      assistant,
      timestamp: new Date().toISOString(),
    })
  );
}

export async function getAdminMlOverview(_req: AuthenticatedRequest, res: Response): Promise<void> {
  const overview = await buildAdminMlOverview();
  res.status(200).json(successResponse('ML overview retrieved', overview));
}
