import { Router } from 'express';
import { body } from 'express-validator';
import { asyncHandler } from '../controllers/authController';
import { submitSupportContact } from '../controllers/supportController';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { SUPPORT_INQUIRY_REASONS, SUPPORT_INQUIRY_ROLES } from '../models/SupportInquiry';

export const supportRouter = Router();

supportRouter.post(
  '/contact',
  authenticate,
  validate([
    body('fullName').trim().isLength({ min: 2, max: 120 }),
    body('email').isEmail().normalizeEmail(),
    body('roleLabel').isIn([...SUPPORT_INQUIRY_ROLES]),
    body('reason').isIn([...SUPPORT_INQUIRY_REASONS]),
    body('message').trim().isLength({ min: 10, max: 2000 }),
  ]),
  asyncHandler(submitSupportContact)
);
