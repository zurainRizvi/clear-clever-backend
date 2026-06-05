import { Router } from 'express';
import { asyncHandler } from '../controllers/authController';
import {
  completePurchaseHandler,
  createPurchase,
  processPayment,
  updatePurchaseAnswers,
} from '../controllers/purchaseController';
import { authenticate } from '../middleware/authenticate';
import { authenticateQueryToken } from '../middleware/authenticateQueryToken';
import { validate } from '../middleware/validate';
import {
  completePurchaseQueryValidators,
  createPurchaseValidators,
  processPaymentValidators,
  updatePurchaseAnswersValidators,
} from '../validators/purchaseValidators';

export const purchaseRouter = Router();

purchaseRouter.post(
  '/',
  authenticate,
  validate(createPurchaseValidators),
  asyncHandler(createPurchase)
);

purchaseRouter.patch(
  '/:id/answers',
  authenticate,
  validate(updatePurchaseAnswersValidators),
  asyncHandler(updatePurchaseAnswers)
);

purchaseRouter.post(
  '/:id/process-payment',
  authenticate,
  validate(processPaymentValidators),
  asyncHandler(processPayment)
);

purchaseRouter.get(
  '/complete',
  authenticateQueryToken,
  validate(completePurchaseQueryValidators),
  asyncHandler(completePurchaseHandler)
);
