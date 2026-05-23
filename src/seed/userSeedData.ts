import type { UserRole } from '../constants/roles';

/** Default password for all seeded accounts (documented in docs/DEPLOYMENT.md). */
export const SEED_DEFAULT_PASSWORD = 'password';

export interface SeedUserRecord {
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
}

/**
 * Pre-verified demo users for Atlas (Module 3).
 * Pakistan-focused profiles; insurer and staff names reflect Lahore operations.
 */
export const SEED_USERS: SeedUserRecord[] = [
  {
    fullName: 'Zurain Rizvi',
    email: 'syedzurainrizvi@gmail.com',
    phone: '+923001112233',
    role: 'user',
  },
  {
    fullName: 'Ayesha Khan',
    email: 'seeker@clearclever.com',
    phone: '+923021234567',
    role: 'user',
  },
  {
    fullName: 'Ahmed Hassan',
    email: 'insurer.tpl@clearclever.com',
    phone: '+923031112244',
    role: 'insurer',
  },
  {
    fullName: 'Fatima Sheikh',
    email: 'insurer.jubilee@clearclever.com',
    phone: '+923041223355',
    role: 'insurer',
  },
  {
    fullName: 'Usman Malik',
    email: 'insurer.adamjee@clearclever.com',
    phone: '+923051334466',
    role: 'insurer',
  },
  {
    fullName: 'Sara Ahmed',
    email: 'admin@clearclever.com',
    phone: '+923061445577',
    role: 'admin',
  },
  {
    fullName: 'Omar Rizvi',
    email: 'superadmin@clearclever.com',
    phone: '+923071556688',
    role: 'superadmin',
  },
];
