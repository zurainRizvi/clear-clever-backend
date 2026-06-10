export const KYC_GEMINI_SCHEMA = {
  type: 'object',
  properties: {
    fullName: { type: 'string' },
    fatherName: { type: 'string' },
    cnicNumber: { type: 'string' },
    dob: { type: 'string' },
    issueDate: { type: 'string' },
    expiryDate: { type: 'string' },
    gender: { type: 'string' },
    address: { type: 'string' },
    city: { type: 'string' },
    documentReadable: { type: 'boolean' },
    missingFields: { type: 'array', items: { type: 'string' } },
    suspiciousDocument: { type: 'boolean' },
    croppedDocument: { type: 'boolean' },
    blurScore: { type: 'string', enum: ['Low', 'Medium', 'High'] },
    tamperingRisk: { type: 'string', enum: ['Low', 'Medium', 'High'] },
  },
  required: ['documentReadable', 'missingFields'],
} as const;

export const KYC_SYSTEM_INSTRUCTION = `You are ClearClever's AI KYC Verification Engine for Pakistan.
Extract identity information from a CNIC (National Identity Card) image.
Return ONLY valid JSON matching the schema.

Rules:
- Extract full name, father's name, CNIC number (format xxxxx-xxxxxxx-x), date of birth, issue date, expiry date, gender, and residential address if visible.
- Extract address line and city separately when possible (city is the town or district on the card).
- Set documentReadable to false if the image is too blurry, cropped, or not a CNIC.
- List any missing fields in missingFields (e.g. "dob", "expiryDate", "cnicNumber").
- Assess image quality: blurScore (Low/Medium/High), croppedDocument, suspiciousDocument, tamperingRisk (Low/Medium/High).
- Be conservative — if uncertain, mark fields missing rather than guessing.
- Dates may appear as DD-MM-YYYY or DD/MM/YYYY on Pakistani CNICs.`;

export function buildKycUserMessage(input: {
  profileName: string;
  profileCnicMasked?: string;
}): string {
  const lines = [
    'Analyze this Pakistan CNIC image for KYC verification.',
    `Account holder name on file: ${input.profileName}`,
  ];
  if (input.profileCnicMasked) {
    lines.push(`CNIC on file (masked): ${input.profileCnicMasked}`);
  }
  lines.push(
    'Cross-check extracted name and CNIC number against the values on file. Extract address when visible.'
  );
  return lines.join('\n');
}

export interface GeminiKycRaw {
  fullName?: string;
  fatherName?: string;
  cnicNumber?: string;
  dob?: string;
  issueDate?: string;
  expiryDate?: string;
  gender?: string;
  address?: string;
  city?: string;
  documentReadable?: boolean;
  missingFields?: string[];
  suspiciousDocument?: boolean;
  croppedDocument?: boolean;
  blurScore?: 'Low' | 'Medium' | 'High';
  tamperingRisk?: 'Low' | 'Medium' | 'High';
}
