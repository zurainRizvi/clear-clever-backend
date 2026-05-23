import { Router } from 'express';
import { asyncHandler } from '../controllers/authController';
import {
  comparePolicies,
  getPolicyById,
  getQuestions,
  recommendPolicies,
} from '../controllers/discoveryController';
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

recommendRouter.post('/', validate(recommendValidators), asyncHandler(recommendPolicies));

export const compareRouter = Router();

compareRouter.post('/', validate(compareValidators), asyncHandler(comparePolicies));

export const policiesRouter = Router();

policiesRouter.get(
  '/:id',
  validate([policyIdParamValidator]),
  asyncHandler(getPolicyById)
);
