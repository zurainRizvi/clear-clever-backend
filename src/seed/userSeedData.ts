import type { UserRole, UserStatus } from '../constants/roles';

/** Default password for all seeded accounts (documented in docs/DEPLOYMENT.md). */
export const SEED_DEFAULT_PASSWORD = 'password';

export interface SeedUserRecord {
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  /** Defaults to active when omitted. */
  status?: UserStatus;
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
    fullName: 'Bilal Raza',
    email: 'insurer.hbl@clearclever.com',
    phone: '+923081667788',
    role: 'insurer',
  },
  {
    fullName: 'Nadia Hussain',
    email: 'insurer.allianz@clearclever.com',
    phone: '+923091778899',
    role: 'insurer',
  },
  {
    fullName: 'Kamran Siddiqui',
    email: 'insurer.efu@clearclever.com',
    phone: '+923102889900',
    role: 'insurer',
  },
  {
    fullName: 'Hina Malik',
    email: 'insurer.igi@clearclever.com',
    phone: '+923113990011',
    role: 'insurer',
  },
  {
    fullName: 'Pending Provider Demo',
    email: 'insurer.pending@clearclever.com',
    phone: '+923124001122',
    role: 'insurer',
    status: 'pendingVerification',
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
