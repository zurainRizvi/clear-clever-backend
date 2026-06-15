import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import type { FraudCategory } from '../controllers/fraudSignalsController';

export const FRAUD_RESOLUTIONS = ['confirmed_fraud', 'false_positive', 'dismissed'] as const;
export type FraudResolution = (typeof FRAUD_RESOLUTIONS)[number];

export interface IFraudSignalResolution {
  signalId: string;
  category: FraudCategory;
  resolution: FraudResolution;
  resolvedBy: Types.ObjectId;
  resolvedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFraudSignalResolutionDocument extends IFraudSignalResolution, Document {}

const fraudSignalResolutionSchema = new Schema<IFraudSignalResolutionDocument>(
  {
    signalId: { type: String, required: true, trim: true, maxlength: 240 },
    category: {
      type: String,
      enum: ['account', 'claims', 'commerce', 'catalog'],
      required: true,
    },
    resolution: { type: String, enum: FRAUD_RESOLUTIONS, required: true },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    resolvedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

fraudSignalResolutionSchema.index({ signalId: 1, category: 1 }, { unique: true });
fraudSignalResolutionSchema.index({ resolvedAt: -1 });

export const FraudSignalResolution: Model<IFraudSignalResolutionDocument> =
  mongoose.models.FraudSignalResolution ??
  mongoose.model<IFraudSignalResolutionDocument>(
    'FraudSignalResolution',
    fraudSignalResolutionSchema
  );
