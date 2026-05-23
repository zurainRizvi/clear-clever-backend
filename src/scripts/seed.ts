import dotenv from 'dotenv';
import path from 'path';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { loadEnv } from '../config/env';
import { SEED_DEFAULT_PASSWORD } from '../seed/userSeedData';
import { seedAll } from '../seed/seedCatalog';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main(): Promise<void> {
  const env = loadEnv();
  await connectDatabase(env);

  const password = process.env.SEED_PASSWORD?.trim() || SEED_DEFAULT_PASSWORD;
  const result = await seedAll(password);

  console.log('[ClearClever] User seed complete');
  console.log(`  created: ${result.users.created}`);
  console.log(`  updated: ${result.users.updated}`);
  console.log(`  accounts: ${result.users.emails.length}`);
  result.users.emails.forEach((email) => console.log(`    - ${email}`));

  console.log('[ClearClever] Catalog seed complete');
  console.log(`  insurers created: ${result.catalog.insurersCreated}`);
  console.log(`  insurers updated: ${result.catalog.insurersUpdated}`);
  console.log(`  policies created: ${result.catalog.policiesCreated}`);
  console.log(`  policies updated: ${result.catalog.policiesUpdated}`);
  console.log(`  insurer slugs: ${result.catalog.insurerSlugs.join(', ')}`);
  console.log(`  policies: ${result.catalog.policySlugs.length}`);

  await disconnectDatabase();
}

main().catch((err) => {
  console.error('[ClearClever] Seed failed:', err);
  process.exit(1);
});
