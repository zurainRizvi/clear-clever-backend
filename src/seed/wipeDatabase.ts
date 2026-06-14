import mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog';
import { CallSchedule } from '../models/CallSchedule';
import { ClaimRequest } from '../models/ClaimRequest';
import { Conversation } from '../models/Conversation';
import { EmailLog } from '../models/EmailLog';
import { Favorite } from '../models/Favorite';
import { InsurerProfile } from '../models/InsurerProfile';
import { KycVerification } from '../models/KycVerification';
import { Lead } from '../models/Lead';
import { Message } from '../models/Message';
import { Notification } from '../models/Notification';
import { OtpVerification } from '../models/OtpVerification';
import { Policy } from '../models/Policy';
import { Purchase } from '../models/Purchase';
import { QuestionnaireResponse } from '../models/QuestionnaireResponse';
import { ReminderDispatch } from '../models/ReminderDispatch';
import { SupportInquiry } from '../models/SupportInquiry';
import { User } from '../models/User';
import { UserProfile } from '../models/UserProfile';
import { SEED_USERS } from './userSeedData';

export interface WipeDatabaseResult {
  usersRemoved: number;
  policiesRemoved: number;
  insurerProfilesRemoved: number;
  transactionalCollectionsCleared: boolean;
}

/**
 * Remove non-seed accounts and orphan catalog rows before a full reseed.
 * Keeps only users listed in userSeedData.ts; clears all transactional data.
 */
export async function wipeNonSeedData(): Promise<WipeDatabaseResult> {
  const seedEmails = SEED_USERS.map((u) => u.email.toLowerCase().trim());

  const seedInsurerEmails = SEED_USERS.filter(
    (u) => u.role === 'insurer' && u.status !== 'pendingVerification'
  ).map((u) => u.email.toLowerCase().trim());
  const seedInsurerUsers = await User.find({ email: { $in: seedInsurerEmails } }).select('_id');
  const seedInsurerUserIds = seedInsurerUsers.map((u) => u._id);

  const nonSeedUsers = await User.find({ email: { $nin: seedEmails } }).select('_id');
  const nonSeedUserIds = nonSeedUsers.map((u) => u._id);

  await Promise.all([
    Message.deleteMany({}),
    Conversation.deleteMany({}),
    CallSchedule.deleteMany({}),
    EmailLog.deleteMany({}),
    Notification.deleteMany({}),
    ClaimRequest.deleteMany({}),
    Favorite.deleteMany({}),
    QuestionnaireResponse.deleteMany({}),
    UserProfile.deleteMany({}),
    KycVerification.deleteMany({}),
    SupportInquiry.deleteMany({}),
    Lead.deleteMany({}),
    Purchase.deleteMany({}),
    ReminderDispatch.deleteMany({}),
    OtpVerification.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);

  if (nonSeedUserIds.length > 0) {
    await User.deleteMany({ _id: { $in: nonSeedUserIds } });
  }

  const orphanInsurers = await InsurerProfile.find({
    userId: { $nin: seedInsurerUserIds },
  }).select('_id');
  const orphanInsurerIds = orphanInsurers.map((p) => p._id);

  let policiesRemoved = 0;
  if (orphanInsurerIds.length > 0) {
    const policyResult = await Policy.deleteMany({
      insurerProfileId: { $in: orphanInsurerIds },
    });
    policiesRemoved += policyResult.deletedCount ?? 0;
    await InsurerProfile.deleteMany({ _id: { $in: orphanInsurerIds } });
  }

  return {
    usersRemoved: nonSeedUserIds.length,
    policiesRemoved,
    insurerProfilesRemoved: orphanInsurerIds.length,
    transactionalCollectionsCleared: true,
  };
}

/** Backdate helper export for scripts that need direct collection access. */
export { mongoose };
