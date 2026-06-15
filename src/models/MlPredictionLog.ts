import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IMlPredictionLog {
  domain: 'claim_risk';
  referenceId: string;
  predictedScore: number;
  predictedLevel: string;
  approvalProbability?: number;
  modelVersion: string;
  actualOutcome: 'approved' | 'rejected';
  loggedAt: Date;
  createdAt: Date;
}

export interface IMlPredictionLogDocument extends IMlPredictionLog, Document {}

const mlPredictionLogSchema = new Schema<IMlPredictionLogDocument>(
  {
    domain: { type: String, enum: ['claim_risk'], required: true },
    referenceId: { type: String, required: true, trim: true, maxlength: 64 },
    predictedScore: { type: Number, required: true, min: 0, max: 100 },
    predictedLevel: { type: String, required: true, trim: true, maxlength: 16 },
    approvalProbability: Number,
    modelVersion: { type: String, required: true, trim: true, maxlength: 64 },
    actualOutcome: { type: String, enum: ['approved', 'rejected'], required: true },
    loggedAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

mlPredictionLogSchema.index({ loggedAt: -1 });
mlPredictionLogSchema.index({ referenceId: 1 }, { unique: true });

export const MlPredictionLog: Model<IMlPredictionLogDocument> =
  mongoose.models.MlPredictionLog ??
  mongoose.model<IMlPredictionLogDocument>('MlPredictionLog', mlPredictionLogSchema);
