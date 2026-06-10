import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import { ClaimRequest } from '../models/ClaimRequest';
import { InsurerProfile } from '../models/InsurerProfile';
import { Notification } from '../models/Notification';
import { Purchase } from '../models/Purchase';
import { assertUserHasCnic } from '../services/claimCnicGuard';
import { toClaimSummary } from '../services/claimPresentation';
import { sanitizeIntelligenceReportForStorage } from '../services/claimIntelligenceService';
import {
  fingerprintAttachments,
  parseClaimAttachments,
  toStoredAttachments,
} from '../services/claimAttachmentService';
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
  assertUserHasCnic(req.user!);

  const {
    purchaseId,
    claimType,
    incidentDate,
    estimatedAmountPkr,
    description,
    intelligenceReport,
    attachments,
  } = req.body as {
    purchaseId: string;
    claimType: string;
    incidentDate: string;
    estimatedAmountPkr?: number;
    description: string;
    intelligenceReport?: unknown;
    attachments?: unknown;
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

  const storedReport = sanitizeIntelligenceReportForStorage(intelligenceReport);
  const parsedAttachments = attachments ? parseClaimAttachments(attachments) : [];
  const storedAttachments =
    parsedAttachments.length > 0 ? toStoredAttachments(parsedAttachments) : undefined;
  const attachmentFingerprint =
    parsedAttachments.length > 0 ? fingerprintAttachments(parsedAttachments) : undefined;

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
    ...(storedReport ? { intelligenceReport: storedReport } : {}),
    ...(storedAttachments ? { attachments: storedAttachments, attachmentFingerprint } : {}),
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

export async function resubmitClaim(req: AuthenticatedRequest, res: Response): Promise<void> {
  assertUserHasCnic(req.user!);

  const claim = await ClaimRequest.findOne({
    _id: req.params.id,
    userId: req.user!._id,
  });
  if (!claim) {
    throw new AppError(404, 'Claim not found');
  }

  if (claim.status === 'approved' || claim.status === 'rejected') {
    throw new AppError(400, 'This claim has been finalized and cannot be resubmitted');
  }

  const body = req.body as {
    description?: string;
    estimatedAmountPkr?: number;
    attachments?: unknown;
    intelligenceReport?: unknown;
    reuseIntelligenceReport?: boolean;
  };

  const parsedAttachments = body.attachments
    ? parseClaimAttachments(body.attachments)
    : parseClaimAttachments(claim.attachments ?? []);
  const nextFingerprint =
    parsedAttachments.length > 0 ? fingerprintAttachments(parsedAttachments) : claim.attachmentFingerprint;
  const attachmentsChanged =
    Boolean(nextFingerprint) &&
    Boolean(claim.attachmentFingerprint) &&
    nextFingerprint !== claim.attachmentFingerprint;

  if (body.description?.trim()) {
    claim.description = body.description.trim();
  }
  if (body.estimatedAmountPkr !== undefined) {
    claim.estimatedAmountPkr = body.estimatedAmountPkr;
  }

  if (parsedAttachments.length > 0) {
    claim.attachments = toStoredAttachments(parsedAttachments);
    claim.attachmentFingerprint = nextFingerprint;
  }

  if (attachmentsChanged) {
    const storedReport = sanitizeIntelligenceReportForStorage(body.intelligenceReport);
    if (!storedReport) {
      throw new AppError(400, 'Validation failed', [
        'Evidence changed — generate a new AI intelligence report before resubmitting.',
      ]);
    }
    claim.intelligenceReport = storedReport;
  } else if (body.reuseIntelligenceReport !== false && claim.intelligenceReport) {
    // Keep existing report — no new AI tokens used.
  } else if (body.intelligenceReport) {
    const storedReport = sanitizeIntelligenceReportForStorage(body.intelligenceReport);
    if (storedReport) {
      claim.intelligenceReport = storedReport;
    }
  }

  claim.status = 'submitted';
  claim.insurerComment = undefined;
  await claim.save();

  await Notification.create({
    userId: claim.userId,
    type: 'claim_submitted',
    title: 'Claim updated and resubmitted',
    body: 'Your insurer received the updated claim evidence.',
    metadata: {
      claimId: String(claim._id),
      purchaseId: String(claim.purchaseId),
      policyId: String(claim.policyId),
    },
  });

  const insurer = await InsurerProfile.findById(claim.insurerProfileId);
  if (insurer) {
    await Notification.create({
      userId: insurer.userId,
      type: 'claim_submitted',
      title: 'Claim resubmitted with updates',
      body: 'A policyholder resubmitted a claim with updated evidence or details.',
      metadata: {
        claimId: String(claim._id),
        purchaseId: String(claim.purchaseId),
        policyId: String(claim.policyId),
        seekerId: String(claim.userId),
      },
    });
  }

  res.status(200).json(
    successResponse('Claim resubmitted', {
      claim: await toClaimSummary(claim),
      attachmentsChanged,
    })
  );
}
