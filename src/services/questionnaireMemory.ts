import type { Types } from 'mongoose';
import type { PolicyCategorySlug } from '../constants/categories';
import { QuestionnaireResponse } from '../models/QuestionnaireResponse';
import type { IPolicyQuestion } from '../models/Policy';

export async function saveQuestionnaireResponse(input: {
  userId: Types.ObjectId;
  category: PolicyCategorySlug;
  answers: Record<string, unknown>;
  questions: IPolicyQuestion[];
}) {
  const completedQuestionIds = input.questions
    .filter((question) => {
      const value = input.answers[question.id];
      return value !== undefined && value !== null && value !== '';
    })
    .map((question) => question.id);

  return QuestionnaireResponse.findOneAndUpdate(
    { userId: input.userId, category: input.category },
    {
      userId: input.userId,
      category: input.category,
      answers: input.answers,
      completedQuestionIds,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}
