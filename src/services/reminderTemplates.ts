import type { PremiumCadenceOffset } from '../constants/reminders';
import type { ReminderScenario } from '../constants/reminders';
import { renderBrandedEmail } from './emailTemplates';

function premiumOffsetLabel(offset: PremiumCadenceOffset): string {
  if (offset === 0) return 'today';
  if (offset === 10) return 'in 10 days';
  if (offset === 7) return 'in 7 days';
  return 'in 3 days';
}

export function premiumReminderEmail(
  policyName: string,
  dueDate: Date,
  offset: PremiumCadenceOffset
): { subject: string; html: string; text: string } {
  const dueStr = dueDate.toISOString().slice(0, 10);
  const when = premiumOffsetLabel(offset);
  const title =
    offset === 0 ? 'Premium due today' : `Premium reminder — due ${when}`;
  const subject = offset === 0 ? `Premium due today: ${policyName}` : `Premium reminder: ${policyName}`;

  const bodyHtml = `
    <p>Your premium for <strong>${policyName}</strong> is due <strong>${when}</strong> (${dueStr} UTC).</p>
    <p>Please complete payment on time to keep your coverage active.</p>
    <p style="margin-top:16px;"><a href="https://clearclever.vercel.app/dashboard/purchases" style="color:#2563EB;font-weight:600;">View purchases in ClearClever</a></p>
  `;
  const bodyText = `Premium for ${policyName} is due ${when} (${dueStr}). Complete payment on time to keep coverage active.`;

  const branded = renderBrandedEmail({
    title,
    preheader: `Policy premium due ${when}`,
    bodyHtml,
    bodyText,
  });

  return { subject, ...branded };
}

export function claimFollowupEmail(policyName: string): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Claim update: ${policyName}`;
  const branded = renderBrandedEmail({
    title: 'Claim still under review',
    preheader: 'We are following up on your claim',
    bodyHtml: `<p>Your claim for <strong>${policyName}</strong> is still being reviewed. We will notify you in the app as soon as there is an update.</p>`,
    bodyText: `Your claim for ${policyName} is still under review. We will notify you when there is an update.`,
  });
  return { subject, ...branded };
}

export function approvalPendingEmail(policyName: string): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Policy pending approval: ${policyName}`;
  const branded = renderBrandedEmail({
    title: 'Policy awaiting review',
    preheader: 'A submitted policy is still pending approval',
    bodyHtml: `<p><strong>${policyName}</strong> is still pending platform approval. Please review it in your insurer dashboard when ready.</p>`,
    bodyText: `${policyName} is still pending approval. Review it in your insurer dashboard.`,
  });
  return { subject, ...branded };
}

export function policyCompletionMilestoneEmail(policyName: string): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `One week with ${policyName}`;
  const branded = renderBrandedEmail({
    title: 'How is your coverage going?',
    preheader: 'One-week check-in after purchase',
    bodyHtml: `<p>It has been one week since you completed <strong>${policyName}</strong>. Review your policy details or start a claim from your ClearClever dashboard if you need support.</p>`,
    bodyText: `One week since you completed ${policyName}. Review your policy or start a claim from your dashboard if needed.`,
  });
  return { subject, ...branded };
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
