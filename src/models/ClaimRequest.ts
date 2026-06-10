import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import type { ClaimIntelligenceReport } from '../types/claimIntelligence';

export const CLAIM_STATUSES = [
  'submitted',
  'in_review',
  'needs_info',
  'approved',
  'rejected',
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const CLAIM_TYPES = [
  'accident',
  'theft',
  'damage',
  'medical',
  'pet_care',
  'home',
  'auto',
  'life',
  'pet',
  'other',
] as const;
export type ClaimType = (typeof CLAIM_TYPES)[number];

export interface ClaimStoredAttachment {
  fileName: string;
  mimeType: string;
  dataBase64: string;
  uploadedAt: string;
}

export interface ClaimInsurerComment {
  text: string;
  createdAt: string;
}

export interface IClaimRequest {
  userId: Types.ObjectId;
  purchaseId: Types.ObjectId;
  policyId: Types.ObjectId;
  insurerProfileId: Types.ObjectId;
  claimType: ClaimType;
  incidentDate: Date;
  estimatedAmountPkr?: number;
  description: string;
  status: ClaimStatus;
  intelligenceReport?: ClaimIntelligenceReport;
  attachments?: ClaimStoredAttachment[];
  attachmentFingerprint?: string;
  insurerComment?: ClaimInsurerComment;
  createdAt: Date;
  updatedAt: Date;
}

export interface IClaimRequestDocument extends IClaimRequest, Document {}

const claimRequestSchema = new Schema<IClaimRequestDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    purchaseId: { type: Schema.Types.ObjectId, ref: 'Purchase', required: true, index: true },
    policyId: { type: Schema.Types.ObjectId, ref: 'Policy', required: true, index: true },
    insurerProfileId: {
      type: Schema.Types.ObjectId,
      ref: 'InsurerProfile',
      required: true,
      index: true,
    },
    claimType: { type: String, enum: CLAIM_TYPES, required: true },
    incidentDate: { type: Date, required: true },
    estimatedAmountPkr: { type: Number, min: 0 },
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    status: { type: String, enum: CLAIM_STATUSES, default: 'submitted', index: true },
    intelligenceReport: { type: Schema.Types.Mixed },
    attachments: { type: [Schema.Types.Mixed], default: undefined },
    attachmentFingerprint: { type: String },
    insurerComment: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

claimRequestSchema.index({ userId: 1, createdAt: -1 });

export const ClaimRequest: Model<IClaimRequestDocument> =
  mongoose.models.ClaimRequest ??
  mongoose.model<IClaimRequestDocument>('ClaimRequest', claimRequestSchema);
