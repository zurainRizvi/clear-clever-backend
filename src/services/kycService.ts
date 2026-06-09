import { loadEnv, isGeminiConfigured } from '../config/env';
import type { IKycVerificationDocument, KycStatus } from '../models/KycVerification';
import { KycVerification } from '../models/KycVerification';
import type { IUserDocument } from '../models/User';
import { AppError } from '../utils/apiResponse';
import { maskCnic, normalizeCnic } from '../utils/cnic';
import {
  attachmentsToGeminiParts,
  parseAttachments,
  type AssistantAttachmentInput,
} from './assistantAttachments';
import {
  deriveAgeFromDob,
  deriveExpiryStatus,
  deriveLocalFromCnic,
} from './cnicDerivationService';
import { generateStructuredJson } from './geminiService';
import { computeIdentityMatchScore } from './identityVerificationService';
import {
  buildKycUserMessage,
  KYC_GEMINI_SCHEMA,
  KYC_SYSTEM_INSTRUCTION,
  type GeminiKycRaw,
} from './kycPrompts';

export interface KycReportPayload {
  status: KycStatus;
  source: 'manual' | 'upload';
  cnicMasked?: string;
  kycScore?: number;
  identityMatchScore?: number;
  identityVerified?: boolean;
  nameMatch?: boolean;
  cnicMatch?: boolean;
  profileMatchesDocument?: boolean;
  documentReadable?: boolean;
  cnicExpired?: boolean;
  genderPredicted?: 'male' | 'female';
  province?: string;
  district?: string;
  regionSlug?: string;
  age?: number;
  isAdult?: boolean;
  extractedFullName?: string;
  extractedFatherName?: string;
  extractedDob?: string;
  extractedExpiryDate?: string;
  missingFields: string[];
  suspiciousDocument?: boolean;
  croppedDocument?: boolean;
  blurScore?: 'Low' | 'Medium' | 'High';
  tamperingRisk?: 'Low' | 'Medium' | 'High';
  verifiedAt?: string;
}

function pickBlurScore(value: string | undefined): 'Low' | 'Medium' | 'High' {
  if (value === 'Medium' || value === 'High') return value;
  return 'Low';
}

function pickTamperingRisk(value: string | undefined): 'Low' | 'Medium' | 'High' {
  if (value === 'Medium' || value === 'High') return value;
  return 'Low';
}

function toKycReport(doc: IKycVerificationDocument | null): KycReportPayload {
  if (!doc) {
    return { status: 'none', source: 'manual', missingFields: [] };
  }
  return {
    status: doc.status,
    source: doc.source,
    cnicMasked: doc.cnicMasked,
    kycScore: doc.kycScore,
    identityMatchScore: doc.identityMatchScore,
    identityVerified: doc.identityVerified,
    nameMatch: doc.nameMatch,
    cnicMatch: doc.cnicMatch,
    profileMatchesDocument: doc.profileMatchesDocument,
    documentReadable: doc.documentReadable,
    cnicExpired: doc.cnicExpired,
    genderPredicted: doc.genderPredicted,
    province: doc.province,
    district: doc.district,
    regionSlug: doc.regionSlug,
    age: doc.age,
    isAdult: doc.isAdult,
    extractedFullName: doc.extractedFullName,
    extractedFatherName: doc.extractedFatherName,
    extractedDob: doc.extractedDob,
    extractedExpiryDate: doc.extractedExpiryDate,
    missingFields: doc.missingFields ?? [],
    suspiciousDocument: doc.suspiciousDocument,
    croppedDocument: doc.croppedDocument,
    blurScore: doc.blurScore,
    tamperingRisk: doc.tamperingRisk,
    verifiedAt: doc.verifiedAt?.toISOString(),
  };
}

async function upsertKycRecord(
  userId: IUserDocument['_id'],
  data: Partial<IKycVerificationDocument>
): Promise<IKycVerificationDocument> {
  const existing = await KycVerification.findOne({ userId }).sort({ verifiedAt: -1, updatedAt: -1 });
  if (existing) {
    Object.assign(existing, data);
    await existing.save();
    return existing;
  }
  return KycVerification.create({ userId, ...data });
}

export async function deriveFromCnic(user: IUserDocument, rawCnic?: string): Promise<KycReportPayload> {
  const cnic = rawCnic?.trim() ? normalizeCnic(rawCnic) : user.cnic;
  if (!cnic) {
    throw new AppError(400, 'CNIC is required for local derivation');
  }

  const local = deriveLocalFromCnic(cnic);
  if (!local) {
    throw new AppError(400, 'Could not derive region from CNIC issuer code', [
      'The first 5 digits do not match a known Pakistani issuer code.',
    ]);
  }

  const doc = await upsertKycRecord(user._id, {
    cnicMasked: local.cnicMasked,
    status: 'partial',
    source: 'manual',
    genderPredicted: local.genderPredicted,
    province: local.province,
    district: local.district,
    regionSlug: local.regionSlug,
    verifiedAt: new Date(),
  });

  return toKycReport(doc);
}

