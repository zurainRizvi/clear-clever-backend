import { ClaimRequest } from '../models/ClaimRequest';
import { Conversation } from '../models/Conversation';
import { Favorite } from '../models/Favorite';
import { Lead } from '../models/Lead';
import { Message } from '../models/Message';
import { Notification } from '../models/Notification';
import { Purchase } from '../models/Purchase';
import { QuestionnaireResponse } from '../models/QuestionnaireResponse';
import { SupportInquiry } from '../models/SupportInquiry';
import { UserProfile } from '../models/UserProfile';
import {
  DEMO_CLAIMS,
  DEMO_CONVERSATIONS,
  DEMO_EXTRA_LEADS,
  DEMO_EXTRA_NOTIFICATIONS,
  DEMO_FAVORITES,
  DEMO_INSURER_LEADS,
  DEMO_PURCHASES,
  DEMO_QUESTIONNAIRES,
  DEMO_SUPPORT,
  PRIMARY_SEEKER,
  SECONDARY_SEEKER,
} from './demoSeedData';
import {
  backdateDocument,
  createDemoPurchase,
  daysAgo,
  resolvePolicy,
  resolveUserId,
  wipeDemoTransactions,
} from './seedDemoHelpers';
import { seedKyc } from './seedKyc';

export interface SeedDemoResult {
  questionnaires: number;
  favorites: number;
  purchases: number;
  claims: number;
  leads: number;
  notifications: number;
  conversations: number;
  messages: number;
  supportInquiries: number;
  userProfiles: number;
  kycCreated: number;
  kycUpdated: number;
}

