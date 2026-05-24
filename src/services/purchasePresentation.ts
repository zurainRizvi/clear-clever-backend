import { CallSchedule } from '../models/CallSchedule';
import { ClaimRequest } from '../models/ClaimRequest';
import { EmailLog } from '../models/EmailLog';
import { InsurerProfile } from '../models/InsurerProfile';
import { Notification } from '../models/Notification';
import { Policy } from '../models/Policy';
import type { IPurchaseDocument } from '../models/Purchase';

export async function toPurchaseSummary(purchase: IPurchaseDocument) {
  const [policy, insurer, notifications, emailLog, callSchedule, claims] = await Promise.all([
    Policy.findById(purchase.policyId),
    InsurerProfile.findById(purchase.insurerProfileId),
    Notification.find({ 'metadata.purchaseId': String(purchase._id) }).sort({ createdAt: 1 }),
    EmailLog.findOne({ purchaseId: purchase._id }),
    CallSchedule.findOne({ purchaseId: purchase._id }),
    ClaimRequest.find({ purchaseId: purchase._id }).sort({ createdAt: -1 }),
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
          description: policy.description,
          premiumMonthlyPkr: policy.premiumMonthlyPkr,
          premiumYearlyPkr: policy.premiumYearlyPkr,
          coverageSummary: policy.coverageSummary,
          features: policy.features,
          deductiblePkr: policy.deductiblePkr,
          documentSummary: {
            policyNumber: `CC-${String(purchase._id).slice(-8).toUpperCase()}`,
            issuedAt: purchase.completedAt?.toISOString() ?? purchase.createdAt.toISOString(),
            coverage: policy.coverageSummary,
          },
        }
      : undefined,
    insurer: insurer
      ? {
          id: String(insurer._id),
          slug: insurer.slug,
          companyName: insurer.companyName,
          contactEmail: insurer.contactEmail,
          contactPhone: insurer.contactPhone,
        }
      : undefined,
    claims: claims.map((claim) => ({
      id: String(claim._id),
      claimType: claim.claimType,
      status: claim.status,
      incidentDate: claim.incidentDate.toISOString(),
      estimatedAmountPkr: claim.estimatedAmountPkr,
      createdAt: claim.createdAt.toISOString(),
    })),
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
            agentLabel: 'ClearClever agent',
          }
        : undefined,
    },
  };
}
