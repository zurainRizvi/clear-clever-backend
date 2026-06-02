import type { PremiumCadenceOffset } from '../constants/reminders';
import type { ReminderScenario } from '../constants/reminders';
import { renderClearCleverEmail } from './clearCleverEmailLayout';
import { reminderEmailContent, resolveClientBaseUrl } from './reminderEmailVariants';

function premiumOffsetLabel(offset: PremiumCadenceOffset): string {
  if (offset === 0) return 'today';
  if (offset === 10) return 'in 10 days';
  if (offset === 7) return 'in 7 days';
  return 'in 3 days';
}

function renderReminderEmail(
  scenario: ReminderScenario,
  context: { policyName: string; dueDate?: Date; offset?: PremiumCadenceOffset }
): { subject: string; html: string; text: string } {
  const content = reminderEmailContent(scenario, context);
  const base = resolveClientBaseUrl();
  const branded = renderClearCleverEmail(content, { supportUrl: `${base}/contact` });
  const subject = subjectForScenario(scenario, context.policyName);
  return { subject, ...branded };
}

function subjectForScenario(scenario: ReminderScenario, policyName: string): string {
  switch (scenario) {
    case 'premium_t10':
      return `Premium reminder (10 days): ${policyName}`;
    case 'premium_t7':
      return `Premium reminder (7 days): ${policyName}`;
    case 'premium_t3':
      return `Premium due in 3 days: ${policyName}`;
    case 'premium_due':
      return `Premium due today: ${policyName}`;
    case 'claim_followup_7d':
      return `Claim update: ${policyName}`;
    case 'approval_pending_insurer':
      return `Policy pending approval: ${policyName}`;
    case 'policy_completion_d7':
      return `One week with ${policyName}`;
    default:
      return `ClearClever reminder: ${policyName}`;
  }
}

export function premiumReminderEmail(
  policyName: string,
  dueDate: Date,
  offset: PremiumCadenceOffset
): { subject: string; html: string; text: string } {
  const scenario =
    offset === 10 ? 'premium_t10' : offset === 7 ? 'premium_t7' : offset === 3 ? 'premium_t3' : 'premium_due';
  return renderReminderEmail(scenario, { policyName, dueDate, offset });
}

export function claimFollowupEmail(policyName: string): {
  subject: string;
  html: string;
  text: string;
} {
  return renderReminderEmail('claim_followup_7d', { policyName });
}

export function approvalPendingEmail(policyName: string): {
  subject: string;
  html: string;
  text: string;
} {
  return renderReminderEmail('approval_pending_insurer', { policyName });
}

export function policyCompletionMilestoneEmail(policyName: string): {
  subject: string;
  html: string;
  text: string;
} {
  return renderReminderEmail('policy_completion_d7', { policyName });
}

export function reminderCopyForScenario(
  scenario: ReminderScenario,
  context: { policyName: string; dueDate?: Date; offset?: PremiumCadenceOffset }
): { title: string; body: string; email?: { subject: string; html: string; text: string } } {
  switch (scenario) {
    case 'premium_t10':
    case 'premium_t7':
    case 'premium_t3':
    case 'premium_due': {
      const offset =
        scenario === 'premium_t10' ? 10 : scenario === 'premium_t7' ? 7 : scenario === 'premium_t3' ? 3 : 0;
      const when = premiumOffsetLabel(offset as PremiumCadenceOffset);
      const dueStr = context.dueDate?.toISOString().slice(0, 10) ?? '';
      return {
        title: offset === 0 ? 'Premium due today' : 'Premium reminder',
        body: `Your premium for ${context.policyName} is due ${when}${dueStr ? ` (${dueStr})` : ''}.`,
        email: context.dueDate
          ? premiumReminderEmail(context.policyName, context.dueDate, offset as PremiumCadenceOffset)
          : undefined,
      };
    }
    case 'claim_followup_7d':
      return {
        title: 'Claim status update reminder',
        body: `Your claim for ${context.policyName} is still under review. We will notify you when there is an update.`,
        email: claimFollowupEmail(context.policyName),
      };
    case 'approval_pending_insurer':
      return {
        title: 'Policy approval reminder',
        body: `${context.policyName} is still pending approval. Please review it in your dashboard.`,
        email: approvalPendingEmail(context.policyName),
      };
    case 'policy_completion_d7':
      return {
        title: 'One-week policy check-in',
        body: `It has been one week since you completed ${context.policyName}. Review your coverage in My Purchases.`,
        email: policyCompletionMilestoneEmail(context.policyName),
      };
    default:
      return { title: 'Reminder', body: 'You have a new reminder in ClearClever.' };
  }
}
