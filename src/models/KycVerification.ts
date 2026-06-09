import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import type { PakistanRegionSlug } from '../services/pakistanRegionStats';

export type KycStatus = 'none' | 'partial' | 'verified' | 'failed';
export type KycSource = 'manual' | 'upload';
export type BlurScore = 'Low' | 'Medium' | 'High';
export type TamperingRisk = 'Low' | 'Medium' | 'High';
export type CnicGender = 'male' | 'female';

export interface IKycVerification {
  userId: Types.ObjectId;
  cnicMasked?: string;
  status: KycStatus;
  source: KycSource;
  genderPredicted?: CnicGender;
  province?: string;
  district?: string;
  regionSlug?: PakistanRegionSlug;
  extractedFullName?: string;
  extractedFatherName?: string;
  extractedDob?: string;
  extractedIssueDate?: string;
  extractedExpiryDate?: string;
  extractedGender?: string;
  age?: number;
  isAdult?: boolean;
  cnicExpired?: boolean;
  kycScore?: number;
  identityMatchScore?: number;
  nameMatch?: boolean;
  cnicMatch?: boolean;
  profileMatchesDocument?: boolean;
  documentReadable?: boolean;
  identityVerified?: boolean;
  missingFields: string[];
  suspiciousDocument?: boolean;
  croppedDocument?: boolean;
  blurScore?: BlurScore;
  tamperingRisk?: TamperingRisk;
  verifiedAt?: Date;
  geminiModel?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IKycVerificationDocument extends IKycVerification, Document {}

const kycVerificationSchema = new Schema<IKycVerificationDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    cnicMasked: { type: String, trim: true, maxlength: 20 },
    status: {
      type: String,
      enum: ['none', 'partial', 'verified', 'failed'],
      default: 'none',
    },
    source: { type: String, enum: ['manual', 'upload'], default: 'manual' },
    genderPredicted: { type: String, enum: ['male', 'female'] },
    province: { type: String, trim: true, maxlength: 80 },
    district: { type: String, trim: true, maxlength: 80 },
    regionSlug: {
      type: String,
      enum: ['punjab', 'sindh', 'kpk', 'balochistan', 'islamabad', 'gb', 'ajk'],
    },
    extractedFullName: { type: String, trim: true, maxlength: 120 },
    extractedFatherName: { type: String, trim: true, maxlength: 120 },
    extractedDob: { type: String, trim: true, maxlength: 32 },
    extractedIssueDate: { type: String, trim: true, maxlength: 32 },
    extractedExpiryDate: { type: String, trim: true, maxlength: 32 },
    extractedGender: { type: String, trim: true, maxlength: 16 },
    age: { type: Number, min: 0, max: 120 },
    isAdult: { type: Boolean },
    cnicExpired: { type: Boolean },
    kycScore: { type: Number, min: 0, max: 100 },
    identityMatchScore: { type: Number, min: 0, max: 100 },
    nameMatch: { type: Boolean },
    cnicMatch: { type: Boolean },
    profileMatchesDocument: { type: Boolean },
    documentReadable: { type: Boolean },
    identityVerified: { type: Boolean },
    missingFields: { type: [String], default: [] },
    suspiciousDocument: { type: Boolean },
    croppedDocument: { type: Boolean },
    blurScore: { type: String, enum: ['Low', 'Medium', 'High'] },
    tamperingRisk: { type: String, enum: ['Low', 'Medium', 'High'] },
    verifiedAt: { type: Date },
    geminiModel: { type: String, trim: true, maxlength: 64 },
  },
  { timestamps: true }
);

kycVerificationSchema.index({ userId: 1, verifiedAt: -1 });

export const KycVerification: Model<IKycVerificationDocument> =
  mongoose.models.KycVerification ??
  mongoose.model<IKycVerificationDocument>('KycVerification', kycVerificationSchema);
