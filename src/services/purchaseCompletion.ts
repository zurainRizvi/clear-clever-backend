import type { Types } from 'mongoose';
import { CallSchedule } from '../models/CallSchedule';
import { EmailLog } from '../models/EmailLog';
import { InsurerProfile } from '../models/InsurerProfile';
import { Lead } from '../models/Lead';
import { Notification } from '../models/Notification';
import { Policy } from '../models/Policy';
import type { IPurchaseDocument } from '../models/Purchase';
import { Purchase } from '../models/Purchase';
import { User } from '../models/User';
import { AppError } from '../utils/apiResponse';
import { nextBusinessDayAtTenPkt } from './purchaseScheduling';
import { loadEnv } from '../config/env';
import { isOutboundEmailConfigured } from './emailDelivery';
import { sendTransactionalEmail } from './mail';
import { sendTransactionalViaBrevo } from './brevo';
import {
  createConversationMessage,
  findOrCreateConversation,
} from './conversationService';
import { renderBrandedEmail } from './emailTemplates';

export interface CompletionArtifacts {
  purchase: IPurchaseDocument;
  notifications: Awaited<ReturnType<typeof Notification.find>>;
  emailLog: Awaited<ReturnType<typeof EmailLog.findOne>>;
  callSchedule: Awaited<ReturnType<typeof CallSchedule.findOne>>;
  lead: Awaited<ReturnType<typeof Lead.findOne>>;
  alreadyCompleted: boolean;
}

