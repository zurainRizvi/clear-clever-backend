import type { ClaimIntelligenceReport } from '../types/claimIntelligence';
import type { ClaimStoredAttachment } from '../models/ClaimRequest';

/** 1×1 PNG — lightweight placeholder for demo media in DB. */
export const DEMO_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export const DEMO_CNIC_PREVIEW_BASE64 = DEMO_PNG_BASE64;

export function demoImageAttachment(fileName: string): ClaimStoredAttachment {
  return {
    fileName,
    mimeType: 'image/png',
    dataBase64: DEMO_PNG_BASE64,
    uploadedAt: new Date().toISOString(),
  };
}

export function demoMessageAttachment(fileName: string): {
  fileName: string;
  mimeType: string;
  dataUrl: string;
} {
  return {
    fileName,
    mimeType: 'image/png',
    dataUrl: `data:image/png;base64,${DEMO_PNG_BASE64}`,
  };
}

function baseReport(
  partial: Partial<ClaimIntelligenceReport> & Pick<ClaimIntelligenceReport, 'executiveSummary' | 'analysisTypes'>
): ClaimIntelligenceReport {
  return {
    reportVersion: '1',
    analyzedAt: new Date().toISOString(),
    attachmentSummary: { count: 1, mimeTypes: ['image/png'] },
    consistency: { level: 'medium', reason: 'Evidence aligns with the claim description overall.' },
    suspiciousFlags: [],
    claimReadiness: {
      score: 82,
      documentsComplete: true,
      photosClear: true,
      informationConsistent: true,
      noMajorIssues: true,
    },
    policyAlignment: {
      matchesPolicyCategory: true,
      reason: 'Claim type matches the linked policy category.',
    },
    submissionChecklist: {
      cnicDocumentUploaded: true,
      cnicVerified: true,
      readyToSubmit: true,
      missingItems: [],
    },
    approvalImprovements: [],
    insurerRecommendation: 'standard_review',
    modelVersion: 'gemini-demo-seed',
    ...partial,
  };
}

export function demoHomeClaimReport(): ClaimIntelligenceReport {
  return baseReport({
    analysisTypes: ['general'],
    executiveSummary:
      'Water damage visible in kitchen area. Estimated repair PKR 75,000–95,000. Documentation appears consistent with burst pipe incident in Lahore apartment.',
    consistency: {
      level: 'high',
      reason: 'Photos show wet cabinetry matching the burst pipe description.',
    },
    claimReadiness: {
      score: 88,
      documentsComplete: true,
      photosClear: true,
      informationConsistent: true,
      noMajorIssues: true,
    },
  });
}

export function demoAutoClaimReport(): ClaimIntelligenceReport {
  return baseReport({
    analysisTypes: ['vehicle'],
    vehicle: {
      severity: 'moderate',
      severityConfidence: 89,
      damagedParts: ['Rear bumper', 'Tail lamp assembly'],
      repairComplexity: 'medium',
      estimatedCostMinPkr: 95000,
      estimatedCostMaxPkr: 130000,
    },
    executiveSummary:
      'Rear bumper damage assessed as moderate. Emporium Mall parking incident photos match description. Estimated repair PKR 95,000–130,000.',
    consistency: {
      level: 'high',
      reason: 'Rear impact damage visible; matches parking lot incident narrative.',
    },
    claimReadiness: {
      score: 91,
      documentsComplete: true,
      photosClear: true,
      informationConsistent: true,
      noMajorIssues: true,
    },
    insurerRecommendation: 'standard_review',
  });
}

export function demoPetClaimReport(): ClaimIntelligenceReport {
  return baseReport({
    analysisTypes: ['medical'],
    medical: {
      diagnosis: 'Cruciate ligament injury — surgical repair',
      hospital: 'City Vet Clinic, Lahore',
      treatmentType: 'Orthopedic surgery',
      complexity: 'medium',
    },
    executiveSummary:
      'Vet invoice and injury notes support emergency ligament surgery. Treatment complexity medium; amount within typical HBL Pet Care limits.',
    consistency: {
      level: 'high',
      reason: 'Invoice line items align with described ligament surgery.',
    },
    claimReadiness: {
      score: 94,
      documentsComplete: true,
      photosClear: true,
      informationConsistent: true,
      noMajorIssues: true,
    },
    insurerRecommendation: 'standard_review',
  });
}

export function demoTheftClaimReport(): ClaimIntelligenceReport {
  return baseReport({
    analysisTypes: ['general', 'identity'],
    identity: {
      documentType: 'Police report',
      extractedName: 'Ayesha Khan',
      matchesName: true,
      matchesCnic: true,
      matchesUserProfile: true,
      profileMatchReason: 'Police report name matches verified KYC profile.',
    },
    executiveSummary:
      'Stolen laptop claim supported by police report reference. Item list consistent with home office theft description.',
    consistency: {
      level: 'medium',
      reason: 'Police report uploaded; serial numbers not visible in photos.',
    },
    claimReadiness: {
      score: 76,
      documentsComplete: true,
      photosClear: true,
      informationConsistent: true,
      noMajorIssues: false,
    },
    approvalImprovements: ['Upload purchase invoice with laptop serial number for faster settlement.'],
    insurerRecommendation: 'manual_review',
  });
}
