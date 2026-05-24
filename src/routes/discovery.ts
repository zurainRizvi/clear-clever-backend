import { Router } from 'express';
import { asyncHandler } from '../controllers/authController';
import {
  comparePolicies,
  getPolicyById,
  getQuestions,
  getStoredQuestionnaireResponse,
  recommendPolicies,
} from '../controllers/discoveryController';
import { authenticate, optionalAuthenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import {
  categoryParamValidator,
  compareValidators,
  policyIdParamValidator,
  recommendValidators,
} from '../validators/discoveryValidators';

export const questionsRouter = Router();

questionsRouter.get(
  '/:category',
  validate([categoryParamValidator]),
  asyncHandler(getQuestions)
);

export const recommendRouter = Router();

recommendRouter.get(
  '/answers/:category',
  authenticate,
  validate([categoryParamValidator]),
  asyncHandler(getStoredQuestionnaireResponse)
);
recommendRouter.post(
  '/',
  optionalAuthenticate,
  validate(recommendValidators),
  asyncHandler(recommendPolicies)
);

export const compareRouter = Router();

compareRouter.post('/', validate(compareValidators), asyncHandler(comparePolicies));

export const policiesRouter = Router();

policiesRouter.get(
  '/:id',
  validate([policyIdParamValidator]),
  asyncHandler(getPolicyById)
);
