import { lookupCnicIssuer, type CnicIssuerInfo } from '../data/cnicIssuerRegistry';

/** Pakistan CNIC: 12345-1234567-1 (13 digits). */
export const CNIC_REGEX = /^\d{5}-\d{7}-\d{1}$/;

export type CnicGender = 'male' | 'female';

export interface CnicAgeInfo {
  age: number;
  isAdult: boolean;
}

export interface CnicLocalDerivation extends CnicIssuerInfo {
  gender: CnicGender;
  issuerPrefix: string;
}

export function normalizeCnic(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 13) {
    throw new Error('CNIC must contain 13 digits');
  }
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

export function isValidCnicFormat(raw: string): boolean {
  try {
    const normalized = normalizeCnic(raw);
    return CNIC_REGEX.test(normalized);
  } catch {
    return false;
  }
}

export function maskCnic(cnic: string): string {
  try {
    const normalized = normalizeCnic(cnic);
    const parts = normalized.split('-');
    return `${parts[0]}-*******-${parts[2]}`;
  } catch {
    const cleaned = cnic.replace(/\s/g, '');
    if (cleaned.length >= 5) {
      return `${cleaned.slice(0, 5)}*******`;
    }
    return '*******';
  }
}

export function cnicMatches(stored: string | undefined, extracted: string | undefined): boolean {
  if (!stored?.trim() || !extracted?.trim()) return false;
  try {
    return normalizeCnic(stored) === normalizeCnic(extracted);
  } catch {
    return false;
  }
}

/** Last CNIC digit: odd = male, even = female (NADRA numbering structure). */
export function predictGenderFromCnic(raw: string): CnicGender | null {
  try {
    const digits = normalizeCnic(raw).replace(/\D/g, '');
    const last = Number(digits[digits.length - 1]);
    if (!Number.isFinite(last)) return null;
    return last % 2 === 1 ? 'male' : 'female';
  } catch {
    return null;
  }
}

export function resolveCnicIssuer(raw: string): CnicLocalDerivation | null {
  try {
    const normalized = normalizeCnic(raw);
    const prefix = normalized.slice(0, 5);
    const issuer = lookupCnicIssuer(prefix);
    const gender = predictGenderFromCnic(normalized);
    if (!issuer || !gender) return null;
    return { ...issuer, gender, issuerPrefix: prefix };
  } catch {
    return null;
  }
}

export function parseFlexibleDate(raw: string | undefined): Date | null {
  if (!raw?.trim()) return null;
  const value = raw.trim();
  const iso = Date.parse(value);
  if (!Number.isNaN(iso)) return new Date(iso);
  const dmy = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]) - 1;
    let year = Number(dmy[3]);
    if (year < 100) year += year >= 50 ? 1900 : 2000;
    const date = new Date(year, month, day);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

export function computeAgeFromDob(dob: string | Date | undefined): CnicAgeInfo | null {
  const date = dob instanceof Date ? dob : parseFlexibleDate(typeof dob === 'string' ? dob : undefined);
  if (!date) return null;
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) {
    age -= 1;
  }
  if (age < 0 || age > 120) return null;
  return { age, isAdult: age >= 18 };
}

export function isCnicExpired(expiryDate: string | Date | undefined): boolean | null {
  const date = expiryDate instanceof Date ? expiryDate : parseFlexibleDate(typeof expiryDate === 'string' ? expiryDate : undefined);
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today;
}
