import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import { POLICY_CATEGORY_SLUGS, type PolicyCategorySlug } from '../constants/categories';

export interface IQuestionnaireResponse {
  userId: Types.ObjectId;
  category: PolicyCategorySlug;
  answers: Record<string, unknown>;
  completedQuestionIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IQuestionnaireResponseDocument
  extends IQuestionnaireResponse,
    Document {}

const questionnaireResponseSchema = new Schema<IQuestionnaireResponseDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: String, enum: POLICY_CATEGORY_SLUGS, required: true, index: true },
    answers: { type: Schema.Types.Mixed, default: {} },
    completedQuestionIds: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

questionnaireResponseSchema.index({ userId: 1, category: 1 }, { unique: true });

export const QuestionnaireResponse: Model<IQuestionnaireResponseDocument> =
  mongoose.models.QuestionnaireResponse ??
  mongoose.model<IQuestionnaireResponseDocument>(
    'QuestionnaireResponse',
    questionnaireResponseSchema
  );
