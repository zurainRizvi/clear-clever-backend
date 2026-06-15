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
  getAdminSystemHealth,
  getAdminMlOverview,
  getAdminAuditLogs,
  clearAdminAuditLogs,
  listInsurers,
  listPendingPolicies,
  listUsers,
  rejectInsurer,
  rejectPolicy,
  revokeInsurer,
} from '../controllers/adminController';
import { getFraudSignals, resolveFraudSignalAdmin } from '../controllers/fraudSignalsController';
import {
  getAdminMlRetrainReport,
  keepAdminMlRetrain,
  promoteAdminMlRetrain,
  triggerAdminMlRetrain,
} from '../controllers/mlRetrainController';
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
  resolveFraudSignalValidators,
  mlRetrainModelValidators,
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
adminRouter.get('/health', authorize('superadmin'), asyncHandler(getAdminSystemHealth));
adminRouter.get('/ml-overview', authorize('superadmin'), asyncHandler(getAdminMlOverview));
adminRouter.get('/audit', authorize('superadmin'), asyncHandler(getAdminAuditLogs));
adminRouter.delete('/audit', authorize('superadmin'), asyncHandler(clearAdminAuditLogs));
adminRouter.get('/fraud-signals', asyncHandler(getFraudSignals));
adminRouter.post(
  '/fraud-signals/:category/resolve',
  authorize('superadmin'),
  validate(resolveFraudSignalValidators),
  asyncHandler(resolveFraudSignalAdmin)
);

adminRouter.get(
  '/ml-retrain/report',
  authorize('superadmin'),
  asyncHandler(getAdminMlRetrainReport)
);
adminRouter.post(
  '/ml-retrain/promote',
  authorize('superadmin'),
  validate(mlRetrainModelValidators),
  asyncHandler(promoteAdminMlRetrain)
);
adminRouter.post(
  '/ml-retrain/keep',
  authorize('superadmin'),
  validate(mlRetrainModelValidators),
  asyncHandler(keepAdminMlRetrain)
);
adminRouter.post(
  '/ml-retrain/trigger',
  authorize('superadmin'),
  asyncHandler(triggerAdminMlRetrain)
);

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
