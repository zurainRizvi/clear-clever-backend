import type { ClaimType } from '../models/ClaimRequest';

export const CLAIM_INTELLIGENCE_GEMINI_SCHEMA = {
  type: 'object',
  properties: {
    analysisTypes: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['vehicle', 'identity', 'policy', 'medical', 'general'],
      },
    },
    vehicle: {
      type: 'object',
      properties: {
        severity: { type: 'string', enum: ['minor', 'moderate', 'severe'] },
        severityConfidence: { type: 'number' },
        damagedParts: { type: 'array', items: { type: 'string' } },
        repairComplexity: { type: 'string', enum: ['low', 'medium', 'high'] },
        estimatedCostMinPkr: { type: 'number' },
        estimatedCostMaxPkr: { type: 'number' },
      },
    },
    identity: {
      type: 'object',
      properties: {
        documentType: { type: 'string' },
        extractedName: { type: 'string' },
        extractedCnic: { type: 'string' },
        expiryStatus: { type: 'string', enum: ['valid', 'expired', 'unknown'] },
      },
    },
    policyDoc: {
      type: 'object',
      properties: {
        policyNumber: { type: 'string' },
        insurer: { type: 'string' },
        policyType: { type: 'string' },
        expiryDate: { type: 'string' },
      },
    },
    medical: {
      type: 'object',
      properties: {
        diagnosis: { type: 'string' },
        hospital: { type: 'string' },
        treatmentType: { type: 'string' },
        complexity: { type: 'string', enum: ['low', 'medium', 'high'] },
      },
    },
    consistency: {
      type: 'object',
      properties: {
        level: { type: 'string', enum: ['high', 'medium', 'low'] },
        reason: { type: 'string' },
      },
      required: ['level', 'reason'],
    },
    suspiciousFlags: { type: 'array', items: { type: 'string' } },
    executiveSummary: { type: 'string' },
  },
  required: ['analysisTypes', 'consistency', 'suspiciousFlags', 'executiveSummary'],
} as const;

export const CLAIM_INTELLIGENCE_SYSTEM_INSTRUCTION = `You are ClearClever's AI Claims Intelligence Engine for Pakistan insurance.
Analyze uploaded claim evidence (photos, PDFs) against the claimant's description.
Return ONLY valid JSON matching the schema. Be factual and conservative.

Rules:
- Detect document types in attachments (vehicle damage photo, CNIC, policy document, medical record).
- For vehicle/auto/accident claims: assess damage severity, list damaged parts, repair complexity, PKR repair cost range (realistic Pakistan market rates).
- For CNIC/identity documents: extract full name, CNIC number (format xxxxx-xxxxxxx-x), and expiry status. CNIC extraction is required for account verification.
- For policy documents: extract policy number, insurer name, policy type, expiry date.
- For medical documents: extract diagnosis, hospital, treatment type, complexity.
- Compare claim description text vs visual evidence for consistency (e.g. "rear hit" vs front bumper damage = low consistency).
- Flag suspicious indicators: low image quality, partially hidden damage, inconsistent angles, unreadable documents.
- Write a concise executive summary (2-4 sentences) for an insurer reviewer.
- Omit optional sections if not applicable; set analysisTypes accordingly.
- Use PKR for all cost estimates.
- ONLY populate policyDoc when a policy document image/PDF was actually uploaded — never copy policy details from the claim context text alone.
- ONLY populate identity when a CNIC/ID document was uploaded.
- If vehicle damage photos are uploaded but the linked policy category is not auto, still analyze vehicle damage but note the category mismatch in consistency.reason.`;

export function buildClaimIntelligenceUserMessage(input: {
  claimType: ClaimType;
  description: string;
  estimatedAmountPkr?: number;
  incidentDate?: string;
  policyName?: string;
  policyCategory?: string;
  insurerName?: string;
  expectedPolicyNumber?: string;
  userFullName?: string;
  attachmentNames: string[];
}): string {
  const lines = [
    '## Claim context',
    `Claim type: ${input.claimType}`,
    `Description: ${input.description}`,
  ];
  if (input.incidentDate) lines.push(`Incident date: ${input.incidentDate}`);
  if (input.estimatedAmountPkr != null) {
    lines.push(`Claimant estimated amount: PKR ${input.estimatedAmountPkr.toLocaleString('en-PK')}`);
  }
  if (input.policyName) lines.push(`Linked policy: ${input.policyName} (${input.policyCategory ?? 'unknown category'})`);
  if (input.insurerName) lines.push(`Insurer: ${input.insurerName}`);
  if (input.expectedPolicyNumber) {
    lines.push(`Expected policy number on linked purchase: ${input.expectedPolicyNumber}`);
  }
  if (input.userFullName) lines.push(`Registered user name: ${input.userFullName}`);
  lines.push('', '## Attachments', input.attachmentNames.join(', ') || '(none)');
  lines.push('', 'Analyze all attachments and return structured JSON.');
  return lines.join('\n');
}
