import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface IUserNotificationPreferences {
  emailUpdates: boolean;
  claimAlerts: boolean;
  policyReminders: boolean;
}

export interface IUserProfile {
  userId: Types.ObjectId;
  profilePhotoDataUrl?: string;
  addressLine?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  notificationPreferences: IUserNotificationPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserProfileDocument extends IUserProfile, Document {}

const notificationPreferencesSchema = new Schema<IUserNotificationPreferences>(
  {
    emailUpdates: { type: Boolean, default: true },
    claimAlerts: { type: Boolean, default: true },
    policyReminders: { type: Boolean, default: true },
  },
  { _id: false }
);

const userProfileSchema = new Schema<IUserProfileDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    profilePhotoDataUrl: { type: String, trim: true, maxlength: 7_000_000 },
    addressLine: { type: String, trim: true, maxlength: 240 },
    city: { type: String, trim: true, maxlength: 80 },
    province: { type: String, trim: true, maxlength: 80 },
    postalCode: { type: String, trim: true, maxlength: 20 },
    notificationPreferences: {
      type: notificationPreferencesSchema,
      default: () => ({
        emailUpdates: true,
        claimAlerts: true,
        policyReminders: true,
      }),
    },
  },
  { timestamps: true }
);

export const UserProfile: Model<IUserProfileDocument> =
  mongoose.models.UserProfile ??
  mongoose.model<IUserProfileDocument>('UserProfile', userProfileSchema);
