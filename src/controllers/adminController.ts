import type { Response } from 'express';
import { ADMIN_ROLES } from '../constants/roles';
import type { UserRole } from '../constants/roles';
import { InsurerProfile } from '../models/InsurerProfile';
import { Lead } from '../models/Lead';
import { Notification } from '../models/Notification';
import { Policy } from '../models/Policy';
import { User } from '../models/User';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import { enrichPolicies } from '../services/policyPresentation';
import { toInsurerPolicySummary } from '../services/insurerContext';
import { sanitizeUser } from '../services/auth';
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

export async function getAnalytics(_req: AuthenticatedRequest, res: Response): Promise<void> {
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

  res.status(200).json(
    successResponse('Analytics retrieved', {
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
    })
  );
}
