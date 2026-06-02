import type { Env } from '../config/env';
import { ClaimRequest } from '../models/ClaimRequest';
import { InsurerProfile } from '../models/InsurerProfile';
import { Policy } from '../models/Policy';
import { Purchase } from '../models/Purchase';
import { User } from '../models/User';
import {
  billingPeriodKey,
  buildApprovalDedupeKey,
  buildClaimDedupeKey,
  buildCompletionDedupeKey,
  buildPremiumDedupeKey,
  isoWeekKey,
} from '../constants/reminders';
import { dispatchReminder } from './reminderDispatch';
import { reminderCopyForScenario } from './reminderTemplates';
import {
  activePremiumScenario,
  isDaysAfterUtc,
  nextPremiumDueDate,
  startOfUtcDay,
} from './reminderSchedule';

const HOUR_MS = 60 * 60 * 1000;
const CLAIM_STALE_MS = 7 * 24 * HOUR_MS;
const APPROVAL_STALE_MS = 3 * 24 * HOUR_MS;

export async function runReminderCycle(env: Env): Promise<void> {
  const now = new Date();
  const today = startOfUtcDay(now);

  await runPremiumReminders(env, today);
  await runClaimFollowups(env, now);
  await runApprovalReminders(env, now);
  await runCompletionMilestones(env, today);
}

async function runPremiumReminders(env: Env, today: Date): Promise<void> {
  const completedPurchases = await Purchase.find({
    status: 'completed',
    completedAt: { $exists: true, $ne: null },
  })
    .select('userId policyId completedAt')
    .lean();

  for (const purchase of completedPurchases) {
    if (!purchase.completedAt) continue;

    const dueDate = nextPremiumDueDate(purchase.completedAt, today);
    const scenario = activePremiumScenario(today, dueDate);
    if (!scenario) continue;

    const [user, policy] = await Promise.all([
      User.findById(purchase.userId).select('email fullName').lean(),
      Policy.findById(purchase.policyId).select('name').lean(),
    ]);
    if (!user || !policy) continue;

    const period = billingPeriodKey(dueDate);
    const dedupeKey = buildPremiumDedupeKey(String(purchase._id), scenario, period);
    const copy = reminderCopyForScenario(scenario, {
      policyName: policy.name,
      dueDate,
    });

    await dispatchReminder(env, {
      dedupeKey,
      userId: String(purchase.userId),
      scenario,
      title: copy.title,
      body: copy.body,
      metadata: {
        purchaseId: String(purchase._id),
        policyId: String(purchase.policyId),
        dueDate: dueDate.toISOString(),
        billingPeriod: period,
      },
      email: copy.email
        ? { to: user.email, subject: copy.email.subject, html: copy.email.html, text: copy.email.text }
        : undefined,
    });
  }
}

async function runClaimFollowups(env: Env, now: Date): Promise<void> {
  const staleClaims = await ClaimRequest.find({
    status: { $in: ['submitted', 'in_review'] },
    updatedAt: { $lt: new Date(now.getTime() - CLAIM_STALE_MS) },
  })
    .select('userId policyId')
    .lean();

  const weekKey = isoWeekKey(now);

  for (const claim of staleClaims) {
    const [user, policy] = await Promise.all([
      User.findById(claim.userId).select('email').lean(),
      Policy.findById(claim.policyId).select('name').lean(),
    ]);
    if (!user || !policy) continue;

    const dedupeKey = buildClaimDedupeKey(String(claim._id), weekKey);
    const copy = reminderCopyForScenario('claim_followup_7d', { policyName: policy.name });

    await dispatchReminder(env, {
      dedupeKey,
      userId: String(claim.userId),
      scenario: 'claim_followup_7d',
      title: copy.title,
      body: copy.body,
      metadata: { claimId: String(claim._id), policyId: String(claim.policyId) },
      email: copy.email
        ? { to: user.email, subject: copy.email.subject, html: copy.email.html, text: copy.email.text }
        : undefined,
    });
  }
}

async function runApprovalReminders(env: Env, now: Date): Promise<void> {
  const pendingPolicies = await Policy.find({
    status: 'pending',
    updatedAt: { $lt: new Date(now.getTime() - APPROVAL_STALE_MS) },
  })
    .select('name insurerProfileId')
    .lean();

  const weekKey = isoWeekKey(now);

  for (const policy of pendingPolicies) {
    const insurer = await InsurerProfile.findById(policy.insurerProfileId).select('userId').lean();
    if (!insurer) continue;

    const user = await User.findById(insurer.userId).select('email').lean();
    if (!user) continue;

    const dedupeKey = buildApprovalDedupeKey(String(policy._id), weekKey);
    const copy = reminderCopyForScenario('approval_pending_insurer', { policyName: policy.name });

    await dispatchReminder(env, {
      dedupeKey,
      userId: String(insurer.userId),
      scenario: 'approval_pending_insurer',
      title: copy.title,
      body: copy.body,
      metadata: { policyId: String(policy._id) },
      email: copy.email
        ? { to: user.email, subject: copy.email.subject, html: copy.email.html, text: copy.email.text }
        : undefined,
    });
  }
}

async function runCompletionMilestones(env: Env, today: Date): Promise<void> {
  const purchases = await Purchase.find({
    status: 'completed',
    completedAt: { $exists: true, $ne: null },
  })
    .select('userId policyId completedAt')
    .lean();

  for (const purchase of purchases) {
    if (!purchase.completedAt) continue;
    if (!isDaysAfterUtc(purchase.completedAt, today, 7)) continue;

    const [user, policy] = await Promise.all([
      User.findById(purchase.userId).select('email').lean(),
      Policy.findById(purchase.policyId).select('name').lean(),
    ]);
    if (!user || !policy) continue;

    const dedupeKey = buildCompletionDedupeKey(String(purchase._id));
    const copy = reminderCopyForScenario('policy_completion_d7', { policyName: policy.name });

    await dispatchReminder(env, {
      dedupeKey,
      userId: String(purchase.userId),
      scenario: 'policy_completion_d7',
      title: copy.title,
      body: copy.body,
      metadata: { purchaseId: String(purchase._id), policyId: String(purchase.policyId) },
      email: copy.email
        ? { to: user.email, subject: copy.email.subject, html: copy.email.html, text: copy.email.text }
        : undefined,
    });
  }
}

export function startReminderWorker(env: Env): void {
  const run = () => void runReminderCycle(env).catch((err) => {
    console.error('[reminderWorker] cycle failed', err);
  });

  void run();
  setInterval(run, HOUR_MS);
}
