import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { OtpPurpose } from '../constants/roles';

export interface IOtpVerification {
  email: string;
  codeHash: string;
  purpose: OtpPurpose;
  expiresAt: Date;
  attempts: number;
  lastSentAt: Date;
  usedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOtpVerificationDocument extends IOtpVerification, Document {}

const otpSchema = new Schema<IOtpVerificationDocument>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    codeHash: { type: String, required: true },
    purpose: { type: String, enum: ['signup', 'reset'], required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, required: true },
    usedAt: { type: Date },
  },
  { timestamps: true }
);

otpSchema.index({ email: 1, purpose: 1 });

export const OtpVerification: Model<IOtpVerificationDocument> =
  mongoose.models.OtpVerification ??
  mongoose.model<IOtpVerificationDocument>('OtpVerification', otpSchema);
