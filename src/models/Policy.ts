import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import { POLICY_CATEGORY_SLUGS, type PolicyCategorySlug } from '../constants/categories';
import { POLICY_STATUSES, type PolicyStatus } from '../constants/policyStatus';

export const POLICY_QUESTION_TYPES = ['single', 'multi', 'number', 'text'] as const;
export type PolicyQuestionType = (typeof POLICY_QUESTION_TYPES)[number];

export interface IPolicyQuestion {
  id: string;
  text: string;
  type: PolicyQuestionType;
  options?: string[];
  required?: boolean;
}

export interface IPolicyFeatureRow {
  key: string;
  label: string;
  value?: string;
  included?: boolean;
}

export interface IPolicyFeatureSection {
  id: string;
  title: string;
  rows: IPolicyFeatureRow[];
}

export interface IPolicy {
  insurerProfileId: Types.ObjectId;
  slug: string;
  name: string;
  category: PolicyCategorySlug;
  description: string;
  premiumMonthlyPkr: number;
  premiumYearlyPkr: number;
  coverageSummary: string;
  features: string[];
  featureSections?: IPolicyFeatureSection[];
  deductiblePkr: number;
  questions: IPolicyQuestion[];
  status: PolicyStatus;
  rejectionReason?: string;
  reviewedAt?: Date;
  reviewedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPolicyDocument extends IPolicy, Document {}

const policyFeatureRowSchema = new Schema<IPolicyFeatureRow>(
  {
    key: { type: String, required: true, trim: true, maxlength: 80 },
    label: { type: String, required: true, trim: true, maxlength: 200 },
    value: { type: String, trim: true, maxlength: 500 },
    included: { type: Boolean },
  },
  { _id: false }
);

const policyFeatureSectionSchema = new Schema<IPolicyFeatureSection>(
  {
    id: { type: String, required: true, trim: true, maxlength: 80 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    rows: { type: [policyFeatureRowSchema], default: [] },
  },
  { _id: false }
);

const policyQuestionSchema = new Schema<IPolicyQuestion>(
  {
    id: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true, maxlength: 500 },
    type: { type: String, enum: POLICY_QUESTION_TYPES, required: true },
    options: [{ type: String, trim: true }],
    required: { type: Boolean, default: true },
  },
  { _id: false }
);

const policySchema = new Schema<IPolicyDocument>(
  {
    insurerProfileId: {
      type: Schema.Types.ObjectId,
      ref: 'InsurerProfile',
      required: true,
      index: true,
    },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    category: { type: String, enum: POLICY_CATEGORY_SLUGS, required: true, index: true },
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    premiumMonthlyPkr: { type: Number, required: true, min: 0 },
    premiumYearlyPkr: { type: Number, required: true, min: 0 },
    coverageSummary: { type: String, required: true, trim: true, maxlength: 1000 },
    features: [{ type: String, trim: true, maxlength: 200 }],
    featureSections: { type: [policyFeatureSectionSchema], default: [] },
    deductiblePkr: { type: Number, required: true, min: 0 },
    questions: { type: [policyQuestionSchema], default: [] },
    status: { type: String, enum: POLICY_STATUSES, default: 'pending', index: true },
    rejectionReason: { type: String, trim: true, maxlength: 1000 },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const Policy: Model<IPolicyDocument> =
  mongoose.models.Policy ?? mongoose.model<IPolicyDocument>('Policy', policySchema);
