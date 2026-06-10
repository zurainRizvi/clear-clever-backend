export const CLAIM_INTELLIGENCE_ANALYSIS_TYPES = [
  'vehicle',
  'identity',
  'policy',
  'medical',
  'general',
] as const;
export type ClaimIntelligenceAnalysisType = (typeof CLAIM_INTELLIGENCE_ANALYSIS_TYPES)[number];

export const DAMAGE_SEVERITIES = ['minor', 'moderate', 'severe'] as const;
export type DamageSeverity = (typeof DAMAGE_SEVERITIES)[number];

export const REPAIR_COMPLEXITIES = ['low', 'medium', 'high'] as const;
export type RepairComplexity = (typeof REPAIR_COMPLEXITIES)[number];

export const CONSISTENCY_LEVELS = ['high', 'medium', 'low'] as const;
export type ConsistencyLevel = (typeof CONSISTENCY_LEVELS)[number];

export const INSURER_RECOMMENDATIONS = [
  'standard_review',
  'manual_review',
  'escalate_review',
] as const;
export type InsurerRecommendation = (typeof INSURER_RECOMMENDATIONS)[number];

export const EXPIRY_STATUSES = ['valid', 'expired', 'unknown'] as const;
export type ExpiryStatus = (typeof EXPIRY_STATUSES)[number];

export const MEDICAL_COMPLEXITIES = ['low', 'medium', 'high'] as const;
export type MedicalComplexity = (typeof MEDICAL_COMPLEXITIES)[number];

export interface ClaimIntelligenceVehicle {
  severity: DamageSeverity;
  severityConfidence: number;
  damagedParts: string[];
  repairComplexity: RepairComplexity;
  estimatedCostMinPkr: number;
  estimatedCostMaxPkr: number;
}

export interface ClaimIntelligenceIdentity {
  documentType: string;
  extractedName?: string;
  extractedCnic?: string;
  expiryStatus?: ExpiryStatus;
  matchesName: boolean;
  matchesCnic: boolean;
  matchesUserProfile: boolean;
  profileMatchReason: string;
}

export interface ClaimIntelligencePolicyDoc {
  policyNumber?: string;
  insurer?: string;
  policyType?: string;
  expiryDate?: string;
  matchesLinkedPolicy: boolean;
  coverageAppearsValid: boolean;
  validationNotes: string[];
}

export interface ClaimIntelligenceMedical {
  diagnosis?: string;
  hospital?: string;
  treatmentType?: string;
  complexity: MedicalComplexity;
}

export interface ClaimIntelligenceReadiness {
  score: number;
  documentsComplete: boolean;
  photosClear: boolean;
  informationConsistent: boolean;
  noMajorIssues: boolean;
}

export interface ClaimIntelligencePolicyAlignment {
  matchesPolicyCategory: boolean;
  reason: string;
}

export interface ClaimIntelligenceSubmissionChecklist {
  cnicDocumentUploaded: boolean;
  cnicVerified: boolean;
  /** True when the application looks complete for highest approval confidence (does not block submission). */
  readyToSubmit: boolean;
  missingItems: string[];
}

/** Actionable steps to raise claim-readiness toward 100% approval confidence. */
export type ClaimIntelligenceApprovalImprovements = string[];

export interface ClaimIntelligenceReport {
  reportVersion: '1';
  analyzedAt: string;
  analysisTypes: ClaimIntelligenceAnalysisType[];
  attachmentSummary: { count: number; mimeTypes: string[] };
  vehicle?: ClaimIntelligenceVehicle;
  identity?: ClaimIntelligenceIdentity;
  policyDoc?: ClaimIntelligencePolicyDoc;
  medical?: ClaimIntelligenceMedical;
  consistency: { level: ConsistencyLevel; reason: string };
  suspiciousFlags: string[];
  claimReadiness: ClaimIntelligenceReadiness;
  policyAlignment: ClaimIntelligencePolicyAlignment;
  submissionChecklist: ClaimIntelligenceSubmissionChecklist;
  approvalImprovements: ClaimIntelligenceApprovalImprovements;
  executiveSummary: string;
  insurerRecommendation: InsurerRecommendation;
  modelVersion: string;
}

/** Raw shape returned by Gemini before server-side enrichment. */
export interface GeminiClaimIntelligenceRaw {
  analysisTypes: string[];
  vehicle?: {
    severity?: string;
    severityConfidence?: number;
    damagedParts?: string[];
    repairComplexity?: string;
    estimatedCostMinPkr?: number;
    estimatedCostMaxPkr?: number;
  };
  identity?: {
    documentType?: string;
    extractedName?: string;
    extractedCnic?: string;
    expiryStatus?: string;
  };
  policyDoc?: {
    policyNumber?: string;
    insurer?: string;
    policyType?: string;
    expiryDate?: string;
  };
  medical?: {
    diagnosis?: string;
    hospital?: string;
    treatmentType?: string;
    complexity?: string;
  };
  consistency?: { level?: string; reason?: string };
  suspiciousFlags?: string[];
  executiveSummary?: string;
}