export async function verifyCnicDocument(
  user: IUserDocument,
  attachments: unknown
): Promise<KycReportPayload> {
  const env = loadEnv();
  if (!isGeminiConfigured(env)) {
    throw new AppError(503, 'AI KYC verification is not configured (GEMINI_API_KEY missing)');
  }
  if (!user.cnic?.trim()) {
    throw new AppError(400, 'Add your CNIC to your profile before uploading a document');
  }

  const parsed: AssistantAttachmentInput[] = parseAttachments(attachments);
  if (parsed.length === 0) {
    throw new AppError(400, 'Validation failed', ['attachment: CNIC image is required']);
  }

  const local = deriveLocalFromCnic(user.cnic);
  const attachmentParts = attachmentsToGeminiParts(parsed);

  const raw = await generateStructuredJson<GeminiKycRaw>({
    systemInstruction: KYC_SYSTEM_INSTRUCTION,
    userMessage: buildKycUserMessage({
      profileName: user.fullName,
      profileCnicMasked: maskCnic(user.cnic),
    }),
    attachmentParts,
    responseSchema: KYC_GEMINI_SCHEMA as unknown as Record<string, unknown>,
    usageRoute: 'kyc',
    env,
  });

  const documentReadable = Boolean(raw.documentReadable);
  const cnicExpired = deriveExpiryStatus(raw.expiryDate);
  const ageInfo = deriveAgeFromDob(raw.dob);

  const match = computeIdentityMatchScore({
    profileName: user.fullName,
    profileCnic: user.cnic,
    extractedName: raw.fullName,
    extractedCnic: raw.cnicNumber,
    documentReadable,
    cnicExpired: cnicExpired ?? null,
    suspiciousDocument: Boolean(raw.suspiciousDocument),
    croppedDocument: Boolean(raw.croppedDocument),
    blurScore: pickBlurScore(raw.blurScore),
  });

  let status: KycStatus = 'failed';
  if (match.identityVerified) status = 'verified';
  else if (documentReadable) status = 'partial';

  const doc = await upsertKycRecord(user._id, {
    cnicMasked: maskCnic(user.cnic),
    status,
    source: 'upload',
    genderPredicted: local?.genderPredicted,
    province: local?.province,
    district: local?.district,
    regionSlug: local?.regionSlug,
    extractedFullName: raw.fullName?.trim(),
    extractedFatherName: raw.fatherName?.trim(),
    extractedDob: raw.dob?.trim(),
    extractedIssueDate: raw.issueDate?.trim(),
    extractedExpiryDate: raw.expiryDate?.trim(),
    extractedGender: raw.gender?.trim(),
    age: ageInfo.age,
    isAdult: ageInfo.isAdult,
    cnicExpired: cnicExpired ?? undefined,
    kycScore: match.kycScore,
    identityMatchScore: match.identityMatchScore,
    nameMatch: match.nameMatch,
    cnicMatch: match.cnicMatch,
    profileMatchesDocument: match.profileMatchesDocument,
    documentReadable,
    identityVerified: match.identityVerified,
    missingFields: raw.missingFields ?? [],
    suspiciousDocument: raw.suspiciousDocument,
    croppedDocument: raw.croppedDocument,
    blurScore: pickBlurScore(raw.blurScore),
    tamperingRisk: pickTamperingRisk(raw.tamperingRisk),
    verifiedAt: new Date(),
    geminiModel: env.GEMINI_MODEL,
  });

  return toKycReport(doc);
}

export async function getKycStatus(userId: IUserDocument['_id']): Promise<KycReportPayload> {
  const doc = await KycVerification.findOne({ userId }).sort({ verifiedAt: -1, updatedAt: -1 });
  return toKycReport(doc);
}

export async function getKycSummaryForAuth(userId: IUserDocument['_id']): Promise<{
  kycStatus: KycStatus;
  kycScore?: number;
  kycSummary?: {
    gender?: 'male' | 'female';
    province?: string;
    district?: string;
    isAdult?: boolean;
    cnicExpired?: boolean;
    identityVerified?: boolean;
  };
}> {
  const doc = await KycVerification.findOne({ userId }).sort({ verifiedAt: -1, updatedAt: -1 });
  if (!doc) return { kycStatus: 'none' };
  return {
    kycStatus: doc.status,
    kycScore: doc.kycScore,
    kycSummary: {
      gender: doc.genderPredicted,
      province: doc.province,
      district: doc.district,
      isAdult: doc.isAdult,
      cnicExpired: doc.cnicExpired,
      identityVerified: doc.identityVerified,
    },
  };
}

export async function getLatestKycByUserIds(
  userIds: string[]
): Promise<Map<string, IKycVerificationDocument>> {
  const docs = await KycVerification.find({ userId: { $in: userIds } }).sort({
    verifiedAt: -1,
    updatedAt: -1,
  });
  const map = new Map<string, IKycVerificationDocument>();
  for (const doc of docs) {
    const key = String(doc.userId);
    if (!map.has(key)) map.set(key, doc);
  }
  return map;
}
