import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export const INSURER_POLICY_TYPES = ['conventional', 'islamic', 'both'] as const;
export type InsurerPolicyType = (typeof INSURER_POLICY_TYPES)[number];

export interface IInsurerProfile {
  userId: Types.ObjectId;
  companyName: string;
  slug: string;
  contactEmail: string;
  contactPhone: string;
  description?: string;
  websiteUrl?: string;
  pacraRating?: string;
  jcrVisRating?: string;
  operationalSince?: number;
  policyType?: InsurerPolicyType;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInsurerProfileDocument extends IInsurerProfile, Document {}

const insurerProfileSchema = new Schema<IInsurerProfileDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    companyName: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    contactEmail: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    contactPhone: { type: String, required: true, trim: true, maxlength: 20 },
    description: { type: String, trim: true, maxlength: 2000 },
    websiteUrl: { type: String, trim: true, maxlength: 500 },
    pacraRating: { type: String, trim: true, maxlength: 20 },
    jcrVisRating: { type: String, trim: true, maxlength: 20 },
    operationalSince: { type: Number, min: 1900, max: 2100 },
    policyType: { type: String, enum: INSURER_POLICY_TYPES },
  },
  { timestamps: true }
);

export const InsurerProfile: Model<IInsurerProfileDocument> =
  mongoose.models.InsurerProfile ??
  mongoose.model<IInsurerProfileDocument>('InsurerProfile', insurerProfileSchema);
