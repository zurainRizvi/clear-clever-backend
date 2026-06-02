import type { Env } from '../config/env';
import type { ReminderScenario } from '../constants/reminders';
import { notificationTypeForScenario } from '../constants/reminders';
import { Notification } from '../models/Notification';
import { ReminderDispatch } from '../models/ReminderDispatch';
import { UserProfile } from '../models/UserProfile';
import { isOutboundEmailConfigured } from './emailDelivery';
import { sendTransactionalEmail } from './mail';
import { sendTransactionalViaBrevo } from './brevo';
import type { NotificationType } from '../constants/purchase';

export interface DispatchReminderInput {
  dedupeKey: string;
  userId: string;
  scenario: ReminderScenario;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  email?: {
    to: string;
    subject: string;
    html: string;
    text: string;
  };
  /** When false, skip in-app notification (rare). */
  sendInApp?: boolean;
  /** When false, skip email even if configured. */
  sendEmail?: boolean;
}

async function profilePrefs(userId: string) {
  const profile = await UserProfile.findOne({ userId }).select('notificationPreferences').lean();
  return profile?.notificationPreferences ?? {
    emailUpdates: true,
    claimAlerts: true,
    policyReminders: true,
  };
}

export function scenarioAllowsReminder(
  scenario: ReminderScenario,
  prefs: { emailUpdates: boolean; claimAlerts: boolean; policyReminders: boolean }
): boolean {
  if (scenario.startsWith('premium_') || scenario === 'policy_completion_d7') {
    return prefs.policyReminders !== false;
  }
  if (scenario === 'claim_followup_7d') {
    return prefs.claimAlerts !== false;
  }
  return true;
}

export function scenarioAllowsEmail(
  scenario: ReminderScenario,
  prefs: { emailUpdates: boolean; claimAlerts: boolean; policyReminders: boolean }
): boolean {
  if (!prefs.emailUpdates) return false;
  if (scenario.startsWith('premium_') || scenario === 'policy_completion_d7') {
    return prefs.policyReminders !== false;
  }
  if (scenario === 'claim_followup_7d') {
    return prefs.claimAlerts !== false;
  }
  return true;
}

async function sendEmail(env: Env, to: string, subject: string, html: string, text: string) {
  if (env.BREVO_API_KEY) {
    await sendTransactionalViaBrevo(env, to, subject, html, text);
  } else {
    await sendTransactionalEmail(env, to, subject, html, text);
  }
}

/**
 * Idempotent reminder dispatch. Returns true when a new reminder was sent.
 */
export async function dispatchReminder(env: Env, input: DispatchReminderInput): Promise<boolean> {
  const existing = await ReminderDispatch.findOne({ dedupeKey: input.dedupeKey }).lean();
  if (existing) return false;

  const prefs = await profilePrefs(input.userId);
  if (!scenarioAllowsReminder(input.scenario, prefs)) {
    return false;
  }

  const type: NotificationType = notificationTypeForScenario(input.scenario);
  const sendInApp = input.sendInApp !== false;
  const wantEmail =
    input.sendEmail !== false &&
    Boolean(input.email) &&
    isOutboundEmailConfigured(env) &&
    scenarioAllowsEmail(input.scenario, prefs);

  if (sendInApp) {
    await Notification.create({
      userId: input.userId,
      type,
      title: input.title,
      body: input.body,
      metadata: {
        ...input.metadata,
        reminderScenario: input.scenario,
      },
    });
  }

  if (wantEmail && input.email) {
    await sendEmail(env, input.email.to, input.email.subject, input.email.html, input.email.text);
  }

  try {
    await ReminderDispatch.create({
      dedupeKey: input.dedupeKey,
      userId: input.userId,
      scenario: input.scenario,
      channels: { inApp: sendInApp, email: wantEmail },
      metadata: input.metadata,
    });
    return true;
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code === 11_000) return false;
    throw err;
  }
}
