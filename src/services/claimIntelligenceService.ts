import { loadEnv } from '../config/env';
import type { ClaimType } from '../models/ClaimRequest';
import { InsurerProfile } from '../models/InsurerProfile';
import { Policy } from '../models/Policy';
import { Purchase } from '../models/Purchase';
import type { IUserDocument } from '../models/User';
import type {
  ClaimIntelligenceAnalysisType,
  ClaimIntelligenceReport,
  ConsistencyLevel,
  DamageSeverity,
  ExpiryStatus,
  GeminiClaimIntelligenceRaw,
  InsurerRecommendation,
  MedicalComplexity,
  RepairComplexity,
} from '../types/claimIntelligence';
import {
  CLAIM_INTELLIGENCE_ANALYSIS_TYPES,
  CONSISTENCY_LEVELS,
  DAMAGE_SEVERITIES,
  EXPIRY_STATUSES,
  MEDICAL_COMPLEXITIES,
  REPAIR_COMPLEXITIES,
} from '../types/claimIntelligence';
import { AppError } from '../utils/apiResponse';
import { namesMatch } from './identityVerificationService';
import { cnicMatches, maskCnic } from '../utils/cnic';
import {
  attachmentsToGeminiParts,
  parseAttachments,
  type AssistantAttachmentInput,
} from './assistantAttachments';
import {
  buildClaimIntelligenceUserMessage,
  CLAIM_INTELLIGENCE_GEMINI_SCHEMA,
  CLAIM_INTELLIGENCE_SYSTEM_INSTRUCTION,
} from './claimIntelligencePrompts';
import { generateStructuredJson } from './geminiService';
import { assessClaimPolicyAlignment } from './claimCategoryAlignment';
import {
  hasCnicAttachment,
  hasPolicyAttachment,
} from './claimAttachmentService';

export interface AnalyzeClaimIntelligenceInput {
  user: IUserDocument;
  purchaseId: string;
  claimType: ClaimType;
  description: string;
  estimatedAmountPkr?: number;
  incidentDate?: string;
  attachments: unknown;
}

function pickEnum<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  if (value && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  return fallback;
}

function pickAnalysisTypes(raw: string[] | undefined): ClaimIntelligenceAnalysisType[] {
  if (!raw?.length) return ['general'];
  const valid = raw.filter((t): t is ClaimIntelligenceAnalysisType =>
    (CLAIM_INTELLIGENCE_ANALYSIS_TYPES as readonly string[]).includes(t)
  );
  return valid.length > 0 ? valid : ['general'];
}

function expectedPolicyNumber(purchaseId: string): string {
  return `CC-${purchaseId.slice(-8).toUpperCase()}`;
}

function normalizePolicyNumber(value: string): string {
  return value.replace(/\s/g, '').toUpperCase();
}

function policyNumbersMatch(expected: string, extracted: string | undefined): boolean {
  if (!extracted?.trim()) return false;
  const normExpected = normalizePolicyNumber(expected);
  const normExtracted = normalizePolicyNumber(extracted);
  return normExpected === normExtracted || normExtracted.includes(normExpected.slice(-8));
}

function insurerNamesMatch(expected: string, extracted: string | undefined): boolean {
  if (!extracted?.trim()) return false;
  const a = expected.toLowerCase();
  const b = extracted.toLowerCase();
  return a.includes(b) || b.includes(a);
}

function photosUnclear(flags: string[]): boolean {
  const lower = flags.map((f) => f.toLowerCase());
  return lower.some(
    (f) =>
      f.includes('image quality') ||
      f.includes('partially hidden') ||
      f.includes('too low') ||
      f.includes('unreadable') ||
      f.includes('blurry')
  );
}

