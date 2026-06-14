import { cnicMatches } from '../utils/cnic';

function normalizeName(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

export function namesMatch(profileName: string, extractedName: string): boolean {
  const profileTokens = normalizeName(profileName);
  const extractedTokens = normalizeName(extractedName);
  if (profileTokens.length === 0 || extractedTokens.length === 0) return false;
  const overlap = profileTokens.filter((t) => extractedTokens.includes(t));
  return overlap.length >= Math.min(2, profileTokens.length);
}

export interface IdentityMatchInput {
  profileName: string;
  profileCnic?: string;
  extractedName?: string;
  extractedCnic?: string;
  documentReadable: boolean;
  cnicExpired: boolean | null;
  suspiciousDocument: boolean;
  croppedDocument: boolean;
  blurScore: 'Low' | 'Medium' | 'High';
}

export interface IdentityMatchResult {
  nameMatch: boolean;
  cnicMatch: boolean;
  profileMatchesDocument: boolean;
  identityMatchScore: number;
  kycScore: number;
  identityVerified: boolean;
}

export function computeIdentityMatchScore(input: IdentityMatchInput): IdentityMatchResult {
  const nameMatch = input.extractedName
    ? namesMatch(input.profileName, input.extractedName)
    : false;
  const cnicMatch = input.extractedCnic
    ? cnicMatches(input.profileCnic, input.extractedCnic)
    : false;

  let score = 0;
  if (nameMatch) score += 35;
  if (cnicMatch) score += 35;
  if (input.documentReadable) score += 20;
  if (input.cnicExpired === false) score += 10;
  if (input.suspiciousDocument) score -= 15;
  if (input.croppedDocument) score -= 10;
  if (input.blurScore === 'High') score -= 10;
  else if (input.blurScore === 'Medium') score -= 5;

  let kycScore = Math.max(0, Math.min(100, score));
  const profileMatchesDocument = nameMatch && cnicMatch && input.documentReadable;
  const identityVerified =
    kycScore >= 85 && nameMatch && cnicMatch && input.documentReadable && input.cnicExpired !== true;

  if (identityVerified) {
    kycScore = 100;
  }

  return {
    nameMatch,
    cnicMatch,
    profileMatchesDocument,
    identityMatchScore: kycScore,
    kycScore,
    identityVerified,
  };
}
