import { Router } from 'express';
import { asyncHandler } from '../controllers/authController';
import {
  approvePolicy,
  changeUserRole,
  deactivateUser,
  reactivateUser,
  getAnalytics,
  listPendingPolicies,
  listUsers,
  rejectPolicy,
} from '../controllers/adminController';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { ADMIN_ROLES } from '../constants/roles';
import { validate } from '../middleware/validate';
import {
  adminPolicyIdValidator,
  changeUserRoleValidators,
  adminUserIdValidator,
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
