import type { Types } from 'mongoose';
import { loadEnv } from '../config/env';
import { CallSchedule } from '../models/CallSchedule';
import { EmailLog } from '../models/EmailLog';
import { InsurerProfile } from '../models/InsurerProfile';
import { Notification } from '../models/Notification';
import { Policy } from '../models/Policy';
import type { IPurchaseDocument } from '../models/Purchase';
import { Purchase } from '../models/Purchase';
import { User } from '../models/User';
import { AppError } from '../utils/apiResponse';
import { createConversationMessage, findOrCreateConversation } from './conversationService';
import { isOutboundEmailConfigured } from './emailDelivery';
import { renderBrandedEmail } from './emailTemplates';
import { sendTransactionalEmail } from './mail';
import { sendTransactionalViaBrevo } from './brevo';

type PurchaseLifecycleAction = 'revoke' | 'terminate';

async function sendPurchaseLifecycleEmail(
  userEmail: string,
  subject: string,
  body: string,
  replyTo?: string
): Promise<void> {
  const env = loadEnv();
  if (!isOutboundEmailConfigured(env)) return;

  const bodyHtml = body
    .split('\n')
    .map((line) => `<p>${line || '&nbsp;'}</p>`)
    .join('');
  const branded = renderBrandedEmail({
    title: subject,
    preheader: subject,
    bodyHtml,
    bodyText: body,
  });

  try {
    if (env.BREVO_API_KEY) {
      await sendTransactionalViaBrevo(env, userEmail, subject, branded.html, branded.text, {
        replyTo,
      });
    } else {
      await sendTransactionalEmail(env, userEmail, subject, branded.html, branded.text, {
        replyTo,
      });
    }
  } catch {
    /* email delivery is best-effort */
  }
}

export async function applyPurchaseLifecycleAction(
  purchaseId: string,
  insurerProfileId: Types.ObjectId | string,
  insurerUserId: Types.ObjectId,
  action: PurchaseLifecycleAction
): Promise<IPurchaseDocument> {
  const purchase = await Purchase.findOne({
    _id: purchaseId,
    insurerProfileId,
  });

  if (!purchase) {
    throw new AppError(404, 'Purchase not found');
  }

  if (purchase.status === 'revoked' || purchase.status === 'terminated') {
    throw new AppError(400, 'This purchase has already been updated');
  }

  if (purchase.status !== 'completed') {
    throw new AppError(400, 'Only completed purchases can be revoked or terminated');
  }

  const [policy, insurer, user] = await Promise.all([
    Policy.findById(purchase.policyId),
    InsurerProfile.findById(purchase.insurerProfileId),
    User.findById(purchase.userId),
  ]);

  if (!policy || !insurer || !user) {
    throw new AppError(500, 'Purchase references missing policy, insurer, or user data');
  }

  const purchaseIdStr = String(purchase._id);
  const isRevoke = action === 'revoke';

  purchase.status = isRevoke ? 'revoked' : 'terminated';
  await purchase.save();

  await CallSchedule.updateMany(
    { purchaseId: purchase._id, status: 'scheduled' },
    { status: 'cancelled', notes: isRevoke ? 'Purchase revoked by insurer' : 'Policy terminated by insurer' }
  );

  const notificationTitle = isRevoke ? 'Policy purchase revoked' : 'Policy no longer active';
  const notificationBody = isRevoke
    ? `${insurer.companyName} revoked your ${policy.name} purchase. It has been removed from your active policies.`
    : `${policy.name} from ${insurer.companyName} is no longer being served. Contact the insurer if you have questions.`;

  await Notification.create({
    userId: purchase.userId,
    type: isRevoke ? 'purchase_revoked' : 'purchase_terminated',
    title: notificationTitle,
    body: notificationBody,
    metadata: {
      purchaseId: purchaseIdStr,
      policyId: String(policy._id),
      insurerProfileId: String(insurer._id),
      action,
    },
  });

  const emailSubject = isRevoke
    ? `Purchase revoked — ${policy.name}`
    : `Policy terminated — ${policy.name}`;
  const emailBody = isRevoke
    ? `Dear ${user.fullName},\n\n${insurer.companyName} has revoked your ${policy.name} purchase. It has been removed from your ClearClever purchases.\n\nIf you believe this was a mistake, reply to this email or message the insurer in your portal.\n\nRegards,\n${insurer.companyName}`
    : `Dear ${user.fullName},\n\n${insurer.companyName} has terminated service for ${policy.name}. This policy is no longer being served.\n\nYou can view the update in My Purchases on ClearClever.\n\nRegards,\n${insurer.companyName}`;

  await EmailLog.create({
    userId: purchase.userId,
    fromInsurerId: insurer._id,
    purchaseId: purchase._id,
    subject: emailSubject,
    body: emailBody,
    sentAt: new Date(),
    status: 'sent',
  });

  await sendPurchaseLifecycleEmail(user.email, emailSubject, emailBody, insurer.contactEmail);

  const { conversation } = await findOrCreateConversation({
    type: 'user_insurer',
    participantUserIds: [user._id, insurerUserId],
    insurerProfileId: insurer._id,
    purchaseId: purchase._id,
    subject: `${isRevoke ? 'Revoked' : 'Terminated'}: ${policy.name}`,
  });

  await createConversationMessage(conversation, insurerUserId, emailBody);

  return purchase;
}
