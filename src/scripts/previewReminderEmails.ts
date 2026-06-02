/**
 * Send one branded email per Reminder V2 scenario (preview only — no DB dispatch log).
 *
 *   npm run preview:reminders -- syedzurainrizvi@gmail.com
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { loadEnv, resetEnvCache } from '../config/env';
import { REMINDER_SCENARIOS } from '../constants/reminders';
import type { ReminderScenario } from '../constants/reminders';
import { isOutboundEmailConfigured } from '../services/emailDelivery';
import { sendTransactionalEmail } from '../services/mail';
import { sendTransactionalViaBrevo } from '../services/brevo';
import { reminderCopyForScenario } from '../services/reminderTemplates';

const DEFAULT_TO = 'syedzurainrizvi@gmail.com';
const SAMPLE_POLICY = 'ClearClever Sample Home Policy';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendPreview(
  env: ReturnType<typeof loadEnv>,
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<void> {
  if (env.BREVO_API_KEY) {
    await sendTransactionalViaBrevo(env, to, subject, html, text);
  } else {
    await sendTransactionalEmail(env, to, subject, html, text);
  }
}

async function main(): Promise<void> {
  resetEnvCache();
  const env = loadEnv();
  const to = process.argv[2]?.trim() || DEFAULT_TO;

  if (!isOutboundEmailConfigured(env)) {
    console.error('Configure BREVO_API_KEY or SMTP_HOST/USER/PASS in .env');
    process.exit(1);
  }

  const dueDate = new Date();
  dueDate.setUTCDate(dueDate.getUTCDate() + 10);

  console.log(`Sending ${REMINDER_SCENARIOS.length} Reminder V2 preview emails to ${to}...\n`);

  for (const scenario of REMINDER_SCENARIOS) {
    const copy = reminderCopyForScenario(scenario as ReminderScenario, {
      policyName: SAMPLE_POLICY,
      dueDate,
    });
    if (!copy.email) {
      console.warn(`  skip ${scenario} (no email template)`);
      continue;
    }

    const subject = `[Preview] ${copy.email.subject}`;
    try {
      await sendPreview(env, to, subject, copy.email.html, copy.email.text);
      console.log(`  OK  ${scenario} → ${subject}`);
    } catch (err) {
      console.error(`  FAIL ${scenario}:`, err instanceof Error ? err.message : err);
      process.exit(1);
    }
    await sleep(1200);
  }

  console.log('\nDone — check inbox and spam.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
