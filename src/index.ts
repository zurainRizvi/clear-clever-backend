import dotenv from 'dotenv';
import path from 'path';
import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/db';
import { loadEnv } from './config/env';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main(): Promise<void> {
  const env = loadEnv();
  const app = createApp(env);

  await connectDatabase(env);

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
