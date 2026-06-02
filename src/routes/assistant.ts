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
    body('message')
      .optional({ values: 'falsy' })
      .trim()
      .isLength({ max: 2000 })
      .custom((value, { req }) => {
        const msg = typeof value === 'string' ? value.trim() : '';
        const attachments = (req.body as { attachments?: unknown }).attachments;
        const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
        if (msg.length < 1 && !hasAttachments) {
          throw new Error('message is required unless attachments are provided');
        }
        return true;
      }),
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
