import { Router } from 'express';
import { asyncHandler } from '../controllers/authController';
import {
  clearNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../controllers/notificationsController';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { notificationIdValidator } from '../validators/purchaseValidators';

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);

notificationsRouter.get('/', asyncHandler(listNotifications));
notificationsRouter.patch('/read-all', asyncHandler(markAllNotificationsRead));
notificationsRouter.delete('/clear', asyncHandler(clearNotifications));
notificationsRouter.patch(
  '/:id/read',
  validate([notificationIdValidator]),
  asyncHandler(markNotificationRead)
);
