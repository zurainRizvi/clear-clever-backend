import type { IUserDocument } from '../models/User';
import type { PakistanRegionSlug } from './pakistanRegionStats';
import {
  computeAgeFromDob,
  isCnicExpired,
  maskCnic,
  normalizeCnic,
  predictGenderFromCnic,
  resolveCnicIssuer,
  type CnicGender,
} from '../utils/cnic';

export interface CnicDerivationResult {
  cnicMasked: string;
  genderPredicted: CnicGender;
  province: string;
  district: string;
  regionSlug: PakistanRegionSlug;
  issuerPrefix: string;
}

function guessRegionSlug(prefix: string): PakistanRegionSlug {
  if (prefix.startsWith('17')) return 'kpk';
  if (prefix.startsWith('61')) return 'islamabad';
  const first = prefix[0];
  if (first === '1') return 'ajk';
  if (first === '3') return 'punjab';
  if (first === '4') return 'sindh';
  if (first === '5') return 'balochistan';
  if (first === '7') return 'gb';
  return 'punjab';
}

export function deriveLocalFromCnic(rawCnic: string): CnicDerivationResult | null {
  try {
    const normalized = normalizeCnic(rawCnic);
    const issuer = resolveCnicIssuer(normalized);
    const gender = predictGenderFromCnic(normalized);
    if (!gender) return null;

    if (issuer) {
      return {
        cnicMasked: maskCnic(normalized),
        genderPredicted: issuer.gender,
        province: issuer.province,
        district: issuer.district,
        regionSlug: issuer.regionSlug,
        issuerPrefix: issuer.issuerPrefix,
      };
    }

    const prefix = normalized.slice(0, 5);
    return {
      cnicMasked: maskCnic(normalized),
      genderPredicted: gender,
      province: 'Pakistan',
      district: 'Unknown district',
      regionSlug: guessRegionSlug(prefix),
      issuerPrefix: prefix,
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