export async function seedDemo(): Promise<SeedDemoResult> {
  await wipeDemoTransactions();

  let questionnaires = 0;
  let favorites = 0;
  let purchases = 0;
  let claims = 0;
  let leads = 0;
  let notifications = 0;
  let conversations = 0;
  let messages = 0;
  let supportInquiries = 0;
  let userProfiles = 0;

  for (const record of DEMO_QUESTIONNAIRES) {
    const userId = await resolveUserId(record.userEmail);
    const createdAt = daysAgo(record.daysAgo ?? 30);
    await QuestionnaireResponse.findOneAndUpdate(
      { userId, category: record.category },
      {
        userId,
        category: record.category,
        answers: record.answers,
        completedQuestionIds: record.completedQuestionIds,
        createdAt,
        updatedAt: createdAt,
      },
      { upsert: true, new: true, timestamps: false }
    );
    questionnaires += 1;
  }

  for (const record of DEMO_FAVORITES) {
    const userId = await resolveUserId(record.userEmail);
    const { policy } = await resolvePolicy(record.policySlug);
    const createdAt = daysAgo(record.daysAgo ?? 14);
    const favorite = await Favorite.create({
      userId,
      policyId: policy._id,
      createdAt,
      updatedAt: createdAt,
    });
    await backdateDocument('favorites', favorite._id, createdAt);
    favorites += 1;

    await Lead.create({
      insurerProfileId: policy.insurerProfileId,
      userId,
      policyId: policy._id,
      type: 'favorite',
      status: 'new',
      summary: `Saved ${policy.name}`,
      createdAt,
      updatedAt: createdAt,
    });
    leads += 1;
  }

  const purchaseIdByUserPolicy = new Map<string, string>();

  for (const record of DEMO_PURCHASES) {
    const purchaseId = await createDemoPurchase(record);
    purchaseIdByUserPolicy.set(`${record.userEmail}:${record.policySlug}`, String(purchaseId));
    purchases += 1;
  }

  for (const record of [...DEMO_EXTRA_LEADS, ...DEMO_INSURER_LEADS]) {
    const userId = await resolveUserId(record.userEmail);
    const { policy } = await resolvePolicy(record.policySlug);
    const createdAt = daysAgo(record.daysAgo ?? 7);
    const lead = await Lead.create({
      insurerProfileId: policy.insurerProfileId,
      userId,
      policyId: policy._id,
      type: record.type,
      status: record.status,
      summary: record.summary,
      seenAt: record.seen ? createdAt : undefined,
      createdAt,
      updatedAt: createdAt,
    });
    await backdateDocument('leads', lead._id, createdAt, {
      seenAt: record.seen ? createdAt : null,
    });
    leads += 1;
  }

  for (const record of DEMO_CLAIMS) {
    const userId = await resolveUserId(record.userEmail);
    const { policy, insurer } = await resolvePolicy(record.policySlug);
    const purchaseKey = `${record.userEmail}:${record.policySlug}`;
    let purchaseId = purchaseIdByUserPolicy.get(purchaseKey);

    if (!purchaseId) {
      const existing = await Purchase.findOne({
        userId,
        policyId: policy._id,
        status: 'completed',
      }).sort({ completedAt: -1 });
      purchaseId = existing ? String(existing._id) : undefined;
    }

    if (!purchaseId) continue;

    const incidentDate = daysAgo(record.daysAgoIncident ?? 5);
    const createdAt = daysAgo(record.daysAgoCreated ?? 4);
    const claim = await ClaimRequest.create({
      userId,
      purchaseId,
      policyId: policy._id,
      insurerProfileId: insurer._id,
      claimType: record.claimType,
      incidentDate,
      estimatedAmountPkr: record.estimatedAmountPkr,
      description: record.description,
      status: record.status,
      createdAt,
      updatedAt: createdAt,
    });
    await backdateDocument('claimrequests', claim._id, createdAt, { incidentDate });
    claims += 1;
  }

  for (const record of DEMO_EXTRA_NOTIFICATIONS) {
    const userId = await resolveUserId(record.userEmail);
    const createdAt = daysAgo(record.daysAgo ?? 3);
    const notification = await Notification.create({
      userId,
      type: record.type,
      title: record.title,
      body: record.body,
      read: record.read,
      createdAt,
      updatedAt: createdAt,
    });
    await backdateDocument('notifications', notification._id, createdAt);
    notifications += 1;
  }

  for (const record of DEMO_CONVERSATIONS) {
    const seekerId = await resolveUserId(record.userEmail);
    const insurerUserId = await resolveUserId(record.insurerEmail);
    let purchaseId: string | undefined;
    let insurerProfileId: string | undefined;

    if (record.policySlug) {
      const { policy, insurer } = await resolvePolicy(record.policySlug);
      insurerProfileId = String(insurer._id);
      purchaseId = purchaseIdByUserPolicy.get(`${record.userEmail}:${record.policySlug}`);
      if (!purchaseId) {
        const existing = await Purchase.findOne({
          userId: seekerId,
          policyId: policy._id,
        }).sort({ createdAt: -1 });
        purchaseId = existing ? String(existing._id) : undefined;
      }
    }

    const firstMessageAt = daysAgo(record.messages[0]?.daysAgo ?? 10);
    const lastMessage = record.messages[record.messages.length - 1];
    const lastMessageAt = daysAgo(lastMessage?.daysAgo ?? 9);

    const conversation = await Conversation.create({
      type: 'user_insurer',
      participantUserIds: [seekerId, insurerUserId],
      insurerProfileId,
      purchaseId,
      subject: record.subject,
      lastMessagePreview: lastMessage?.body.slice(0, 120),
      lastMessageAt,
      readByUserIds: [seekerId],
      createdAt: firstMessageAt,
      updatedAt: lastMessageAt,
    });
    await backdateDocument('conversations', conversation._id, firstMessageAt, {
      lastMessageAt,
      updatedAt: lastMessageAt,
    });
    conversations += 1;

    for (const msg of record.messages) {
      const senderId = await resolveUserId(msg.senderEmail);
      const msgCreatedAt = daysAgo(msg.daysAgo ?? 9);
      const message = await Message.create({
        conversationId: conversation._id,
        senderUserId: senderId,
        body: msg.body,
        createdAt: msgCreatedAt,
        updatedAt: msgCreatedAt,
      });
      await backdateDocument('messages', message._id, msgCreatedAt);
      messages += 1;
    }
  }

  for (const record of DEMO_SUPPORT) {
    const userId = await resolveUserId(record.userEmail);
    const createdAt = daysAgo(record.daysAgo ?? 5);
    const inquiry = await SupportInquiry.create({
      userId,
      fullName: record.fullName,
      email: record.userEmail,
      roleLabel: 'policy_seeker',
      reason: record.reason,
      message: record.message,
      createdAt,
      updatedAt: createdAt,
    });
    await backdateDocument('supportinquiries', inquiry._id, createdAt);
    supportInquiries += 1;
  }

  for (const email of [PRIMARY_SEEKER, SECONDARY_SEEKER]) {
    const userId = await resolveUserId(email);
    await UserProfile.findOneAndUpdate(
      { userId },
      {
        userId,
        notificationPreferences: {
          emailUpdates: true,
          claimAlerts: true,
          policyReminders: true,
        },
      },
      { upsert: true, new: true }
    );
    userProfiles += 1;
  }

  const kyc = await seedKyc();

  return {
    questionnaires,
    favorites,
    purchases,
    claims,
    leads,
    notifications,
    conversations,
    messages,
    supportInquiries,
    userProfiles,
    kycCreated: kyc.created,
    kycUpdated: kyc.updated,
  };
}
