import { createHash } from 'crypto';
import type { AssistantAttachmentInput } from './assistantAttachments';
import { parseAttachments } from './assistantAttachments';
import { AppError } from '../utils/apiResponse';

export interface StoredClaimAttachment {
  fileName: string;
  mimeType: string;
  dataBase64: string;
  uploadedAt: string;
}

const MAX_ATTACHMENTS = 3;
const MAX_BYTES = 4 * 1024 * 1024;

export function parseClaimAttachments(raw: unknown): AssistantAttachmentInput[] {
  return parseAttachments(raw);
}

export function fingerprintAttachments(attachments: AssistantAttachmentInput[]): string {
  const payload = attachments
    .map((a) => `${a.fileName}|${a.mimeType}|${a.dataBase64.length}`)
    .sort()
    .join('::');
  return createHash('sha256').update(payload).digest('hex').slice(0, 32);
}

export function toStoredAttachments(attachments: AssistantAttachmentInput[]): StoredClaimAttachment[] {
  if (attachments.length > MAX_ATTACHMENTS) {
    throw new AppError(400, 'Validation failed', [`Maximum ${MAX_ATTACHMENTS} attachments allowed`]);
  }

  return attachments.map((a) => {
    const bytes = Buffer.byteLength(a.dataBase64, 'base64');
    if (bytes > MAX_BYTES) {
      throw new AppError(400, 'Validation failed', [`${a.fileName} exceeds 4MB limit`]);
    }
    return {
      fileName: a.fileName,
      mimeType: a.mimeType,
      dataBase64: a.dataBase64,
      uploadedAt: new Date().toISOString(),
    };
  });
}

export function attachmentLooksLikeCnic(fileName: string): boolean {
  return /cnic|nic|identity|id[-_\s]?card|national/i.test(fileName);
}

export function attachmentLooksLikePolicy(fileName: string): boolean {
  return /policy|certificate|coverage|insurance[-_\s]?doc/i.test(fileName);
}

export function hasCnicAttachment(attachments: AssistantAttachmentInput[]): boolean {
  return attachments.some((a) => attachmentLooksLikeCnic(a.fileName));
}

export function hasPolicyAttachment(attachments: AssistantAttachmentInput[]): boolean {
  return attachments.some((a) => attachmentLooksLikePolicy(a.fileName));
}
