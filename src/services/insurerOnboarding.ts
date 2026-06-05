import type { Types } from 'mongoose';
import { InsurerProfile } from '../models/InsurerProfile';
import type { IUserDocument } from '../models/User';
import { sanitizeUser } from './auth';
import { sanitizeUserProfile, ensureUserProfile } from './userProfile';

export interface InsurerOnboardingHint {
  hasProfile: boolean;
  companyName?: string;
  slug?: string;
}

export async function getInsurerOnboardingHint(
  userId: Types.ObjectId
): Promise<InsurerOnboardingHint | undefined> {
  const profile = await InsurerProfile.findOne({ userId });
  if (!profile) {
    return { hasProfile: false };
  }
  return {
    hasProfile: true,
    companyName: profile.companyName,
    slug: profile.slug,
  };
}

export async function buildAuthUserPayload(user: IUserDocument) {
  const profile = await ensureUserProfile(user._id);
  const payload: Record<string, unknown> = {
    ...sanitizeUser(user),
    profile: sanitizeUserProfile(profile),
  };

  if (user.role === 'insurer') {
    payload.insurerOnboarding = await getInsurerOnboardingHint(user._id);
  }

  return payload;
}