export function computeClaimReadiness(input: {
  attachmentCount: number;
  suspiciousFlags: string[];
  consistencyLevel: ConsistencyLevel;
  identityMatch?: boolean;
  policyMatch?: boolean;
  policyCategoryAligned?: boolean;
  cnicDocumentUploaded?: boolean;
}): ClaimIntelligenceReport['claimReadiness'] {
  const documentsComplete =
    input.attachmentCount >= 1 && Boolean(input.cnicDocumentUploaded);
  const photosClear = !photosUnclear(input.suspiciousFlags);
  const informationConsistent =
    input.consistencyLevel !== 'low' && input.policyCategoryAligned !== false;
  const identityOk = input.identityMatch !== false;
  const policyOk = input.policyMatch !== false;
  const noMajorIssues =
    identityOk && policyOk && input.policyCategoryAligned !== false && input.suspiciousFlags.length < 2;

  const checks = [documentsComplete, photosClear, informationConsistent, noMajorIssues];
  const score = checks.filter(Boolean).length * 25;

  return {
    score,
    documentsComplete,
    photosClear,
    informationConsistent,
    noMajorIssues,
  };
}

export function buildApprovalImprovements(input: {
  userHasCnic: boolean;
  cnicDocumentUploaded: boolean;
  cnicVerified: boolean;
  identity?: ClaimIntelligenceReport['identity'];
  claimReadiness: ClaimIntelligenceReport['claimReadiness'];
  policyAlignment: ClaimIntelligenceReport['policyAlignment'];
  policyDoc?: ClaimIntelligenceReport['policyDoc'];
  missingItems: string[];
}): string[] {
  const suggestions: string[] = [];

  if (!input.userHasCnic) {
    suggestions.push(
      'Add your CNIC to your ClearClever profile (Settings) — insurers expect a registered identity on file.'
    );
  }
  if (!input.cnicDocumentUploaded) {
    suggestions.push(
      'Upload a clear, well-lit photo of your CNIC alongside your damage or incident evidence.'
    );
  } else if (!input.cnicVerified && input.identity) {
    if (input.identity.expiryStatus === 'expired') {
      suggestions.push('Your CNIC appears expired — renew it and upload the updated card.');
    } else if (!input.identity.matchesCnic) {
      suggestions.push(
        'Use a CNIC that matches your profile number, or update your profile CNIC in Settings.'
      );
    } else if (!input.identity.matchesName) {
      suggestions.push('Ensure the name on your CNIC matches your account name exactly.');
    } else {
      suggestions.push('Re-upload a sharper CNIC photo so identity can be verified automatically.');
    }
  }

  if (!input.policyAlignment.matchesPolicyCategory) {
    suggestions.push(
      'Confirm you selected the right claim type for your policy category, or adjust your description to match coverage.'
    );
  }

  if (!input.claimReadiness.documentsComplete) {
    suggestions.push('Include all key documents insurers typically need (CNIC, policy copy, and incident proof).');
  }
  if (!input.claimReadiness.photosClear) {
    suggestions.push(
      'Upload brighter, in-focus photos — blurry or dark images lower approval confidence.'
    );
  }
  if (!input.claimReadiness.informationConsistent) {
    suggestions.push(
      'Align your written description with what is visible in photos (location, damage type, and timeline).'
    );
  }
  if (!input.claimReadiness.noMajorIssues) {
    suggestions.push('Resolve flagged identity, policy, or consistency issues highlighted in this report.');
  }

  if (input.policyDoc && !input.policyDoc.matchesLinkedPolicy) {
    suggestions.push('Upload a policy document that matches your linked ClearClever policy number and insurer.');
  }

  for (const item of input.missingItems) {
    if (!suggestions.some((s) => s.toLowerCase().includes(item.slice(0, 24).toLowerCase()))) {
      suggestions.push(item);
    }
  }

  return [...new Set(suggestions)].slice(0, 8);
}

export function computeInsurerRecommendation(input: {
  consistencyLevel: ConsistencyLevel;
  readinessScore: number;
  suspiciousFlags: string[];
  identityMatch?: boolean;
  policyMatch?: boolean;
  policyCategoryAligned?: boolean;
}): InsurerRecommendation {
  const failedDocMatch =
    input.identityMatch === false ||
    input.policyMatch === false ||
    input.policyCategoryAligned === false;

  if (
    input.consistencyLevel === 'low' ||
    input.readinessScore < 60 ||
    input.suspiciousFlags.length >= 2 ||
    input.policyCategoryAligned === false
  ) {
    return 'escalate_review';
  }
  if (input.readinessScore < 85 || failedDocMatch) {
    return 'manual_review';
  }
  return 'standard_review';
}

