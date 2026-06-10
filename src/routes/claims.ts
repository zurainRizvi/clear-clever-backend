import { Router } from 'express';
import { asyncHandler } from '../controllers/authController';
import { analyzeClaimIntelligenceHandler } from '../controllers/claimIntelligenceController';
import { createClaim, getClaim, listClaims, resubmitClaim } from '../controllers/claimsController';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { analyzeClaimIntelligenceValidators } from '../validators/claimIntelligenceValidators';
import {
  claimIdParamValidator,
  createClaimValidators,
  resubmitClaimValidators,
} from '../validators/claimValidators';

export const claimsRouter = Router();

claimsRouter.use(authenticate);

claimsRouter.get('/', asyncHandler(listClaims));
claimsRouter.post(
  '/analyze-intelligence',
  validate(analyzeClaimIntelligenceValidators),
  asyncHandler(analyzeClaimIntelligenceHandler)
);
claimsRouter.post('/', validate(createClaimValidators), asyncHandler(createClaim));
claimsRouter.patch(
  '/:id/resubmit',
  validate(resubmitClaimValidators),
  asyncHandler(resubmitClaim)
);
claimsRouter.get('/:id', validate([claimIdParamValidator]), asyncHandler(getClaim));
