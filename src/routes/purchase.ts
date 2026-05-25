import { Router } from 'express';
import { asyncHandler } from '../controllers/authController';
import {
  completePurchaseHandler,
  createPurchase,
  processPayment,
} from '../controllers/purchaseController';
import { authenticate } from '../middleware/authenticate';
import { authenticateCheckoutToken } from '../middleware/authenticateCheckoutToken';
import { validate } from '../middleware/validate';
import {
  completePurchaseQueryValidators,
  createPurchaseValidators,
  processPaymentValidators,
} from '../validators/purchaseValidators';

export const purchaseRouter = Router();

purchaseRouter.post(
  '/',
  authenticate,
  validate(createPurchaseValidators),
  asyncHandler(createPurchase)
);

purchaseRouter.post(
  '/:id/process-payment',
  authenticateCheckoutToken,
  validate(processPaymentValidators),
  asyncHandler(processPayment)
);

purchaseRouter.get(
  '/complete',
  authenticateCheckoutToken,
  validate(completePurchaseQueryValidators),
  asyncHandler(completePurchaseHandler)
);
