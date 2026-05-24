import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import { ClaimRequest, type IClaimRequestDocument } from '../models/ClaimRequest';
import { InsurerProfile } from '../models/InsurerProfile';
import { Notification } from '../models/Notification';
import { Policy } from '../models/Policy';
import { Purchase } from '../models/Purchase';
import { AppError, successResponse } from '../utils/apiResponse';

export async function listClaims(req: AuthenticatedRequest, res: Response): Promise<void> {
  const claims = await ClaimRequest.find({ userId: req.user!._id }).sort({ createdAt: -1 });
  const items = await Promise.all(claims.map((claim) => toClaimSummary(claim)));

  res.status(200).json(
    successResponse('Claims retrieved', {
      count: items.length,
      claims: items,
    })
  );
}

export async function createClaim(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { purchaseId, claimType, incidentDate, estimatedAmountPkr, description } = req.body as {
    purchaseId: string;
    claimType: string;
    incidentDate: string;
    estimatedAmountPkr?: number;
    description: string;
  };

  const purchase = await Purchase.findOne({
    _id: purchaseId,
    userId: req.user!._id,
    status: 'completed',
  });
  if (!purchase) {
    throw new AppError(400, 'Claims can only be created for your completed purchases');
  }

  const claim = await ClaimRequest.create({
    userId: purchase.userId,
    purchaseId: purchase._id,
    policyId: purchase.policyId,
    insurerProfileId: purchase.insurerProfileId,
    claimType,
    incidentDate: new Date(incidentDate),
    estimatedAmountPkr,
    description,
    status: 'submitted',
  });

  await Notification.create({
    userId: purchase.userId,
    type: 'claim_submitted',
    title: 'Claim request submitted',
    body: 'Your claim request was submitted and is now under review.',
    metadata: {
      claimId: String(claim._id),
      purchaseId: String(purchase._id),
      policyId: String(purchase.policyId),
    },
  });

  res.status(201).json(
    successResponse('Claim submitted', {
      claim: await toClaimSummary(claim),
    })
  );
}

export async function getClaim(req: AuthenticatedRequest, res: Response): Promise<void> {
  const claim = await ClaimRequest.findOne({
    _id: req.params.id,
    userId: req.user!._id,
  });
  if (!claim) {
    throw new AppError(404, 'Claim not found');
  }

  res.status(200).json(successResponse('Claim retrieved', { claim: await toClaimSummary(claim) }));
}

async function toClaimSummary(claim: IClaimRequestDocument) {
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
