import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import { Notification } from '../models/Notification';
import { AppError, successResponse } from '../utils/apiResponse';

export async function listNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
  const notifications = await Notification.find({ userId: req.user!._id }).sort({ createdAt: -1 });

  res.status(200).json(
    successResponse('Notifications retrieved', {
      count: notifications.length,
      notifications: notifications.map((item) => ({
        id: String(item._id),
        type: item.type,
        title: item.title,
        body: item.body,
        read: item.read,
        metadata: item.metadata,
        createdAt: item.createdAt.toISOString(),
      })),
    })
  );
}

export async function markNotificationRead(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const notification = await Notification.findOne({
    _id: req.params.id,
    userId: req.user!._id,
  });

  if (!notification) {
    throw new AppError(404, 'Notification not found');
  }

  notification.read = true;
  await notification.save();

  res.status(200).json(
    successResponse('Notification marked as read', {
      notification: {
        id: String(notification._id),
        read: notification.read,
      },
    })
  );
}
