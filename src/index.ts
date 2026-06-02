import dotenv from 'dotenv';
import path from 'path';
import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/db';
import { loadEnv } from './config/env';
import { setSmtpProbeResult } from './config/smtpStatus';
import { isOutboundEmailConfigured, probeOutboundEmail } from './services/emailDelivery';
import { startReminderWorker } from './services/reminderWorker';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main(): Promise<void> {
  const env = loadEnv();
  const app = createApp(env);

  await connectDatabase(env);
  startReminderWorker(env);

  if (isOutboundEmailConfigured(env)) {
    const probe = await probeOutboundEmail(env);
    setSmtpProbeResult(probe);
    if (probe.ok) {
      console.log(`[ClearClever] Email provider verified (${probe.provider})`);
    } else {
      console.error(`[ClearClever] Email provider (${probe.provider}) failed:`, probe.error);
      if (probe.provider === 'smtp' && env.NODE_ENV === 'production') {
        console.error(
          '[ClearClever] Render free tier blocks SMTP. Add BREVO_API_KEY (see docs/DEPLOYMENT.md) or upgrade Render.'
        );
      }
    }
  } else if (env.NODE_ENV === 'production') {
    console.error('[ClearClever] No email provider configured — OTP emails will not be sent');
  }

  const server = app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`[ClearClever] API listening on port ${env.PORT}`);
    console.log(`[ClearClever] Health check: /api/health`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n[ClearClever] ${signal} received — shutting down`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[ClearClever] Failed to start server:', err);
  process.exit(1);
});