function buildExecutiveSummaryFallback(report: Omit<ClaimIntelligenceReport, 'executiveSummary'>): string {
  const parts: string[] = [];
  if (report.vehicle) {
    parts.push(
      `Vehicle damage appears ${report.vehicle.severity}. Estimated repair cost ranges from PKR ${report.vehicle.estimatedCostMinPkr.toLocaleString('en-PK')} to PKR ${report.vehicle.estimatedCostMaxPkr.toLocaleString('en-PK')}.`
    );
  }
  if (report.identity?.matchesUserProfile) {
    parts.push('Identity document matches the registered account holder (name and CNIC).');
  } else if (report.identity && !report.identity.matchesUserProfile) {
    parts.push('Identity document does not fully match the registered account holder.');
  }
  if (report.policyDoc?.matchesLinkedPolicy) {
    parts.push('Uploaded policy document matches the linked policy.');
  }
  if (report.consistency.level === 'low') {
    parts.push(`Consistency concern: ${report.consistency.reason}`);
  } else if (report.suspiciousFlags.length === 0) {
    parts.push('No major inconsistencies detected between claim description and uploaded evidence.');
  }
  return parts.join(' ') || 'AI-assisted claim evidence review completed.';
}

function normalizeGeminiRaw(
  raw: GeminiClaimIntelligenceRaw,
  attachments: AssistantAttachmentInput[]
): GeminiClaimIntelligenceRaw {
  const cnicUploaded = hasCnicAttachment(attachments);
  const policyUploaded = hasPolicyAttachment(attachments);

  const analysisTypes = (raw.analysisTypes ?? []).filter((type) => {
    if (type === 'policy' && !policyUploaded) return false;
    if (type === 'identity' && !cnicUploaded && !raw.identity?.extractedCnic) return false;
    return true;
  });

  const normalized: GeminiClaimIntelligenceRaw = {
    ...raw,
    analysisTypes: analysisTypes.length > 0 ? analysisTypes : ['general'],
    consistency: {
      level: raw.consistency?.level,
      reason: raw.consistency?.reason?.trim() || 'Evidence reviewed against claim description.',
    },
    suspiciousFlags: raw.suspiciousFlags ?? [],
    executiveSummary: raw.executiveSummary?.trim() || '',
  };

  if (!policyUploaded) {
    delete normalized.policyDoc;
  }
  if (!cnicUploaded && !raw.identity?.extractedCnic) {
    delete normalized.identity;
  }

  return normalized;
}

