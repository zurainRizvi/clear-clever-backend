import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import { ClaimRequest } from '../models/ClaimRequest';
import { InsurerProfile } from '../models/InsurerProfile';
import { Notification } from '../models/Notification';
import { Purchase } from '../models/Purchase';
import { toClaimSummary } from '../services/claimPresentation';
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
  const insurer = await InsurerProfile.findById(purchase.insurerProfileId);

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

  await Notification.insertMany(
    [
      {
        userId: purchase.userId,
        type: 'claim_submitted',
        title: 'Claim request submitted',
        body: 'Your claim was sent to your insurer for review and approval.',
        metadata: {
          claimId: String(claim._id),
          purchaseId: String(purchase._id),
          policyId: String(purchase.policyId),
        },
      },
      insurer
        ? {
            userId: insurer.userId,
            type: 'claim_submitted',
            title: 'New claim awaiting your review',
            body: 'A policy seeker submitted a claim on your policy. Open Claims to review and approve or reject it.',
            metadata: {
              claimId: String(claim._id),
              purchaseId: String(purchase._id),
              policyId: String(purchase.policyId),
              seekerId: String(purchase.userId),
            },
          }
        : null,
    ].filter((item): item is NonNullable<typeof item> => item !== null)
  );

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
