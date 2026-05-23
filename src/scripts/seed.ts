import dotenv from 'dotenv';
import path from 'path';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { loadEnv } from '../config/env';
import { SEED_DEFAULT_PASSWORD } from '../seed/userSeedData';
import { seedUsers } from '../seed/seedUsers';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main(): Promise<void> {
  const env = loadEnv();
  await connectDatabase(env);

  const password = process.env.SEED_PASSWORD?.trim() || SEED_DEFAULT_PASSWORD;
  const result = await seedUsers(password);

  console.log('[ClearClever] User seed complete');
  console.log(`  created: ${result.created}`);
  console.log(`  updated: ${result.updated}`);
  console.log(`  accounts: ${result.emails.length}`);
  result.emails.forEach((email) => console.log(`    - ${email}`));

  await disconnectDatabase();
}

main().catch((err) => {
  console.error('[ClearClever] Seed failed:', err);
  process.exit(1);
});
