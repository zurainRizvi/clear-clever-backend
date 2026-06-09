import type { IUserDocument } from '../models/User';
import { User } from '../models/User';
import { hashPassword } from '../services/auth';
import { deriveFromCnic } from '../services/kycService';
import { SEED_DEFAULT_PASSWORD, SEED_USERS, type SeedUserRecord } from './userSeedData';

export interface SeedUsersResult {
  created: number;
  updated: number;
  emails: string[];
  kycPartial: number;
}

export async function seedUsers(
  password: string = SEED_DEFAULT_PASSWORD
): Promise<SeedUsersResult> {
  const passwordHash = await hashPassword(password);
  let created = 0;
  let updated = 0;
  let kycPartial = 0;

  for (const record of SEED_USERS) {
    const normalized = normalizeSeedUser(record);
    const existing = await User.findOne({ email: normalized.email }).select('+passwordHash');
    let userDoc: IUserDocument;

    if (existing) {
      existing.fullName = normalized.fullName;
      existing.phone = normalized.phone;
      existing.role = normalized.role;
      existing.status = normalized.status ?? 'active';
      existing.passwordHash = passwordHash;
      if (normalized.cnic) existing.cnic = normalized.cnic;
      await existing.save();
      userDoc = existing;
      updated += 1;
    } else {
      userDoc = await User.create({
        fullName: normalized.fullName,
        email: normalized.email,
        phone: normalized.phone,
        role: normalized.role,
        status: normalized.status ?? 'active',
        passwordHash,
        ...(normalized.cnic ? { cnic: normalized.cnic } : {}),
      });
      created += 1;
    }

    if (normalized.cnic && normalized.role === 'user') {
      try {
        await deriveFromCnic(userDoc);
        kycPartial += 1;
      } catch {
        // Local derivation is best-effort during seed.
      }
    }
  }

  return {
    created,
    updated,
    emails: SEED_USERS.map((u) => u.email.toLowerCase().trim()),
    kycPartial,
  };
}

function normalizeSeedUser(record: SeedUserRecord): Required<Pick<SeedUserRecord, 'email' | 'fullName' | 'phone' | 'role'>> & SeedUserRecord {
  return {
    ...record,
    email: record.email.toLowerCase().trim(),
    fullName: record.fullName.trim(),
    phone: record.phone.trim(),
  };
}
