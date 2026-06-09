import type { IUserDocument } from '../models/User';
import {
  computeAgeFromDob,
  isCnicExpired,
  maskCnic,
  normalizeCnic,
  resolveCnicIssuer,
  type CnicGender,
} from '../utils/cnic';
import type { PakistanRegionSlug } from './pakistanRegionStats';

export interface CnicDerivationResult {
  cnicMasked: string;
  genderPredicted: CnicGender;
  province: string;
  district: string;
  regionSlug: PakistanRegionSlug;
  issuerPrefix: string;
}

export function deriveLocalFromCnic(rawCnic: string): CnicDerivationResult | null {
  try {
    const normalized = normalizeCnic(rawCnic);
    const issuer = resolveCnicIssuer(normalized);
    if (!issuer) return null;
    return {
      cnicMasked: maskCnic(normalized),
      genderPredicted: issuer.gender,
      province: issuer.province,
      district: issuer.district,
      regionSlug: issuer.regionSlug,
      issuerPrefix: issuer.issuerPrefix,
    };
  } catch {
    return null;
  }
}

export function deriveAgeFromDob(dob: string | undefined): { age?: number; isAdult?: boolean } {
  const info = computeAgeFromDob(dob);
  if (!info) return {};
  return { age: info.age, isAdult: info.isAdult };
}

export function deriveExpiryStatus(expiryDate: string | undefined): boolean | undefined {
  const expired = isCnicExpired(expiryDate);
  return expired === null ? undefined : expired;
}

export function userHasCnicForDerivation(user: IUserDocument): boolean {
  return Boolean(user.cnic?.trim());
}
