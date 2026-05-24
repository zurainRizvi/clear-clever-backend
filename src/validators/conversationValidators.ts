import { body, param } from 'express-validator';
import { CONVERSATION_TYPES } from '../models/Conversation';

export const conversationIdParamValidator = param('id')
  .trim()
  .notEmpty()
  .withMessage('Conversation id is required')
  .isMongoId()
  .withMessage('Conversation id must be a valid id');

export const createConversationValidators = [
  body('type')
    .trim()
    .notEmpty()
    .withMessage('Conversation type is required')
    .isIn([...CONVERSATION_TYPES])
    .withMessage(`Conversation type must be one of: ${CONVERSATION_TYPES.join(', ')}`),
  body('insurerProfileId')
    .optional()
    .trim()
    .isMongoId()
    .withMessage('insurerProfileId must be a valid id'),
  body('targetUserId')
    .optional()
    .trim()
    .isMongoId()
    .withMessage('targetUserId must be a valid id'),
  body('purchaseId')
    .optional()
    .trim()
    .isMongoId()
    .withMessage('purchaseId must be a valid id'),
  body('subject')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Subject must be at most 200 characters'),
  body('initialMessage')
    .optional()
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Initial message must be between 1 and 2000 characters'),
];

export const sendMessageValidators = [
  conversationIdParamValidator,
  body('body')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Message must be at most 2000 characters'),
  body('attachments')
    .optional()
    .isArray({ max: 3 })
    .withMessage('Attachments must be an array of up to 3 files'),
  body('attachments.*.fileName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Attachment filename is required and must be at most 255 characters'),
  body('attachments.*.mimeType')
    .optional()
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage('Attachment mimeType is required'),
  body('attachments.*.dataUrl')
    .optional()
    .trim()
    .isLength({ min: 20, max: 7_000_000 })
    .withMessage('Attachment data is invalid'),
];
