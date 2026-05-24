import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import { Notification } from '../models/Notification';
import { AppError, successResponse } from '../utils/apiResponse';

export async function listNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ userId: req.user!._id }).sort({ createdAt: -1 }),
    Notification.countDocuments({ userId: req.user!._id, read: false }),
  ]);

  res.status(200).json(
    successResponse('Notifications retrieved', {
      count: notifications.length,
      unreadCount,
      notifications: notifications.map((item) => ({
        id: String(item._id),
        type: item.type,
        title: item.title,
        body: item.body,
        read: item.read,
        metadata: item.metadata,
        target: getNotificationTarget(item.metadata),
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

export async function markAllNotificationsRead(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const result = await Notification.updateMany(
    { userId: req.user!._id, read: false },
    { $set: { read: true } }
  );

  res.status(200).json(
    successResponse('All notifications marked as read', {
      modifiedCount: result.modifiedCount,
    })
  );
}

export async function clearNotifications(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const result = await Notification.deleteMany({ userId: req.user!._id });

  res.status(200).json(
    successResponse('Notifications cleared', {
      deletedCount: result.deletedCount,
    })
  );
}

function getNotificationTarget(metadata: Record<string, unknown> | undefined) {
  if (!metadata) {
    return undefined;
  }

  if (typeof metadata.claimId === 'string') {
    return {
      path: '/dashboard/claims',
      focusId: metadata.claimId,
      focusType: 'claim',
    };
  }

  if (typeof metadata.purchaseId === 'string') {
    return {
      path: '/dashboard/purchases',
      focusId: metadata.purchaseId,
      focusType: 'purchase',
    };
  }

  return undefined;
}