export function enrichClaimIntelligenceReport(input: {
  raw: GeminiClaimIntelligenceRaw;
  user: IUserDocument;
  purchaseId: string;
  claimType: ClaimType;
  policyName?: string;
  policyCategory?: string;
  insurerName?: string;
  estimatedAmountPkr?: number;
  attachments: AssistantAttachmentInput[];
  modelVersion: string;
}): ClaimIntelligenceReport {
  const raw = normalizeGeminiRaw(input.raw, input.attachments);
  const suspiciousFlags = (input.raw.suspiciousFlags ?? []).slice(0, 10);
  const consistencyLevel = pickEnum(input.raw.consistency?.level, CONSISTENCY_LEVELS, 'medium');
  const consistencyReason =
    input.raw.consistency?.reason?.trim() || 'No major inconsistencies noted.';

  const rawExtractedCnic = input.raw.identity?.extractedCnic?.trim();

  let identity = input.raw.identity
    ? {
        documentType: input.raw.identity.documentType?.trim() || 'CNIC',
        extractedName: input.raw.identity.extractedName?.trim(),
        extractedCnic: rawExtractedCnic ? maskCnic(rawExtractedCnic) : undefined,
        expiryStatus: pickEnum(
          input.raw.identity.expiryStatus,
          EXPIRY_STATUSES,
          'unknown' as ExpiryStatus
        ),
        matchesName: false,
        matchesCnic: false,
        matchesUserProfile: false,
        profileMatchReason: 'Identity document could not be verified against this account.',
      }
    : undefined;

  if (identity) {
    const nameMatched = identity.extractedName
      ? namesMatch(input.user.fullName, identity.extractedName)
      : false;
    const cnicMatched = rawExtractedCnic
      ? cnicMatches(input.user.cnic, rawExtractedCnic)
      : false;

    if (!input.user.cnic) {
      suspiciousFlags.push('Account has no registered CNIC on file.');
    } else if (!rawExtractedCnic) {
      suspiciousFlags.push('CNIC number could not be read from the uploaded identity document.');
    } else if (!cnicMatched) {
      suspiciousFlags.push('CNIC on document does not match the CNIC registered on this account.');
    }

    if (identity.extractedName && !nameMatched) {
      suspiciousFlags.push(
        `Name on document ("${identity.extractedName}") does not match account holder "${input.user.fullName}".`
      );
    }

    const accountVerified = Boolean(input.user.cnic) && nameMatched && cnicMatched;
    const reasons: string[] = [];
    if (nameMatched) {
      reasons.push(`Name matches account holder "${input.user.fullName}".`);
    } else if (identity.extractedName) {
      reasons.push(`Name on document does not match account holder "${input.user.fullName}".`);
    } else {
      reasons.push('Name could not be read from the identity document.');
    }
    if (!input.user.cnic) {
      reasons.push('No CNIC registered on this account.');
    } else if (cnicMatched) {
      reasons.push('CNIC matches the number registered on this account.');
    } else if (rawExtractedCnic) {
      reasons.push('CNIC on document does not match the registered CNIC.');
    } else {
      reasons.push('CNIC could not be read from the identity document.');
    }

    identity = {
      ...identity,
      matchesName: nameMatched,
      matchesCnic: cnicMatched,
      matchesUserProfile: accountVerified,
      profileMatchReason: reasons.join(' '),
    };
  }

  const cnicDocumentUploaded = hasCnicAttachment(input.attachments) || Boolean(identity);
  if (!cnicDocumentUploaded) {
    suspiciousFlags.push(
      'CNIC not uploaded — add a clear photo of your CNIC to strengthen identity verification.'
    );
  } else if (input.user.cnic && !identity) {
    suspiciousFlags.push(
      'CNIC image uploaded but could not be read — upload a clearer photo of your CNIC.'
    );
  }

  const expectedNumber = expectedPolicyNumber(input.purchaseId);
  let policyDoc = input.raw.policyDoc
    ? {
        policyNumber: input.raw.policyDoc.policyNumber?.trim(),
        insurer: input.raw.policyDoc.insurer?.trim(),
        policyType: input.raw.policyDoc.policyType?.trim(),
        expiryDate: input.raw.policyDoc.expiryDate?.trim(),
        matchesLinkedPolicy: false,
        coverageAppearsValid: true,
        validationNotes: [] as string[],
      }
    : undefined;

  if (policyDoc) {
    const numberMatch = policyNumbersMatch(expectedNumber, policyDoc.policyNumber);
    const insurerMatch = insurerNamesMatch(input.insurerName ?? '', policyDoc.insurer);
    const typeMatch =
      !policyDoc.policyType ||
      !input.policyName ||
      policyDoc.policyType.toLowerCase().includes(input.policyCategory ?? '') ||
      policyDoc.policyType.toLowerCase().includes(input.policyName.toLowerCase());

    policyDoc.matchesLinkedPolicy = numberMatch && insurerMatch;
    policyDoc.coverageAppearsValid = typeMatch;
    if (!numberMatch) {
      policyDoc.validationNotes.push(
        `Policy number on document does not match expected ${expectedNumber}.`
      );
    }
    if (!insurerMatch && input.insurerName) {
      policyDoc.validationNotes.push(
        `Insurer on document does not match linked insurer ${input.insurerName}.`
      );
    }
    if (!typeMatch) {
      policyDoc.validationNotes.push('Policy type may not match the linked policy category.');
      policyDoc.coverageAppearsValid = false;
    }
  }

  let vehicle = input.raw.vehicle
    ? {
        severity: pickEnum(input.raw.vehicle.severity, DAMAGE_SEVERITIES, 'moderate' as DamageSeverity),
        severityConfidence: Math.min(
          100,
          Math.max(0, Math.round(input.raw.vehicle.severityConfidence ?? 70))
        ),
        damagedParts: (input.raw.vehicle.damagedParts ?? []).slice(0, 12),
        repairComplexity: pickEnum(
          input.raw.vehicle.repairComplexity,
          REPAIR_COMPLEXITIES,
          'medium' as RepairComplexity
        ),
        estimatedCostMinPkr: Math.max(0, Math.round(input.raw.vehicle.estimatedCostMinPkr ?? 0)),
        estimatedCostMaxPkr: Math.max(0, Math.round(input.raw.vehicle.estimatedCostMaxPkr ?? 0)),
      }
    : undefined;

  if (
    vehicle &&
    input.estimatedAmountPkr != null &&
    vehicle.estimatedCostMaxPkr > 0 &&
    input.estimatedAmountPkr > vehicle.estimatedCostMaxPkr * 2
  ) {
    suspiciousFlags.push(
      `Claimed amount PKR ${input.estimatedAmountPkr.toLocaleString('en-PK')} exceeds AI repair estimate by more than 2×.`
    );
  }

  const medical = input.raw.medical
    ? {
        diagnosis: input.raw.medical.diagnosis?.trim(),
        hospital: input.raw.medical.hospital?.trim(),
        treatmentType: input.raw.medical.treatmentType?.trim(),
        complexity: pickEnum(
          input.raw.medical.complexity,
          MEDICAL_COMPLEXITIES,
          'medium' as MedicalComplexity
        ),
      }
    : undefined;

  const analysisTypes = pickAnalysisTypes(raw.analysisTypes);
  const policyAlignment = assessClaimPolicyAlignment({
    claimType: input.claimType,
    policyCategory: input.policyCategory,
    analysisTypes,
  });

  if (!policyAlignment.matchesPolicyCategory) {
    suspiciousFlags.push(policyAlignment.reason);
  }

  const cnicVerified = Boolean(identity?.matchesUserProfile);
  const missingItems: string[] = [];
  if (!input.user.cnic?.trim()) {
    missingItems.push('No CNIC registered on your ClearClever profile.');
  }
  if (!cnicDocumentUploaded) {
    missingItems.push('CNIC photo not included in uploaded evidence.');
  } else if (!cnicVerified) {
    if (identity?.expiryStatus === 'expired') {
      missingItems.push('CNIC on upload appears expired.');
    } else if (identity && !identity.matchesCnic) {
      missingItems.push('CNIC on upload does not match your registered CNIC.');
    } else if (identity && !identity.matchesName) {
      missingItems.push('Name on CNIC does not match your account name.');
    } else {
      missingItems.push('CNIC could not be fully verified from the upload.');
    }
  }
  if (!policyAlignment.matchesPolicyCategory) {
    missingItems.push('Claim type may not align with your policy category.');
  }

  const submissionChecklist = {
    cnicDocumentUploaded,
    cnicVerified,
    readyToSubmit:
      cnicDocumentUploaded &&
      cnicVerified &&
      policyAlignment.matchesPolicyCategory &&
      missingItems.length === 0,
    missingItems,
  };

  const claimReadiness = computeClaimReadiness({
    attachmentCount: input.attachments.length,
    suspiciousFlags,
    consistencyLevel,
    identityMatch: identity?.matchesUserProfile,
    policyMatch: policyDoc?.matchesLinkedPolicy,
    policyCategoryAligned: policyAlignment.matchesPolicyCategory,
    cnicDocumentUploaded,
  });

  const insurerRecommendation = computeInsurerRecommendation({
    consistencyLevel,
    readinessScore: claimReadiness.score,
    suspiciousFlags,
    identityMatch: identity?.matchesUserProfile,
    policyMatch: policyDoc?.matchesLinkedPolicy,
    policyCategoryAligned: policyAlignment.matchesPolicyCategory,
  });

  const approvalImprovements = buildApprovalImprovements({
    userHasCnic: Boolean(input.user.cnic?.trim()),
    cnicDocumentUploaded,
    cnicVerified,
    identity,
    claimReadiness,
    policyAlignment,
    policyDoc,
    missingItems,
  });

  const base: Omit<ClaimIntelligenceReport, 'executiveSummary'> = {
    reportVersion: '1',
    analyzedAt: new Date().toISOString(),
    analysisTypes,
    attachmentSummary: {
      count: input.attachments.length,
      mimeTypes: input.attachments.map((a) => a.mimeType),
    },
    ...(vehicle ? { vehicle } : {}),
    ...(identity ? { identity } : {}),
    ...(policyDoc ? { policyDoc } : {}),
    ...(medical ? { medical } : {}),
    consistency: { level: consistencyLevel, reason: consistencyReason },
    suspiciousFlags,
    claimReadiness,
    policyAlignment,
    submissionChecklist,
    approvalImprovements,
    insurerRecommendation,
    modelVersion: input.modelVersion,
  };

  const executiveSummary =
    input.raw.executiveSummary?.trim() || buildExecutiveSummaryFallback(base);

  return { ...base, executiveSummary };
}

