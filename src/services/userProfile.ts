import type { Types } from 'mongoose';
import { UserProfile, type IUserProfileDocument } from '../models/UserProfile';

const DEFAULT_NOTIFICATION_PREFERENCES = {
  emailUpdates: true,
  claimAlerts: true,
  policyReminders: true,
};

export async function ensureUserProfile(userId: Types.ObjectId): Promise<IUserProfileDocument> {
  const existing = await UserProfile.findOne({ userId });
  if (existing) return existing;

  return UserProfile.create({
    userId,
    notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
  });
}

export function sanitizeUserProfile(profile: IUserProfileDocument) {
  return {
    id: profile._id.toString(),
    userId: profile.userId.toString(),
    profilePhotoDataUrl: profile.profilePhotoDataUrl,
    addressLine: profile.addressLine,
    city: profile.city,
    province: profile.province,
    postalCode: profile.postalCode,
    notificationPreferences: {
      emailUpdates: profile.notificationPreferences.emailUpdates,
      claimAlerts: profile.notificationPreferences.claimAlerts,
      policyReminders: profile.notificationPreferences.policyReminders,
    },
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}
