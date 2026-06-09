import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import { CLAIM_TYPES, type ClaimType } from '../models/ClaimRequest';
import { analyzeClaimIntelligence } from '../services/claimIntelligenceService';
import { assertUserHasCnic } from '../services/claimCnicGuard';
import { successResponse } from '../utils/apiResponse';

export async function analyzeClaimIntelligenceHandler(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  assertUserHasCnic(req.user!);

  const body = req.body as {
    purchaseId: string;
    claimType: string;
    description: string;
    estimatedAmountPkr?: number;
    incidentDate?: string;
    attachments: unknown;
  };

  const report = await analyzeClaimIntelligence({
    user: req.user!,
    purchaseId: body.purchaseId,
    claimType: body.claimType as ClaimType,
    description: body.description,
    estimatedAmountPkr: body.estimatedAmountPkr,
    incidentDate: body.incidentDate,
    attachments: body.attachments,
  });

  res.status(200).json(
    successResponse('AI Claims Intelligence Report generated', {
      intelligenceReport: report,
    })
  );
}

export { CLAIM_TYPES };
