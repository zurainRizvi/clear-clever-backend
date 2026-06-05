import mongoose, { type Types } from 'mongoose';
import { CallSchedule } from '../models/CallSchedule';
import { ClaimRequest } from '../models/ClaimRequest';
import { Conversation } from '../models/Conversation';
import { EmailLog } from '../models/EmailLog';
import { Favorite } from '../models/Favorite';
import { InsurerProfile } from '../models/InsurerProfile';
import { Lead } from '../models/Lead';
import { Message } from '../models/Message';
import { Notification } from '../models/Notification';
import { Policy } from '../models/Policy';
import { Purchase } from '../models/Purchase';
import { QuestionnaireResponse } from '../models/QuestionnaireResponse';
import { SupportInquiry } from '../models/SupportInquiry';
import { User } from '../models/User';
import { UserProfile } from '../models/UserProfile';
import { completePurchase } from '../services/purchaseCompletion';
import { SEED_USERS } from './userSeedData';

export function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(10, 30, 0, 0);
  return date;
}

export function daysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(10, 0, 0, 0);
  return date;
}

export async function getSeedUserIds(): Promise<Types.ObjectId[]> {
  const emails = SEED_USERS.map((u) => u.email.toLowerCase().trim());
  const users = await User.find({ email: { $in: emails } }).select('_id');
  return users.map((u) => u._id as Types.ObjectId);
}

export async function getSeedInsurerProfileIds(): Promise<Types.ObjectId[]> {
  const insurerEmails = SEED_USERS.filter((u) => u.role === 'insurer' && u.status !== 'pendingVerification')
    .map((u) => u.email.toLowerCase().trim());
  const insurerUsers = await User.find({ email: { $in: insurerEmails } }).select('_id');
  const userIds = insurerUsers.map((u) => u._id);
  const profiles = await InsurerProfile.find({ userId: { $in: userIds } }).select('_id');
  return profiles.map((p) => p._id as Types.ObjectId);
}

export async function wipeDemoTransactions(): Promise<void> {
  const seedUserIds = await getSeedUserIds();
  const seedInsurerProfileIds = await getSeedInsurerProfileIds();
  const seedEmails = SEED_USERS.map((u) => u.email.toLowerCase().trim());

  const purchaseIds = (
    await Purchase.find({ userId: { $in: seedUserIds } }).select('_id')
  ).map((p) => p._id);

  const conversationIds = (
    await Conversation.find({ participantUserIds: { $in: seedUserIds } }).select('_id')
  ).map((c) => c._id);

  await Promise.all([
    Message.deleteMany({ conversationId: { $in: conversationIds } }),
    Conversation.deleteMany({ _id: { $in: conversationIds } }),
    CallSchedule.deleteMany({
      $or: [{ userId: { $in: seedUserIds } }, { purchaseId: { $in: purchaseIds } }],
    }),
    EmailLog.deleteMany({
      $or: [{ userId: { $in: seedUserIds } }, { purchaseId: { $in: purchaseIds } }],
    }),
    Notification.deleteMany({ userId: { $in: seedUserIds } }),
    ClaimRequest.deleteMany({ userId: { $in: seedUserIds } }),
    Favorite.deleteMany({ userId: { $in: seedUserIds } }),
    QuestionnaireResponse.deleteMany({ userId: { $in: seedUserIds } }),
    UserProfile.deleteMany({ userId: { $in: seedUserIds } }),
    SupportInquiry.deleteMany({
      $or: [{ userId: { $in: seedUserIds } }, { email: { $in: seedEmails } }],
    }),
    Lead.deleteMany({
      $or: [
        { userId: { $in: seedUserIds } },
        { insurerProfileId: { $in: seedInsurerProfileIds } },
      ],
    }),
    Purchase.deleteMany({ userId: { $in: seedUserIds } }),
  ]);
}

export async function resolveUserId(email: string): Promise<Types.ObjectId> {
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    throw new Error(`Demo seed: user ${email} not found`);
  }
  return user._id as Types.ObjectId;
}

export async function resolvePolicy(slug: string) {
  const policy = await Policy.findOne({ slug });
  if (!policy) {
    throw new Error(`Demo seed: policy ${slug} not found`);
  }
  const insurer = await InsurerProfile.findById(policy.insurerProfileId);
  if (!insurer) {
    throw new Error(`Demo seed: insurer profile missing for policy ${slug}`);
  }
  return { policy, insurer };
}

export async function backdateDocument(
  collectionName: string,
  id: Types.ObjectId | string,
  createdAt: Date,
  extra: Record<string, unknown> = {}
): Promise<void> {
  await mongoose.connection.collection(collectionName).updateOne(
    { _id: new mongoose.Types.ObjectId(String(id)) },
    { $set: { createdAt, updatedAt: createdAt, ...extra } }
  );
}

export interface CreatePurchaseOptions {
  userEmail: string;
  policySlug: string;
  answers: Record<string, unknown>;
  status: 'pending' | 'completed' | 'revoked' | 'terminated';
  daysAgoCreated?: number;
  daysAgoCompleted?: number;
}

export async function createDemoPurchase(
  options: CreatePurchaseOptions
): Promise<Types.ObjectId> {
  const userId = await resolveUserId(options.userEmail);
  const { policy, insurer } = await resolvePolicy(options.policySlug);
  const createdAt = daysAgo(options.daysAgoCreated ?? 20);

  const purchase = await Purchase.create({
    userId,
    policyId: policy._id,
    insurerProfileId: insurer._id,
    affiliateSlug: insurer.slug,
    answers: options.answers,
    status: 'pending',
    completionArtifactsCreated: false,
    createdAt,
    updatedAt: createdAt,
  });

  if (options.status === 'pending') {
    return purchase._id as Types.ObjectId;
  }

  const paymentAt = daysAgo((options.daysAgoCompleted ?? 18) + 1);
  purchase.paymentProcessedAt = paymentAt;
  await purchase.save();

  await completePurchase(String(purchase._id), userId);

  const completedAt = daysAgo(options.daysAgoCompleted ?? 18);
  await backdateDocument('purchases', purchase._id, createdAt, {
    completedAt,
    paymentProcessedAt: paymentAt,
    status: options.status === 'completed' ? 'completed' : options.status,
  });

  if (options.status === 'revoked' || options.status === 'terminated') {
    await Purchase.findByIdAndUpdate(purchase._id, { status: options.status });
    await Notification.create({
      userId,
      type: options.status === 'revoked' ? 'purchase_revoked' : 'purchase_terminated',
      title:
        options.status === 'revoked' ? 'Policy purchase revoked' : 'Policy no longer active',
      body: `${insurer.companyName} updated the status of your ${policy.name} purchase.`,
      read: false,
      metadata: { purchaseId: String(purchase._id) },
    });
    await CallSchedule.findOneAndUpdate(
      { purchaseId: purchase._id },
      { status: 'cancelled' }
    );
  }

  return purchase._id as Types.ObjectId;
}
