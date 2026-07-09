import { Router } from 'express';
import { asyncHandler } from '../controllers/authController';
import {
  completePurchaseHandler,
  createPurchase,
  processPayment,
  updatePurchaseAnswers,
} from '../controllers/purchaseController';
import { authenticate } from '../middleware/authenticate';
import {
  authenticateCheckoutToken,
  authenticateSessionOrCheckoutToken,
} from '../middleware/authenticateCheckoutToken';
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
  validate(updatePurchaseAnswersValidators),
  authenticateSessionOrCheckoutToken('param'),
  asyncHandler(updatePurchaseAnswers)
);

purchaseRouter.post(
  '/:id/process-payment',
  validate(processPaymentValidators),
  authenticateSessionOrCheckoutToken('param'),
  asyncHandler(processPayment)
);

purchaseRouter.get(
  '/complete',
  validate(completePurchaseQueryValidators),
  authenticateCheckoutToken('query'),
  asyncHandler(completePurchaseHandler)
);
