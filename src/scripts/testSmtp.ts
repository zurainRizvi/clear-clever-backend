/**
 * Local SMTP diagnostic — run from clear-clever-backend:
 *   npx ts-node src/scripts/testSmtp.ts [recipient@email.com]
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { loadEnv, resetEnvCache } from '../config/env';
import {
  getEmailProvider,
  isOutboundEmailConfigured,
  probeOutboundEmail,
  sendOtpEmailDelivery,
} from '../services/emailDelivery';

async function main(): Promise<void> {
  resetEnvCache();
  const env = loadEnv();
  const to = process.argv[2]?.trim();

  console.log('NODE_ENV:', env.NODE_ENV);
  const provider = getEmailProvider(env);
  console.log('Email provider:', provider);
  console.log('Email configured:', isOutboundEmailConfigured(env));
  if (!isOutboundEmailConfigured(env)) {
    console.error('Set BREVO_API_KEY (Render) or SMTP_HOST/USER/PASS (local Gmail) in .env');
    process.exit(1);
  }

  if (provider === 'smtp') {
    console.log('SMTP_HOST:', env.SMTP_HOST);
    console.log('SMTP_USER:', env.SMTP_USER);
  } else {
    console.log('BREVO_SENDER:', env.BREVO_SENDER_EMAIL ?? env.SMTP_USER);
  }

  console.log('\nVerifying email connection...');
  const probe = await probeOutboundEmail(env);
  if (!probe.ok) {
    console.error('VERIFY FAILED:', probe.error);
    process.exit(1);
  }
  console.log('VERIFY OK');

  if (!to) {
    console.log('\nPass a recipient email to send a test OTP:');
    console.log('  npx ts-node src/scripts/testSmtp.ts you@example.com');
    process.exit(0);
  }

  const code = '123456';
  console.log(`\nSending test OTP to ${to}...`);
  try {
    await sendOtpEmailDelivery(env, to, code, 'signup');
    console.log('OK — email sent (check inbox and spam).');
  } catch (err) {
    console.error('FAILED:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
