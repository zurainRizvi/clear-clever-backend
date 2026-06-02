import mongoose, { Schema, type Document, type Model } from 'mongoose';

export const SUPPORT_INQUIRY_REASONS = [
  'billing',
  'technical',
  'policy',
  'account',
  'other',
] as const;
export type SupportInquiryReason = (typeof SUPPORT_INQUIRY_REASONS)[number];

export const SUPPORT_INQUIRY_ROLES = ['policy_seeker', 'insurance_provider'] as const;
export type SupportInquiryRole = (typeof SUPPORT_INQUIRY_ROLES)[number];

export interface ISupportInquiry {
  userId?: mongoose.Types.ObjectId;
  fullName: string;
  email: string;
  roleLabel: SupportInquiryRole;
  reason: SupportInquiryReason;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISupportInquiryDocument extends ISupportInquiry, Document {}

const supportInquirySchema = new Schema<ISupportInquiryDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: false, index: true },
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    roleLabel: { type: String, enum: SUPPORT_INQUIRY_ROLES, required: true },
    reason: { type: String, enum: SUPPORT_INQUIRY_REASONS, required: true },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

export const SupportInquiry: Model<ISupportInquiryDocument> =
  mongoose.models.SupportInquiry ??
  mongoose.model<ISupportInquiryDocument>('SupportInquiry', supportInquirySchema);
