import { Router } from 'express';
import { asyncHandler } from '../controllers/authController';
import {
  listNotifications,
  markNotificationRead,
} from '../controllers/notificationsController';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { notificationIdValidator } from '../validators/purchaseValidators';

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);

notificationsRouter.get('/', asyncHandler(listNotifications));
notificationsRouter.patch(
  '/:id/read',
  validate([notificationIdValidator]),
  asyncHandler(markNotificationRead)
);
