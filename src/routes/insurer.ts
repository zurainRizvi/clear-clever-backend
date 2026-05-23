import { Router } from 'express';
import { asyncHandler } from '../controllers/authController';
import {
  createInsurerPolicy,
  listInsurerLeads,
  listInsurerPolicies,
  updateInsurerPolicy,
} from '../controllers/insurerController';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  createInsurerPolicyValidators,
  updateInsurerPolicyValidators,
} from '../validators/insurerValidators';

export const insurerRouter = Router();

insurerRouter.use(authenticate, authorize('insurer'));

insurerRouter.get('/policies', asyncHandler(listInsurerPolicies));
insurerRouter.post(
  '/policies',
  validate(createInsurerPolicyValidators),
  asyncHandler(createInsurerPolicy)
);
insurerRouter.put(
  '/policies/:id',
  validate(updateInsurerPolicyValidators),
  asyncHandler(updateInsurerPolicy)
);
insurerRouter.get('/leads', asyncHandler(listInsurerLeads));
