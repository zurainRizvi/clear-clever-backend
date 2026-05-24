import { Router } from 'express';
import { asyncHandler } from '../controllers/authController';
import { listPurchases, rescheduleCall } from '../controllers/purchaseController';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { rescheduleCallValidators } from '../validators/purchaseValidators';

export const purchasesRouter = Router();

purchasesRouter.use(authenticate);
purchasesRouter.get('/', asyncHandler(listPurchases));
purchasesRouter.patch(
  '/:id/call-schedule',
  validate(rescheduleCallValidators),
  asyncHandler(rescheduleCall)
);
