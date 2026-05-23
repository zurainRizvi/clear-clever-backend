import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export const LEAD_TYPES = ['inquiry', 'purchase', 'favorite'] as const;
export type LeadType = (typeof LEAD_TYPES)[number];

export const LEAD_STATUSES = ['new', 'in_progress', 'closed'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface ILead {
  insurerProfileId: Types.ObjectId;
  userId: Types.ObjectId;
  policyId?: Types.ObjectId;
  type: LeadType;
  status: LeadStatus;
  summary?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILeadDocument extends ILead, Document {}

const leadSchema = new Schema<ILeadDocument>(
  {
    insurerProfileId: {
      type: Schema.Types.ObjectId,
      ref: 'InsurerProfile',
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    policyId: { type: Schema.Types.ObjectId, ref: 'Policy', index: true },
    type: { type: String, enum: LEAD_TYPES, required: true, index: true },
    status: { type: String, enum: LEAD_STATUSES, default: 'new', index: true },
    summary: { type: String, trim: true, maxlength: 500 },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

leadSchema.index({ insurerProfileId: 1, createdAt: -1 });

export const Lead: Model<ILeadDocument> =
  mongoose.models.Lead ?? mongoose.model<ILeadDocument>('Lead', leadSchema);