export async function analyzeClaimIntelligence(
  input: AnalyzeClaimIntelligenceInput
): Promise<ClaimIntelligenceReport> {
  const attachments = parseAttachments(input.attachments);
  if (attachments.length === 0) {
    throw new AppError(400, 'Validation failed', [
      'At least one attachment is required for AI Claims Intelligence analysis',
    ]);
  }

  const purchase = await Purchase.findOne({
    _id: input.purchaseId,
    userId: input.user._id,
    status: 'completed',
  });
  if (!purchase) {
    throw new AppError(400, 'Claims can only be analyzed for your completed purchases');
  }

  const [policy, insurer] = await Promise.all([
    Policy.findById(purchase.policyId),
    InsurerProfile.findById(purchase.insurerProfileId),
  ]);

  const env = loadEnv();
  const modelVersion = env.GEMINI_MODEL ?? 'gemini-2.5-flash';

  const userMessage = buildClaimIntelligenceUserMessage({
    claimType: input.claimType,
    description: input.description,
    estimatedAmountPkr: input.estimatedAmountPkr,
    incidentDate: input.incidentDate,
    policyName: policy?.name,
    policyCategory: policy?.category,
    insurerName: insurer?.companyName,
    expectedPolicyNumber: expectedPolicyNumber(String(purchase._id)),
    userFullName: input.user.fullName,
    attachmentNames: attachments.map((a) => `${a.fileName} (${a.mimeType})`),
  });

  const raw = await generateStructuredJson<GeminiClaimIntelligenceRaw>({
    systemInstruction: CLAIM_INTELLIGENCE_SYSTEM_INSTRUCTION,
    userMessage,
    attachmentParts: attachmentsToGeminiParts(attachments),
    responseSchema: CLAIM_INTELLIGENCE_GEMINI_SCHEMA as unknown as Record<string, unknown>,
    usageRoute: 'claim_intelligence',
    env,
  });

  return enrichClaimIntelligenceReport({
    raw,
    user: input.user,
    purchaseId: String(purchase._id),
    claimType: input.claimType,
    policyName: policy?.name,
    policyCategory: policy?.category,
    insurerName: insurer?.companyName,
    estimatedAmountPkr: input.estimatedAmountPkr,
    attachments,
    modelVersion,
  });
}

