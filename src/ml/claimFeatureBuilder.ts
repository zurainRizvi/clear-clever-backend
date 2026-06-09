import { ClaimRequest } from '../models/ClaimRequest';
import { Policy } from '../models/Policy';
import { Purchase } from '../models/Purchase';
import type { IClaimRequestDocument } from '../models/ClaimRequest';
import { bucketCityRegion } from './featureEncoding';
import type { ClaimRiskRawFeatures } from './types';

function daysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

export async function buildClaimRiskFeatures(
  claim: IClaimRequestDocument
): Promise<ClaimRiskRawFeatures> {
  const [policy, purchase] = await Promise.all([
    Policy.findById(claim.policyId),
    Purchase.findById(claim.purchaseId),
  ]);

  const premiumMonthly = policy?.premiumMonthlyPkr ?? 1;
  const estimated = claim.estimatedAmountPkr ?? 0;
  const now = claim.createdAt ?? new Date();

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [userClaims7d, userClaims30d, userRejected] = await Promise.all([
    ClaimRequest.countDocuments({
      userId: claim.userId,
      createdAt: { $gte: sevenDaysAgo, $lte: now },
      _id: { $ne: claim._id },
    }),
    ClaimRequest.countDocuments({
      userId: claim.userId,
      createdAt: { $gte: thirtyDaysAgo, $lte: now },
      _id: { $ne: claim._id },
    }),
    ClaimRequest.countDocuments({
      userId: claim.userId,
      status: 'rejected',
      _id: { $ne: claim._id },
    }),
  ]);

  const city = purchase?.answers?.city;

  return {
    claim_type: claim.claimType,
    policy_category: policy?.category ?? 'others',
    estimated_amount_pkr: estimated,
    description_length: claim.description.length,
    days_incident_to_submit: daysBetween(claim.incidentDate, now),
    amount_to_premium_ratio: estimated / Math.max(premiumMonthly, 1),
    user_claims_7d: userClaims7d,
    user_claims_30d: userClaims30d,
    user_rejected_claims: userRejected,
    city_region: bucketCityRegion(city),
  };
}
