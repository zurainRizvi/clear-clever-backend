import type { KycStatus, KycSource } from '../models/KycVerification';

export interface DemoKycRecord {
  userEmail: string;
  status: KycStatus;
  source: KycSource;
  /** ISO date string for verifiedAt backdating */
  daysAgoVerified?: number;
  extractedFullName?: string;
  extractedFatherName?: string;
  extractedDob?: string;
  extractedExpiryDate?: string;
  kycScore?: number;
  identityVerified?: boolean;
  nameMatch?: boolean;
  cnicMatch?: boolean;
  documentReadable?: boolean;
  cnicExpired?: boolean;
  age?: number;
  isAdult?: boolean;
  missingFields?: string[];
  suspiciousDocument?: boolean;
  croppedDocument?: boolean;
  blurScore?: 'Low' | 'Medium' | 'High';
  tamperingRisk?: 'Low' | 'Medium' | 'High';
}

/**
 * Realistic KYC seed aligned with seeded user CNICs and Pakistani demographics.
 */
export const DEMO_KYC: DemoKycRecord[] = [
  {
    userEmail: 'seeker@clearclever.com',
    status: 'verified',
    source: 'upload',
    daysAgoVerified: 27,
    extractedFullName: 'Ayesha Khan',
    extractedFatherName: 'Muhammad Khan',
    extractedDob: '15-03-1995',
    extractedExpiryDate: '15-03-2030',
    kycScore: 96,
    identityVerified: true,
    nameMatch: true,
    cnicMatch: true,
    documentReadable: true,
    cnicExpired: false,
    age: 31,
    isAdult: true,
    blurScore: 'Low',
    tamperingRisk: 'Low',
    missingFields: [],
  },
  {
    userEmail: 'syedzurainrizvi@gmail.com',
    status: 'verified',
    source: 'upload',
    daysAgoVerified: 20,
    extractedFullName: 'Zurain Rizvi',
    extractedFatherName: 'Syed Rizvi',
    extractedDob: '22-08-1998',
    extractedExpiryDate: '22-08-2033',
    kycScore: 98,
    identityVerified: true,
    nameMatch: true,
    cnicMatch: true,
    documentReadable: true,
    cnicExpired: false,
    age: 27,
    isAdult: true,
    blurScore: 'Low',
    tamperingRisk: 'Low',
    missingFields: [],
  },
  {
    userEmail: 'fatima.ali@clearclever.com',
    status: 'verified',
    source: 'upload',
    daysAgoVerified: 18,
    extractedFullName: 'Fatima Ali',
    extractedFatherName: 'Ali Hassan',
    extractedDob: '10-11-1992',
    extractedExpiryDate: '10-11-2027',
    kycScore: 94,
    identityVerified: true,
    nameMatch: true,
    cnicMatch: true,
    documentReadable: true,
    cnicExpired: false,
    age: 33,
    isAdult: true,
    blurScore: 'Low',
    tamperingRisk: 'Low',
    missingFields: [],
  },
  {
    userEmail: 'hassan.raza@clearclever.com',
    status: 'partial',
    source: 'manual',
    daysAgoVerified: 14,
    kycScore: undefined,
    documentReadable: undefined,
    age: undefined,
    missingFields: ['dob', 'expiryDate'],
  },
  {
    userEmail: 'sana.mirza@clearclever.com',
    status: 'verified',
    source: 'upload',
    daysAgoVerified: 12,
    extractedFullName: 'Sana Mirza',
    extractedFatherName: 'Mirza Ahmed',
    extractedDob: '05-06-2000',
    extractedExpiryDate: '05-06-2035',
    kycScore: 92,
    identityVerified: true,
    nameMatch: true,
    cnicMatch: true,
    documentReadable: true,
    cnicExpired: false,
    age: 25,
    isAdult: true,
    blurScore: 'Medium',
    tamperingRisk: 'Low',
    missingFields: [],
  },
  {
    userEmail: 'usman.khan@clearclever.com',
    status: 'partial',
    source: 'manual',
    daysAgoVerified: 9,
    missingFields: ['dob', 'expiryDate', 'fullName'],
  },
  {
    userEmail: 'nadia.sheikh@clearclever.com',
    status: 'verified',
    source: 'upload',
    daysAgoVerified: 7,
    extractedFullName: 'Nadia Sheikh',
    extractedFatherName: 'Sheikh Tariq',
    extractedDob: '18-01-1988',
    extractedExpiryDate: '18-01-2023',
    kycScore: 78,
    identityVerified: false,
    nameMatch: true,
    cnicMatch: true,
    documentReadable: true,
    cnicExpired: true,
    age: 38,
    isAdult: true,
    blurScore: 'Low',
    tamperingRisk: 'Low',
    missingFields: [],
  },
  {
    userEmail: 'bilal.ahmed@clearclever.com',
    status: 'failed',
    source: 'upload',
    daysAgoVerified: 5,
    kycScore: 35,
    identityVerified: false,
    nameMatch: false,
    cnicMatch: false,
    documentReadable: false,
    suspiciousDocument: true,
    croppedDocument: true,
    blurScore: 'High',
    tamperingRisk: 'Medium',
    missingFields: ['cnicNumber', 'dob', 'expiryDate', 'fullName'],
  },
];
