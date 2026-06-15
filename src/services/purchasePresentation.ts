import { CallSchedule } from '../models/CallSchedule';
import { ClaimRequest } from '../models/ClaimRequest';
import { EmailLog } from '../models/EmailLog';
import { InsurerProfile } from '../models/InsurerProfile';
import { Notification } from '../models/Notification';
import { Policy } from '../models/Policy';
import type { IPurchaseDocument } from '../models/Purchase';
import type { ICallScheduleDocument } from '../models/CallSchedule';
import { resolvePolicyFeatureSections } from './policyPresentation';

function toScheduleSummary(schedule: ICallScheduleDocument | null | undefined) {
  if (!schedule) return undefined;
  return {
    id: String(schedule._id),
    scheduleType: schedule.scheduleType,
    scheduledAt: schedule.scheduledAt.toISOString(),
    status: schedule.status,
    notes: schedule.notes,
    agentLabel: schedule.scheduleType === 'survey_visit' ? 'Survey visit' : 'ClearClever agent',
  };
}

export async function toPurchaseSummary(purchase: IPurchaseDocument) {
  const [policy, insurer, notifications, emailLog, callSchedules, claims] = await Promise.all([
    Policy.findById(purchase.policyId),
    InsurerProfile.findById(purchase.insurerProfileId),
    Notification.find({
      userId: purchase.userId,
      'metadata.purchaseId': String(purchase._id),
    }).sort({ createdAt: 1 }),
    EmailLog.findOne({ purchaseId: purchase._id }),
    CallSchedule.find({ purchaseId: purchase._id }).sort({ scheduleType: 1 }),
    ClaimRequest.find({ purchaseId: purchase._id }).sort({ createdAt: -1 }),
  ]);

  const agentCall =
    callSchedules.find((schedule) => schedule.scheduleType === 'agent_call') ?? callSchedules[0];
  const surveyVisit = callSchedules.find((schedule) => schedule.scheduleType === 'survey_visit');

  const featureSections =
    policy && insurer ? resolvePolicyFeatureSections(policy, insurer) : [];

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
          featureSections,
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
          pacraRating: insurer.pacraRating,
          jcrVisRating: insurer.jcrVisRating,
          operationalSince: insurer.operationalSince,
          policyType: insurer.policyType,
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
      callScheduled: toScheduleSummary(agentCall),
      surveyScheduled: toScheduleSummary(surveyVisit),
      schedules: callSchedules.map((schedule) => toScheduleSummary(schedule)!),
    },
  };
}
