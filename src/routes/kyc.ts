import { Router } from 'express';
import { asyncHandler } from '../controllers/authController';
import {
  deriveKycHandler,
  getKycStatusHandler,
  verifyKycHandler,
} from '../controllers/kycController';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { deriveKycValidators, verifyKycValidators } from '../validators/kycValidators';

export const kycRouter = Router();

kycRouter.use(authenticate);

kycRouter.get('/status', asyncHandler(getKycStatusHandler));
kycRouter.post('/derive', validate(deriveKycValidators), asyncHandler(deriveKycHandler));
kycRouter.post('/verify', validate(verifyKycValidators), asyncHandler(verifyKycHandler));
