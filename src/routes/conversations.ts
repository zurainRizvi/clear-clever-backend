import { Router } from 'express';
import { asyncHandler } from '../controllers/authController';
import {
  createConversation,
  listConversations,
  listMessages,
  markConversationRead,
  sendMessage,
} from '../controllers/conversationsController';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import {
  conversationIdParamValidator,
  createConversationValidators,
  sendMessageValidators,
} from '../validators/conversationValidators';

export const conversationsRouter = Router();

conversationsRouter.use(authenticate);

conversationsRouter.get('/', asyncHandler(listConversations));
conversationsRouter.post('/', validate(createConversationValidators), asyncHandler(createConversation));
conversationsRouter.get(
  '/:id/messages',
  validate([conversationIdParamValidator]),
  asyncHandler(listMessages)
);
conversationsRouter.post('/:id/messages', validate(sendMessageValidators), asyncHandler(sendMessage));
conversationsRouter.patch(
  '/:id/read',
  validate([conversationIdParamValidator]),
  asyncHandler(markConversationRead)
);
