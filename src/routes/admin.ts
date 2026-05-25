import { Router } from 'express';
import { asyncHandler } from '../controllers/authController';
import {
  approveInsurer,
  approvePolicy,
  changeUserRole,
  deactivateUser,
  deleteInsurerPermanently,
  reactivateUser,
  getAnalytics,
  listInsurers,
  listPendingPolicies,
  listUsers,
  rejectInsurer,
  rejectPolicy,
  revokeInsurer,
} from '../controllers/adminController';
import { getFraudSignals } from '../controllers/fraudSignalsController';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { ADMIN_ROLES } from '../constants/roles';
import { validate } from '../middleware/validate';
import {
  adminPolicyIdValidator,
  changeUserRoleValidators,
  adminUserIdValidator,
  rejectInsurerValidators,
  rejectPolicyValidators,
} from '../validators/adminValidators';

export const adminRouter = Router();

adminRouter.use(authenticate, authorize(...ADMIN_ROLES));

adminRouter.get('/policies/pending', asyncHandler(listPendingPolicies));
adminRouter.post(
  '/policies/:id/approve',
  validate([adminPolicyIdValidator]),
  asyncHandler(approvePolicy)
);
adminRouter.post(
  '/policies/:id/reject',
  validate(rejectPolicyValidators),
  asyncHandler(rejectPolicy)
);

adminRouter.get('/users', asyncHandler(listUsers));
adminRouter.patch(
  '/users/:id/role',
  validate(changeUserRoleValidators),
  asyncHandler(changeUserRole)
);
adminRouter.patch(
  '/users/:id/deactivate',
  validate([adminUserIdValidator]),
  asyncHandler(deactivateUser)
);
adminRouter.patch(
  '/users/:id/reactivate',
  validate([adminUserIdValidator]),
  asyncHandler(reactivateUser)
);

adminRouter.get('/analytics', asyncHandler(getAnalytics));
adminRouter.get('/fraud-signals', asyncHandler(getFraudSignals));

adminRouter.get('/insurers', asyncHandler(listInsurers));
adminRouter.post(
  '/insurers/:id/approve',
  authorize('superadmin'),
  validate([adminUserIdValidator]),
  asyncHandler(approveInsurer)
);
adminRouter.post(
  '/insurers/:id/reject',
  authorize('superadmin'),
  validate(rejectInsurerValidators),
  asyncHandler(rejectInsurer)
);
adminRouter.post(
  '/insurers/:id/revoke',
  authorize('superadmin'),
  validate([adminUserIdValidator]),
  asyncHandler(revokeInsurer)
);
adminRouter.delete(
  '/insurers/:id',
  authorize('superadmin'),
  validate([adminUserIdValidator]),
  asyncHandler(deleteInsurerPermanently)
);
