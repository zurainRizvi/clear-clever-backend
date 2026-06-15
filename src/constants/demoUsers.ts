import { SEED_USERS } from '../seed/userSeedData';

const DEMO_EMAILS = new Set(SEED_USERS.map((user) => user.email.toLowerCase()));

export function isDemoUserEmail(email: string | undefined | null): boolean {
  if (!email) {
    return false;
  }
  return DEMO_EMAILS.has(email.trim().toLowerCase());
}
