import { KycVerification } from '../models/KycVerification';
import { User } from '../models/User';
import { deriveLocalFromCnic } from '../services/cnicDerivationService';
import { maskCnic } from '../utils/cnic';
import { DEMO_KYC } from './kycSeedData';
import { daysAgo, resolveUserId } from './seedDemoHelpers';

export interface SeedKycResult {
  created: number;
  updated: number;
}

export async function seedKyc(): Promise<SeedKycResult> {
  let created = 0;
  let updated = 0;

  for (const record of DEMO_KYC) {
    const userId = await resolveUserId(record.userEmail);
    const user = await User.findById(userId);
    if (!user?.cnic) continue;

    const local = deriveLocalFromCnic(user.cnic);
    if (!local) continue;

    const verifiedAt = daysAgo(record.daysAgoVerified ?? 1);
    const identityMatchScore = record.kycScore;

    const payload = {
      userId,
      cnicMasked: maskCnic(user.cnic),
      status: record.status,
      source: record.source,
      genderPredicted: local.genderPredicted,
      province: local.province,
      district: local.district,
      regionSlug: local.regionSlug,
      extractedFullName: record.extractedFullName,
      extractedFatherName: record.extractedFatherName,
      extractedDob: record.extractedDob,
      extractedExpiryDate: record.extractedExpiryDate,
      age: record.age,
      isAdult: record.isAdult,
      cnicExpired: record.cnicExpired,
      kycScore: record.kycScore,
      identityMatchScore,
      nameMatch: record.nameMatch,
      cnicMatch: record.cnicMatch,
      profileMatchesDocument:
        record.nameMatch && record.cnicMatch && record.documentReadable === true,
      documentReadable: record.documentReadable,
      identityVerified: record.identityVerified,
      missingFields: record.missingFields ?? [],
      suspiciousDocument: record.suspiciousDocument,
      croppedDocument: record.croppedDocument,
      blurScore: record.blurScore,
      tamperingRisk: record.tamperingRisk,
      verifiedAt,
    };

    const existing = await KycVerification.findOne({ userId });
    if (existing) {
      Object.assign(existing, payload);
      await existing.save();
      updated += 1;
    } else {
      await KycVerification.create(payload);
      created += 1;
    }
  }

  return { created, updated };
}
