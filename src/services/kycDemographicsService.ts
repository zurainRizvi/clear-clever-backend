import type { IKycVerificationDocument } from '../models/KycVerification';

export interface CustomerDemographicsPayload {
  title: string;
  subtitle: string;
  totalPurchasers: number;
  kycVerifiedCount: number;
  kycVerifiedRate: string;
  kycVerifiedRatePct: number;
  gender: { male: number; female: number; unknown: number };
  ageBuckets: {
    under18: number;
    age18to25: number;
    age26to35: number;
    age36to50: number;
    age50plus: number;
    unknown: number;
  };
  adultRate: string;
  adultRatePct: number;
  expiredCnicCount: number;
  topDistricts: Array<{ district: string; province: string; count: number }>;
  topProvinces: Array<{ province: string; count: number }>;
  verificationQuality: {
    avgKycScore: number;
    avgKycScoreFormatted: string;
    documentReadableRate: string;
    documentReadableRatePct: number;
  };
}

function ageBucket(age: number | undefined): keyof CustomerDemographicsPayload['ageBuckets'] {
  if (age === undefined || age === null) return 'unknown';
  if (age < 18) return 'under18';
  if (age <= 25) return 'age18to25';
  if (age <= 35) return 'age26to35';
  if (age <= 50) return 'age36to50';
  return 'age50plus';
}

export function buildCustomerDemographics(input: {
  purchaserUserIds: string[];
  kycByUser: Map<string, IKycVerificationDocument>;
}): CustomerDemographicsPayload {
  const gender = { male: 0, female: 0, unknown: 0 };
  const ageBuckets = {
    under18: 0,
    age18to25: 0,
    age26to35: 0,
    age36to50: 0,
    age50plus: 0,
    unknown: 0,
  };
  const districtCounts = new Map<string, { district: string; province: string; count: number }>();
  const provinceCounts = new Map<string, number>();
  let kycVerifiedCount = 0;
  let expiredCnicCount = 0;
  let adultCount = 0;
  let knownAdultStatus = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  let readableCount = 0;
  let uploadCount = 0;

  for (const userId of input.purchaserUserIds) {
    const kyc = input.kycByUser.get(userId);
    if (!kyc) {
      gender.unknown += 1;
      ageBuckets.unknown += 1;
      continue;
    }

    if (kyc.genderPredicted === 'male') gender.male += 1;
    else if (kyc.genderPredicted === 'female') gender.female += 1;
    else gender.unknown += 1;

    const bucket = ageBucket(kyc.age);
    ageBuckets[bucket] += 1;

    if (kyc.isAdult !== undefined) {
      knownAdultStatus += 1;
      if (kyc.isAdult) adultCount += 1;
    }
    if (kyc.cnicExpired) expiredCnicCount += 1;
    if (kyc.status === 'verified' || kyc.identityVerified) kycVerifiedCount += 1;

    if (kyc.district && kyc.province) {
      const key = `${kyc.province}:${kyc.district}`;
      const existing = districtCounts.get(key);
      if (existing) existing.count += 1;
      else districtCounts.set(key, { district: kyc.district, province: kyc.province, count: 1 });

      provinceCounts.set(kyc.province, (provinceCounts.get(kyc.province) ?? 0) + 1);
    }

    if (kyc.kycScore !== undefined) {
      scoreSum += kyc.kycScore;
      scoreCount += 1;
    }
    if (kyc.source === 'upload') {
      uploadCount += 1;
      if (kyc.documentReadable) readableCount += 1;
    }
  }

  const total = input.purchaserUserIds.length;
  const verifiedPct = total > 0 ? Math.round((kycVerifiedCount / total) * 1000) / 10 : 0;
  const adultPct =
    knownAdultStatus > 0 ? Math.round((adultCount / knownAdultStatus) * 1000) / 10 : 0;
  const avgScore = scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 0;
  const readablePct =
    uploadCount > 0 ? Math.round((readableCount / uploadCount) * 1000) / 10 : 0;

  return {
    title: 'Customer demographics',
    subtitle:
      'Aggregated from CNIC structure and AI document verification for policy purchasers in this period',
    totalPurchasers: total,
    kycVerifiedCount,
    kycVerifiedRate: `${verifiedPct}%`,
    kycVerifiedRatePct: verifiedPct,
    gender,
    ageBuckets,
    adultRate: knownAdultStatus > 0 ? `${adultPct}%` : 'N/A',
    adultRatePct: adultPct,
    expiredCnicCount,
    topDistricts: [...districtCounts.values()].sort((a, b) => b.count - a.count).slice(0, 8),
    topProvinces: [...provinceCounts.entries()]
      .map(([province, count]) => ({ province, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
    verificationQuality: {
      avgKycScore: avgScore,
      avgKycScoreFormatted: scoreCount > 0 ? `${avgScore}/100` : 'N/A',
      documentReadableRate: uploadCount > 0 ? `${readablePct}%` : 'N/A',
      documentReadableRatePct: readablePct,
    },
  };
}

export function demographicsChipFromKyc(
  kyc: IKycVerificationDocument | undefined
): {
  gender?: string;
  ageBand?: string;
  province?: string;
  district?: string;
  kycStatus: string;
  kycScore?: number;
} {
  if (!kyc) return { kycStatus: 'none' };

  let ageBand: string | undefined;
  if (kyc.age !== undefined) {
    if (kyc.age < 18) ageBand = 'Under 18';
    else if (kyc.age <= 25) ageBand = '18–25';
    else if (kyc.age <= 35) ageBand = '26–35';
    else if (kyc.age <= 50) ageBand = '36–50';
    else ageBand = '50+';
  }

  return {
    gender: kyc.genderPredicted,
    ageBand,
    province: kyc.province,
    district: kyc.district,
    kycStatus: kyc.status,
    kycScore: kyc.kycScore,
  };
}
