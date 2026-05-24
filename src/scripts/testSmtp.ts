/**
 * Local SMTP diagnostic — run from clear-clever-backend:
 *   npx ts-node src/scripts/testSmtp.ts [recipient@email.com]
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { isSmtpConfigured, loadEnv, resetEnvCache } from '../config/env';
import { probeSmtp, sendOtpEmail } from '../services/mail';

async function main(): Promise<void> {
  resetEnvCache();
  const env = loadEnv();
  const to = process.argv[2]?.trim();

  console.log('NODE_ENV:', env.NODE_ENV);
  console.log('SMTP configured:', isSmtpConfigured(env));
  if (!isSmtpConfigured(env)) {
    console.error('Set SMTP_HOST, SMTP_USER, and SMTP_PASS in .env');
    process.exit(1);
  }

  console.log('SMTP_HOST:', env.SMTP_HOST);
  console.log('SMTP_PORT:', env.SMTP_PORT ?? 587);
  console.log('SMTP_SECURE:', env.SMTP_SECURE ?? false);
  console.log('SMTP_USER:', env.SMTP_USER);
  console.log('SMTP_FROM:', env.SMTP_FROM ?? `(default: ClearClever <${env.SMTP_USER}>)`);

  console.log('\nVerifying SMTP connection...');
  const probe = await probeSmtp(env);
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
    await sendOtpEmail(env, to, code, 'signup');
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
