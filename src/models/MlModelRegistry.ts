import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import type { MlModelId } from '../constants/mlModels';

export interface MlCandidateReportMetrics {
  accuracy?: number;
  roc_auc?: number;
  precision?: number;
  recall?: number;
  f1?: number;
  train_rows?: number;
  test_rows?: number;
  confusion_matrix?: number[][];
}

export interface MlCandidateReport {
  trainedAt: string;
  metrics: MlCandidateReportMetrics;
  activeMetrics?: MlCandidateReportMetrics;
  delta?: Partial<MlCandidateReportMetrics>;
  realRowPct?: number;
  syntheticRowPct?: number;
  totalRows?: number;
  driftNotes?: string[];
  comparisonSource?: string;
}

export interface IMlModelRegistry {
  modelId: MlModelId;
  activeVersion: string;
  activeMetrics?: MlCandidateReportMetrics;
  candidateVersion?: string;
  candidateReport?: MlCandidateReport;
  candidateUploadedAt?: Date;
  promotedAt?: Date;
  promotedBy?: Types.ObjectId;
  lastRetrainAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMlModelRegistryDocument extends IMlModelRegistry, Document {}

const metricsSchema = new Schema(
  {
    accuracy: Number,
    roc_auc: Number,
    precision: Number,
    recall: Number,
    f1: Number,
    train_rows: Number,
    test_rows: Number,
    confusion_matrix: [[Number]],
  },
  { _id: false }
);

const candidateReportSchema = new Schema(
  {
    trainedAt: { type: String, required: true },
    metrics: { type: metricsSchema, required: true },
    activeMetrics: metricsSchema,
    delta: metricsSchema,
    realRowPct: Number,
    syntheticRowPct: Number,
    totalRows: Number,
    driftNotes: [String],
    comparisonSource: String,
  },
  { _id: false }
);

const mlModelRegistrySchema = new Schema<IMlModelRegistryDocument>(
  {
    modelId: { type: String, required: true, unique: true, trim: true },
    activeVersion: { type: String, required: true, trim: true },
    activeMetrics: metricsSchema,
    candidateVersion: { type: String, trim: true },
    candidateReport: candidateReportSchema,
    candidateUploadedAt: Date,
    promotedAt: Date,
    promotedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    lastRetrainAt: Date,
  },
  { timestamps: true }
);

export const MlModelRegistry: Model<IMlModelRegistryDocument> =
  mongoose.models.MlModelRegistry ??
  mongoose.model<IMlModelRegistryDocument>('MlModelRegistry', mlModelRegistrySchema);