export async function completePurchase(
  purchaseId: string,
  userId: Types.ObjectId | string
): Promise<CompletionArtifacts> {
  const purchase = await Purchase.findById(purchaseId);
  if (!purchase) {
    throw new AppError(404, 'Purchase not found');
  }
  if (String(purchase.userId) !== String(userId)) {
    throw new AppError(403, 'You do not have permission to complete this purchase');
  }
  if (!purchase.paymentProcessedAt) {
    throw new AppError(400, 'Payment must be processed before completing the purchase');
  }

  if (purchase.completionArtifactsCreated) {
    const [notifications, emailLog, callSchedule, lead] = await Promise.all([
      Notification.find({ 'metadata.purchaseId': String(purchase._id) }).sort({ createdAt: 1 }),
      EmailLog.findOne({ purchaseId: purchase._id }),
      CallSchedule.findOne({ purchaseId: purchase._id }),
      Lead.findOne({
        insurerProfileId: purchase.insurerProfileId,
        userId: purchase.userId,
        policyId: purchase.policyId,
        type: 'purchase',
      }),
    ]);

    return {
      purchase,
      notifications,
      emailLog,
      callSchedule,
      lead,
      alreadyCompleted: true,
    };
  }

  const [policy, insurer, user] = await Promise.all([
    Policy.findById(purchase.policyId),
    InsurerProfile.findById(purchase.insurerProfileId),
    User.findById(purchase.userId),
  ]);

  if (!policy || !insurer || !user) {
    throw new AppError(500, 'Purchase references missing policy, insurer, or user data');
  }

  const insurerUser = await User.findById(insurer.userId);
  if (!insurerUser) {
    throw new AppError(500, 'Insurer account is missing for this purchase');
  }

  const scheduledAt = nextBusinessDayAtTenPkt();
  const purchaseIdStr = String(purchase._id);

  const notifications = await Notification.insertMany([
    {
      userId: purchase.userId,
      type: 'purchase_success',
      title: 'Payment processed',
      body: `Your insurance payment for ${policy.name} was processed successfully.`,
      metadata: { purchaseId: purchaseIdStr, policyId: String(policy._id) },
    },
    {
      userId: purchase.userId,
      type: 'insurer_email',
      title: `Email from ${insurer.companyName}`,
      body: `${insurer.companyName} sent confirmation details for your ${policy.name} policy.`,
      metadata: { purchaseId: purchaseIdStr, insurerSlug: insurer.slug },
    },
    {
      userId: purchase.userId,
      type: 'call_scheduled',
      title: 'Call scheduled with insurer',
      body: `A follow-up call with ${insurer.companyName} is scheduled on ${scheduledAt.toISOString()}.`,
      metadata: {
        purchaseId: purchaseIdStr,
        insurerPhone: insurer.contactPhone,
        scheduledAt: scheduledAt.toISOString(),
      },
    },
    {
      userId: insurerUser._id,
      type: 'new_lead',
      title: 'New policy sold',
      body: `${user.fullName} completed purchase of ${policy.name}.`,
      metadata: {
        purchaseId: purchaseIdStr,
        policyId: String(policy._id),
        leadType: 'purchase',
      },
    },
  ]);

  const emailLog = await EmailLog.create({
    userId: purchase.userId,
    fromInsurerId: insurer._id,
    purchaseId: purchase._id,
    subject: `Policy confirmation — ${policy.name}`,
    body: `Dear ${user.fullName},\n\nThank you for choosing ${insurer.companyName}. Your ${policy.name} application has been received. Our team will contact you at ${user.phone} if any additional details are required.\n\nPremium: PKR ${policy.premiumMonthlyPkr.toLocaleString('en-PK')}/month\n\nRegards,\n${insurer.companyName}`,
    sentAt: new Date(),
    status: 'sent',
  });

  const env = loadEnv();
  if (isOutboundEmailConfigured(env)) {
    const emailSubject = emailLog.subject;
    const emailBodyHtml = emailLog.body
      .split('\n')
      .map((line) => `<p>${line || '&nbsp;'}</p>`)
      .join('');
    const branded = renderBrandedEmail({
      title: emailSubject,
      preheader: `Confirmation from ${insurer.companyName}`,
      bodyHtml: emailBodyHtml,
      bodyText: emailLog.body,
    });
    try {
      if (env.BREVO_API_KEY) {
        await sendTransactionalViaBrevo(
          env,
          user.email,
          emailSubject,
          branded.html,
          branded.text,
          { replyTo: insurer.contactEmail }
        );
      } else {
        await sendTransactionalEmail(
          env,
          user.email,
          emailSubject,
          branded.html,
          branded.text,
          { replyTo: insurer.contactEmail }
        );
      }
    } catch {
      await EmailLog.findByIdAndUpdate(emailLog._id, { status: 'failed' });
    }
  }

  const welcomeMessage = `Dear ${user.fullName},\n\nThank you for purchasing ${policy.name} with ${insurer.companyName}. Your policy application is confirmed at PKR ${policy.premiumMonthlyPkr.toLocaleString('en-PK')}/month.\n\nOur team is here if you have any questions about coverage or documents.\n\nRegards,\n${insurer.companyName}`;

  const { conversation } = await findOrCreateConversation({
    type: 'user_insurer',
    participantUserIds: [user._id, insurerUser._id],
    insurerProfileId: insurer._id,
    purchaseId: purchase._id,
    subject: `Purchase: ${policy.name}`,
  });

  await createConversationMessage(conversation, insurerUser._id, welcomeMessage);

  const callSchedule = await CallSchedule.create({
    userId: purchase.userId,
    insurerId: insurer._id,
    purchaseId: purchase._id,
    scheduledAt,
    status: 'scheduled',
    notes: `Follow-up for ${policy.name}`,
  });

  const lead = await Lead.findOneAndUpdate(
    {
      insurerProfileId: insurer._id,
      userId: purchase.userId,
      policyId: policy._id,
      type: 'purchase',
    },
    {
      insurerProfileId: insurer._id,
      userId: purchase.userId,
      policyId: policy._id,
      type: 'purchase',
      status: 'new',
      summary: `Purchase completed for ${policy.name}`,
      metadata: { purchaseId: purchaseIdStr },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  purchase.status = 'completed';
  purchase.completedAt = new Date();
  purchase.completionArtifactsCreated = true;
  await purchase.save();

  return {
    purchase,
    notifications,
    emailLog,
    callSchedule,
    lead,
    alreadyCompleted: false,
  };
}
