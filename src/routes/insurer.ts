import { Router } from 'express';
import { asyncHandler } from '../controllers/authController';
import {
  createInsurerPolicy,
  createInsurerProfile,
  getInsurerPolicy,
  getInsurerProfile,
  listInsurerClaims,
  deleteInsurerPolicy,
  getInsurerAnalytics,
  getInsurerDashboard,
  listInsurerLeads,
  listInsurerPolicies,
  markInsurerLeadSeen,
  revokeInsurerPurchase,
  terminateInsurerPurchase,
  updateInsurerClaimStatus,
  updateInsurerPolicy,
  updateInsurerProfile,
} from '../controllers/insurerController';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  createInsurerPolicyValidators,
  createInsurerProfileValidators,
  insurerPolicyIdValidator,
  updateInsurerClaimValidators,
  updateInsurerPolicyValidators,
  updateInsurerProfileValidators,
} from '../validators/insurerValidators';

export const insurerRouter = Router();

insurerRouter.use(authenticate, authorize('insurer'));

insurerRouter.post(
  '/profile',
  validate(createInsurerProfileValidators),
  asyncHandler(createInsurerProfile)
);
insurerRouter.get('/profile', asyncHandler(getInsurerProfile));
insurerRouter.get('/dashboard', asyncHandler(getInsurerDashboard));
insurerRouter.get('/analytics', asyncHandler(getInsurerAnalytics));
insurerRouter.patch(
  '/profile',
  validate(updateInsurerProfileValidators),
  asyncHandler(updateInsurerProfile)
);
insurerRouter.get('/policies', asyncHandler(listInsurerPolicies));
insurerRouter.get(
  '/policies/:id',
  validate([insurerPolicyIdValidator]),
  asyncHandler(getInsurerPolicy)
);
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
insurerRouter.delete(
  '/policies/:id',
  validate([insurerPolicyIdValidator]),
  asyncHandler(deleteInsurerPolicy)
);
insurerRouter.get('/leads', asyncHandler(listInsurerLeads));
insurerRouter.patch(
  '/leads/:id/seen',
  validate([insurerPolicyIdValidator]),
  asyncHandler(markInsurerLeadSeen)
);
insurerRouter.patch(
  '/purchases/:id/revoke',
  validate([insurerPolicyIdValidator]),
  asyncHandler(revokeInsurerPurchase)
);
insurerRouter.patch(
  '/purchases/:id/terminate',
  validate([insurerPolicyIdValidator]),
  asyncHandler(terminateInsurerPurchase)
);
insurerRouter.get('/claims', asyncHandler(listInsurerClaims));
insurerRouter.patch(
  '/claims/:id',
  validate(updateInsurerClaimValidators),
  asyncHandler(updateInsurerClaimStatus)
);
