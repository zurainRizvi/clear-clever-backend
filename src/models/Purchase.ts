import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import { PURCHASE_STATUSES, type PurchaseStatus } from '../constants/purchase';

export interface IPurchase {
  userId: Types.ObjectId;
  policyId: Types.ObjectId;
  insurerProfileId: Types.ObjectId;
  affiliateSlug: string;
  checkoutTokenHash?: string;
  answers: Record<string, unknown>;
  status: PurchaseStatus;
  paymentProcessedAt?: Date;
  completedAt?: Date;
  completionArtifactsCreated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPurchaseDocument extends IPurchase, Document {}

const purchaseSchema = new Schema<IPurchaseDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    policyId: { type: Schema.Types.ObjectId, ref: 'Policy', required: true, index: true },
    insurerProfileId: {
      type: Schema.Types.ObjectId,
      ref: 'InsurerProfile',
      required: true,
      index: true,
    },
    affiliateSlug: { type: String, required: true, trim: true, lowercase: true },
    checkoutTokenHash: { type: String, select: false },
    answers: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: PURCHASE_STATUSES, default: 'pending', index: true },
    paymentProcessedAt: { type: Date },
    completedAt: { type: Date },
    completionArtifactsCreated: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Purchase: Model<IPurchaseDocument> =
  mongoose.models.Purchase ?? mongoose.model<IPurchaseDocument>('Purchase', purchaseSchema);
