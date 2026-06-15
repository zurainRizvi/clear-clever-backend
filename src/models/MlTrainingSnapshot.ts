import mongoose, { Schema, type Document, type Model } from 'mongoose';

export const ML_TRAINING_DOMAINS = ['claim_risk', 'fraud', 'policy_ranker'] as const;
export type MlTrainingDomain = (typeof ML_TRAINING_DOMAINS)[number];

export interface IMlTrainingSnapshot {
  domain: MlTrainingDomain;
  referenceKey: string;
  label: number;
  features: Record<string, unknown>;
  category?: string;
  source: 'production';
  capturedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMlTrainingSnapshotDocument extends IMlTrainingSnapshot, Document {}

const mlTrainingSnapshotSchema = new Schema<IMlTrainingSnapshotDocument>(
  {
    domain: { type: String, enum: ML_TRAINING_DOMAINS, required: true },
    referenceKey: { type: String, required: true, trim: true, maxlength: 240 },
    label: { type: Number, required: true, min: 0, max: 1 },
    features: { type: Schema.Types.Mixed, required: true },
    category: { type: String, trim: true, maxlength: 32 },
    source: { type: String, enum: ['production'], default: 'production' },
    capturedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

mlTrainingSnapshotSchema.index({ domain: 1, referenceKey: 1 }, { unique: true });
mlTrainingSnapshotSchema.index({ domain: 1, capturedAt: -1 });

export const MlTrainingSnapshot: Model<IMlTrainingSnapshotDocument> =
  mongoose.models.MlTrainingSnapshot ??
  mongoose.model<IMlTrainingSnapshotDocument>('MlTrainingSnapshot', mlTrainingSnapshotSchema);
