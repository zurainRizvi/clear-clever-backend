import { AppError } from '../utils/apiResponse';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

const MAX_ATTACHMENTS = 3;
const MAX_BYTES_PER_FILE = 4 * 1024 * 1024;

export interface AssistantAttachmentInput {
  mimeType: string;
  fileName: string;
  dataBase64: string;
}

/** Gemini REST API v1beta uses camelCase for inline blobs. */
export interface GeminiInlinePart {
  inlineData: {
    mimeType: string;
    data: string;
  };
}

export function parseAttachments(raw: unknown): AssistantAttachmentInput[] {
  if (raw === undefined || raw === null) {
    return [];
  }
  if (!Array.isArray(raw)) {
    throw new AppError(400, 'Validation failed', ['attachments: must be an array']);
  }
  if (raw.length > MAX_ATTACHMENTS) {
    throw new AppError(400, 'Validation failed', [
      `attachments: maximum ${MAX_ATTACHMENTS} files per message`,
    ]);
  }

  const parsed: AssistantAttachmentInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const mimeType = String((item as { mimeType?: string }).mimeType ?? '').toLowerCase();
    const fileName = String((item as { fileName?: string }).fileName ?? 'file').slice(0, 120);
    const dataBase64 = String((item as { dataBase64?: string }).dataBase64 ?? '').trim();

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new AppError(400, 'Validation failed', [
        'attachments: allowed types are JPEG, PNG, WebP, GIF, and PDF',
      ]);
    }

    const base64Body = dataBase64.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
    if (!base64Body || !/^[A-Za-z0-9+/=]+$/.test(base64Body)) {
      throw new AppError(400, 'Validation failed', ['attachments: invalid base64 data']);
    }

    const byteLength = Buffer.byteLength(base64Body, 'base64');
    if (byteLength > MAX_BYTES_PER_FILE) {
      throw new AppError(400, 'Validation failed', [
        `attachments: each file must be under ${MAX_BYTES_PER_FILE / (1024 * 1024)}MB`,
      ]);
    }

    parsed.push({ mimeType, fileName, dataBase64: base64Body });
  }

  return parsed;
}

export function attachmentsToGeminiParts(
  attachments: AssistantAttachmentInput[]
): GeminiInlinePart[] {
  return attachments.map((file) => ({
    inlineData: {
      mimeType: file.mimeType,
      data: file.dataBase64,
    },
  }));
}

export function describeAttachmentsForPrompt(attachments: AssistantAttachmentInput[]): string {
  if (attachments.length === 0) return '';
  const names = attachments.map((a) => `${a.fileName} (${a.mimeType})`).join(', ');
  return [
    '',
    'The user attached file(s) in this message. You MUST inspect the attached image(s) or PDF(s) directly.',
    `Files: ${names}.`,
    'Describe what you see that is relevant to their insurance question (policy document, ID card, damage photo, etc.).',
    'If a file is unreadable, say so clearly.',
  ].join('\n');
}
