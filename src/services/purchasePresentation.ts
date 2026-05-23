import { CallSchedule } from '../models/CallSchedule';
import { EmailLog } from '../models/EmailLog';
import { InsurerProfile } from '../models/InsurerProfile';
import { Notification } from '../models/Notification';
import { Policy } from '../models/Policy';
import type { IPurchaseDocument } from '../models/Purchase';

export async function toPurchaseSummary(purchase: IPurchaseDocument) {
  const [policy, insurer, notifications, emailLog, callSchedule] = await Promise.all([
    Policy.findById(purchase.policyId),
    InsurerProfile.findById(purchase.insurerProfileId),
    Notification.find({ 'metadata.purchaseId': String(purchase._id) }).sort({ createdAt: 1 }),
    EmailLog.findOne({ purchaseId: purchase._id }),
    CallSchedule.findOne({ purchaseId: purchase._id }),
  ]);

  return {
    id: String(purchase._id),
    status: purchase.status,
    affiliateSlug: purchase.affiliateSlug,
    answers: purchase.answers,
    paymentProcessedAt: purchase.paymentProcessedAt?.toISOString(),
    completedAt: purchase.completedAt?.toISOString(),
    createdAt: purchase.createdAt.toISOString(),
    policy: policy
      ? {
          id: String(policy._id),
          slug: policy.slug,
          name: policy.name,
          category: policy.category,
          premiumMonthlyPkr: policy.premiumMonthlyPkr,
        }
      : undefined,
    insurer: insurer
      ? {
          id: String(insurer._id),
          slug: insurer.slug,
          companyName: insurer.companyName,
          contactPhone: insurer.contactPhone,
        }
      : undefined,
    timeline: {
      paymentProcessed: Boolean(purchase.paymentProcessedAt),
      completed: Boolean(purchase.completedAt),
      notifications: notifications.map((item) => ({
        id: String(item._id),
        type: item.type,
        title: item.title,
        body: item.body,
        read: item.read,
        createdAt: item.createdAt.toISOString(),
      })),
      email: emailLog
        ? {
            id: String(emailLog._id),
            subject: emailLog.subject,
            body: emailLog.body,
            sentAt: emailLog.sentAt.toISOString(),
            status: emailLog.status,
            fromInsurer: insurer?.companyName,
          }
        : undefined,
      callScheduled: callSchedule
        ? {
            id: String(callSchedule._id),
            scheduledAt: callSchedule.scheduledAt.toISOString(),
            status: callSchedule.status,
            notes: callSchedule.notes,
          }
        : undefined,
    },
  };
}
