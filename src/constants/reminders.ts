import type { NotificationType } from './purchase';

/** Days before monthly premium due date to fire each reminder. */
export const PREMIUM_CADENCE_OFFSETS = [10, 7, 3, 0] as const;
export type PremiumCadenceOffset = (typeof PREMIUM_CADENCE_OFFSETS)[number];

export const REMINDER_SCENARIOS = [
  'premium_t10',
  'premium_t7',
  'premium_t3',
  'premium_due',
  'claim_followup_7d',
  'approval_pending_insurer',
  'policy_completion_d7',
] as const;
export type ReminderScenario = (typeof REMINDER_SCENARIOS)[number];

export function premiumScenarioForOffset(offset: PremiumCadenceOffset): ReminderScenario {
  if (offset === 10) return 'premium_t10';
  if (offset === 7) return 'premium_t7';
  if (offset === 3) return 'premium_t3';
  return 'premium_due';
}

export function notificationTypeForScenario(scenario: ReminderScenario): NotificationType {
  if (scenario.startsWith('premium_')) return 'premium_reminder';
  if (scenario === 'claim_followup_7d') return 'claim_reminder';
  if (scenario === 'approval_pending_insurer') return 'approval_reminder';
  return 'policy_completion';
}

export function buildPremiumDedupeKey(
  purchaseId: string,
  scenario: ReminderScenario,
  billingPeriodKey: string
): string {
  return `purchase:${purchaseId}:${scenario}:${billingPeriodKey}`;
}

export function buildClaimDedupeKey(claimId: string, weekKey: string): string {
  return `claim:${claimId}:followup:${weekKey}`;
}

export function buildApprovalDedupeKey(policyId: string, weekKey: string): string {
  return `policy:${policyId}:approval:${weekKey}`;
}

export function buildCompletionDedupeKey(purchaseId: string): string {
  return `purchase:${purchaseId}:completion_d7`;
}

/** UTC date key `YYYY-MM-DD` for dedupe windows. */
export function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Billing period for a due date (`YYYY-MM`). */
export function billingPeriodKey(dueDate: Date): string {
  const y = dueDate.getUTCFullYear();
  const m = String(dueDate.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** ISO week bucket for recurring follow-ups (year + week number). */
export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
