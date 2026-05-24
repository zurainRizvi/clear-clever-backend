import { Router } from 'express';
import { asyncHandler } from '../controllers/authController';
import { createClaim, getClaim, listClaims } from '../controllers/claimsController';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { claimIdParamValidator, createClaimValidators } from '../validators/claimValidators';

export const claimsRouter = Router();

claimsRouter.use(authenticate);

claimsRouter.get('/', asyncHandler(listClaims));
claimsRouter.post('/', validate(createClaimValidators), asyncHandler(createClaim));
claimsRouter.get('/:id', validate([claimIdParamValidator]), asyncHandler(getClaim));
