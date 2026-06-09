import type { UserRole, UserStatus } from '../constants/roles';

/** Default password for all seeded accounts (documented in docs/DEPLOYMENT.md). */
export const SEED_DEFAULT_PASSWORD = 'password';

export interface SeedUserRecord {
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  cnic?: string;
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
    cnic: '35202-9876543-1',
  },
  {
    fullName: 'Ayesha Khan',
    email: 'seeker@clearclever.com',
    phone: '+923021234567',
    role: 'user',
    cnic: '42101-1234567-2',
  },
  {
    fullName: 'Fatima Ali',
    email: 'fatima.ali@clearclever.com',
    phone: '+923221112233',
    role: 'user',
    cnic: '42201-2345678-2',
  },
  {
    fullName: 'Hassan Raza',
    email: 'hassan.raza@clearclever.com',
    phone: '+923331223344',
    role: 'user',
    cnic: '35202-3456789-1',
  },
  {
    fullName: 'Sana Mirza',
    email: 'sana.mirza@clearclever.com',
    phone: '+923441334455',
    role: 'user',
    cnic: '61101-4567890-4',
  },
  {
    fullName: 'Usman Khan',
    email: 'usman.khan@clearclever.com',
    phone: '+923551445566',
    role: 'user',
    cnic: '17301-5678901-1',
  },
  {
    fullName: 'Nadia Sheikh',
    email: 'nadia.sheikh@clearclever.com',
    phone: '+923661556677',
    role: 'user',
    cnic: '33101-6789012-6',
  },
  {
    fullName: 'Bilal Ahmed',
    email: 'bilal.ahmed@clearclever.com',
    phone: '+923771667788',
    role: 'user',
    cnic: '43101-7890123-3',
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
