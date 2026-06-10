import { AppError } from '../utils/apiResponse';
import { InsurerProfile } from '../models/InsurerProfile';
import { Policy } from '../models/Policy';
import { User } from '../models/User';
import { seedDerivedAuditEvents } from '../services/auditLogService';
import { SEED_INSURERS } from './insurerSeedData';
import { SEED_POLICIES } from './policySeedData';
import { seedUsers, type SeedUsersResult } from './seedUsers';
import { seedKyc, type SeedKycResult } from './seedKyc';

export interface SeedCatalogResult {
  insurersCreated: number;
  insurersUpdated: number;
  policiesCreated: number;
  policiesUpdated: number;
  insurerSlugs: string[];
  policySlugs: string[];
}

export async function seedCatalog(): Promise<SeedCatalogResult> {
  const insurerIdBySeedKey = new Map<string, string>();
  let insurersCreated = 0;
  let insurersUpdated = 0;

  for (const record of SEED_INSURERS) {
    const user = await User.findOne({ email: record.insurerEmail.toLowerCase().trim() });
    if (!user) {
      throw new AppError(
        500,
        `Cannot seed catalog: insurer user ${record.insurerEmail} not found. Run user seed first.`
      );
    }
    if (user.role !== 'insurer') {
      throw new AppError(
        500,
        `Cannot seed catalog: ${record.insurerEmail} must have insurer role`
      );
    }

    const existing = await InsurerProfile.findOne({ slug: record.slug });
    if (existing) {
      existing.userId = user._id;
      existing.companyName = record.companyName;
      existing.contactEmail = record.contactEmail;
      existing.contactPhone = record.contactPhone;
      existing.description = record.description;
      existing.websiteUrl = record.websiteUrl;
      await existing.save();
      insurersUpdated += 1;
      insurerIdBySeedKey.set(record.seedKey, String(existing._id));
    } else {
      const created = await InsurerProfile.create({
        userId: user._id,
        companyName: record.companyName,
        slug: record.slug,
        contactEmail: record.contactEmail,
        contactPhone: record.contactPhone,
        description: record.description,
        websiteUrl: record.websiteUrl,
      });
      insurersCreated += 1;
      insurerIdBySeedKey.set(record.seedKey, String(created._id));
    }
  }

  let policiesCreated = 0;
  let policiesUpdated = 0;

  for (const record of SEED_POLICIES) {
    const insurerProfileId = insurerIdBySeedKey.get(record.insurerSeedKey);
    if (!insurerProfileId) {
      throw new AppError(500, `Missing insurer profile for seed key ${record.insurerSeedKey}`);
    }

    const payload = {
      insurerProfileId,
      slug: record.slug,
      name: record.name,
      category: record.category,
      description: record.description,
      premiumMonthlyPkr: record.premiumMonthlyPkr,
      premiumYearlyPkr: record.premiumYearlyPkr,
      coverageSummary: record.coverageSummary,
      features: record.features,
      deductiblePkr: record.deductiblePkr,
      questions: record.questions,
      status: record.status,
      rejectionReason: record.rejectionReason,
    };

    const existing = await Policy.findOne({ slug: record.slug });
    if (existing) {
      Object.assign(existing, payload);
      await existing.save();
      policiesUpdated += 1;
    } else {
      await Policy.create(payload);
      policiesCreated += 1;
    }
  }

  return {
    insurersCreated,
    insurersUpdated,
    policiesCreated,
    policiesUpdated,
    insurerSlugs: SEED_INSURERS.map((i) => i.slug),
    policySlugs: SEED_POLICIES.map((p) => p.slug),
  };
}

export async function seedAll(password?: string): Promise<{
  users: SeedUsersResult;
  catalog: SeedCatalogResult;
  kyc: SeedKycResult;
}> {
  const users = await seedUsers(password);
  const catalog = await seedCatalog();
  const kyc = await seedKyc();

  const [seedUsersDocs, pendingPolicies] = await Promise.all([
    User.find().sort({ createdAt: -1 }).limit(12).select('fullName email createdAt'),
    Policy.find({ status: 'pending' }).sort({ createdAt: -1 }).limit(12).select('name createdAt'),
  ]);
  await seedDerivedAuditEvents({
    users: seedUsersDocs.map((user) => ({
      fullName: user.fullName,
      email: user.email,
      createdAt: user.createdAt,
    })),
    pendingPolicies: pendingPolicies.map((policy) => ({
      name: policy.name,
      createdAt: policy.createdAt,
    })),
  });

  return { users, catalog, kyc };
}
