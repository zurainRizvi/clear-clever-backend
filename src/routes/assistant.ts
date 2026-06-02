import { Router } from 'express';
import { body } from 'express-validator';
import { asyncHandler } from '../controllers/authController';
import {
  getAssistantStatus,
  postAssistantChat,
  postAssistantExplain,
} from '../controllers/assistantController';
import { authenticate, optionalAuthenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';

export const assistantRouter = Router();

assistantRouter.get('/status', asyncHandler(getAssistantStatus));

assistantRouter.post(
  '/chat',
  optionalAuthenticate,
  validate([
    body('message').trim().isLength({ min: 1, max: 2000 }),
    body('category').optional().trim().isLength({ max: 32 }),
    body('history').optional().isArray({ max: 10 }),
    body('attachments').optional().isArray({ max: 3 }),
  ]),
  asyncHandler(postAssistantChat)
);

assistantRouter.post(
  '/explain',
  authenticate,
  authorize('user'),
  validate([
    body('category').trim().notEmpty().isLength({ max: 32 }),
    body('policyId').optional().trim().isLength({ max: 64 }),
  ]),
  asyncHandler(postAssistantExplain)
);
