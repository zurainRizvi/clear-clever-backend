import { InsurerProfile } from '../models/InsurerProfile';
import { Policy } from '../models/Policy';
import { User } from '../models/User';
import type { IClaimRequestDocument } from '../models/ClaimRequest';
import { scoreClaimRisk } from './claimRiskService';

export async function toClaimSummary(claim: IClaimRequestDocument) {
  const [policy, insurer] = await Promise.all([
    Policy.findById(claim.policyId),
    InsurerProfile.findById(claim.insurerProfileId),
  ]);

  return {
    id: String(claim._id),
    purchaseId: String(claim.purchaseId),
    claimType: claim.claimType,
    incidentDate: claim.incidentDate.toISOString(),
    estimatedAmountPkr: claim.estimatedAmountPkr,
    description: claim.description,
    status: claim.status,
    createdAt: claim.createdAt.toISOString(),
    updatedAt: claim.updatedAt.toISOString(),
    ...(claim.intelligenceReport ? { intelligenceReport: claim.intelligenceReport } : {}),
    ...(claim.attachments?.length ? { attachments: claim.attachments } : {}),
    ...(claim.insurerComment ? { insurerComment: claim.insurerComment } : {}),
    policy: policy
      ? {
          id: String(policy._id),
          name: policy.name,
          category: policy.category,
        }
      : undefined,
    insurer: insurer
      ? {
          id: String(insurer._id),
          companyName: insurer.companyName,
          contactPhone: insurer.contactPhone,
        }
      : undefined,
  };
}

export async function toInsurerClaimSummary(claim: IClaimRequestDocument) {
  const [policy, seeker] = await Promise.all([
    Policy.findById(claim.policyId),
    User.findById(claim.userId),
  ]);

  const mlRisk = await scoreClaimRisk(claim);

  return {
    ...(await toClaimSummary(claim)),
    seeker: seeker
      ? {
          id: String(seeker._id),
          fullName: seeker.fullName,
          email: seeker.email,
          phone: seeker.phone,
        }
      : undefined,
    policy: policy
      ? {
          id: String(policy._id),
          name: policy.name,
          category: policy.category,
        }
      : undefined,
    ...(mlRisk ? { mlRisk } : {}),
  };
}
