import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import { NOTIFICATION_TYPES, type NotificationType } from '../constants/purchase';

export interface INotification {
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface INotificationDocument extends INotification, Document {}

const notificationSchema = new Schema<INotificationDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    read: { type: Boolean, default: false, index: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });

export const Notification: Model<INotificationDocument> =
  mongoose.models.Notification ??
  mongoose.model<INotificationDocument>('Notification', notificationSchema);