/** Validate and sanitize a client-submitted report snapshot before persistence. */
export function sanitizeIntelligenceReportForStorage(
  report: unknown
): ClaimIntelligenceReport | undefined {
  if (!report || typeof report !== 'object') return undefined;

  const r = report as Partial<ClaimIntelligenceReport>;
  if (r.reportVersion !== '1' || !r.analyzedAt || !r.executiveSummary) {
    return undefined;
  }

  return {
    reportVersion: '1',
    analyzedAt: String(r.analyzedAt),
    analysisTypes: pickAnalysisTypes(r.analysisTypes as string[] | undefined),
    attachmentSummary: {
      count: Math.min(3, Math.max(0, r.attachmentSummary?.count ?? 0)),
      mimeTypes: (r.attachmentSummary?.mimeTypes ?? []).slice(0, 3),
    },
    ...(r.vehicle
      ? {
          vehicle: {
            severity: pickEnum(r.vehicle.severity, DAMAGE_SEVERITIES, 'moderate'),
            severityConfidence: Math.min(100, Math.max(0, r.vehicle.severityConfidence ?? 0)),
            damagedParts: (r.vehicle.damagedParts ?? []).slice(0, 12),
            repairComplexity: pickEnum(r.vehicle.repairComplexity, REPAIR_COMPLEXITIES, 'medium'),
            estimatedCostMinPkr: Math.max(0, r.vehicle.estimatedCostMinPkr ?? 0),
            estimatedCostMaxPkr: Math.max(0, r.vehicle.estimatedCostMaxPkr ?? 0),
          },
        }
      : {}),
    ...(r.identity
      ? {
          identity: {
            documentType: String(r.identity.documentType ?? 'CNIC').slice(0, 80),
            extractedName: r.identity.extractedName?.slice(0, 120),
            extractedCnic: r.identity.extractedCnic?.slice(0, 20),
            expiryStatus: r.identity.expiryStatus
              ? pickEnum(r.identity.expiryStatus, EXPIRY_STATUSES, 'unknown')
              : undefined,
            matchesName: Boolean(r.identity.matchesName),
            matchesCnic: Boolean(r.identity.matchesCnic),
            matchesUserProfile: Boolean(r.identity.matchesUserProfile),
            profileMatchReason: String(r.identity.profileMatchReason ?? '').slice(0, 500),
          },
        }
      : {}),
    ...(r.policyDoc
      ? {
          policyDoc: {
            policyNumber: r.policyDoc.policyNumber?.slice(0, 80),
            insurer: r.policyDoc.insurer?.slice(0, 120),
            policyType: r.policyDoc.policyType?.slice(0, 120),
            expiryDate: r.policyDoc.expiryDate?.slice(0, 40),
            matchesLinkedPolicy: Boolean(r.policyDoc.matchesLinkedPolicy),
            coverageAppearsValid: Boolean(r.policyDoc.coverageAppearsValid),
            validationNotes: (r.policyDoc.validationNotes ?? []).slice(0, 8).map(String),
          },
        }
      : {}),
    ...(r.medical
      ? {
          medical: {
            diagnosis: r.medical.diagnosis?.slice(0, 200),
            hospital: r.medical.hospital?.slice(0, 120),
            treatmentType: r.medical.treatmentType?.slice(0, 120),
            complexity: pickEnum(r.medical.complexity, MEDICAL_COMPLEXITIES, 'medium'),
          },
        }
      : {}),
    consistency: {
      level: pickEnum(r.consistency?.level, CONSISTENCY_LEVELS, 'medium'),
      reason: String(r.consistency?.reason ?? '').slice(0, 500),
    },
    suspiciousFlags: (r.suspiciousFlags ?? []).slice(0, 10).map(String),
    claimReadiness: {
      score: Math.min(100, Math.max(0, r.claimReadiness?.score ?? 0)),
      documentsComplete: Boolean(r.claimReadiness?.documentsComplete),
      photosClear: Boolean(r.claimReadiness?.photosClear),
      informationConsistent: Boolean(r.claimReadiness?.informationConsistent),
      noMajorIssues: Boolean(r.claimReadiness?.noMajorIssues),
    },
    policyAlignment: {
      matchesPolicyCategory: r.policyAlignment?.matchesPolicyCategory !== false,
      reason: String(
        r.policyAlignment?.reason ?? 'Policy alignment was not re-evaluated on this snapshot.'
      ).slice(0, 500),
    },
    submissionChecklist: {
      cnicDocumentUploaded: Boolean(r.submissionChecklist?.cnicDocumentUploaded),
      cnicVerified: Boolean(r.submissionChecklist?.cnicVerified),
      readyToSubmit: Boolean(r.submissionChecklist?.readyToSubmit),
      missingItems: (r.submissionChecklist?.missingItems ?? []).slice(0, 8).map(String),
    },
    approvalImprovements: (r.approvalImprovements ?? r.submissionChecklist?.missingItems ?? [])
      .slice(0, 8)
      .map(String),
    executiveSummary: String(r.executiveSummary).slice(0, 2000),
    insurerRecommendation: pickEnum(
      r.insurerRecommendation,
      ['standard_review', 'manual_review', 'escalate_review'] as const,
      'manual_review'
    ),
    modelVersion: String(r.modelVersion ?? 'unknown').slice(0, 80),
  };
}
