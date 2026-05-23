import { Router } from 'express';
import { asyncHandler } from '../controllers/authController';
import { listPurchases } from '../controllers/purchaseController';
import { authenticate } from '../middleware/authenticate';

export const purchasesRouter = Router();

purchasesRouter.use(authenticate);
purchasesRouter.get('/', asyncHandler(listPurchases));
