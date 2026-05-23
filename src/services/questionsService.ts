import { CATEGORIES, isPolicyCategory, type PolicyCategorySlug } from '../constants/categories';
import { CATEGORY_QUESTION_TEMPLATES } from '../constants/questionTemplates';
import type { IPolicyQuestion } from '../models/Policy';
import { Policy } from '../models/Policy';
import { AppError } from '../utils/apiResponse';

export interface CategoryQuestionsResult {
  category: string;
  name: string;
  available: boolean;
  questions: IPolicyQuestion[];
}

function mergeQuestions(
  template: IPolicyQuestion[],
  policyQuestions: IPolicyQuestion[]
): IPolicyQuestion[] {
  const merged = new Map<string, IPolicyQuestion>();
  for (const question of template) {
    merged.set(question.id, question);
  }
  for (const question of policyQuestions) {
    if (!merged.has(question.id)) {
      merged.set(question.id, question);
    }
  }
  return Array.from(merged.values());
}

export async function getCategoryQuestions(category: string): Promise<CategoryQuestionsResult> {
  const definition = CATEGORIES.find((item) => item.slug === category);
  if (!definition) {
    throw new AppError(400, 'Invalid category', [`category: must be one of ${CATEGORIES.map((c) => c.slug).join(', ')}`]);
  }

  if (category === 'others' || !definition.available) {
    return {
      category: definition.slug,
      name: definition.name,
      available: false,
      questions: [],
    };
  }

  const policyCategory = category as PolicyCategorySlug;
  const approvedPolicies = await Policy.find({
    category: policyCategory,
    status: 'approved',
  }).select('questions');

  const mergedPolicyQuestions = approvedPolicies.flatMap((policy) => policy.questions);
  const questions = mergeQuestions(CATEGORY_QUESTION_TEMPLATES[policyCategory], mergedPolicyQuestions);

  return {
    category: definition.slug,
    name: definition.name,
    available: true,
    questions,
  };
}

export function assertAnswersForQuestions(
  answers: Record<string, unknown>,
  questions: IPolicyQuestion[]
): void {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    throw new AppError(400, 'Validation failed', ['answers: must be an object']);
  }

  const providedKeys = Object.keys(answers).filter(
    (key) => answers[key] !== undefined && answers[key] !== null && answers[key] !== ''
  );

  if (providedKeys.length === 0) {
    throw new AppError(400, 'Validation failed', ['answers: at least one answer is required']);
  }

  const errors: string[] = [];
  for (const question of questions) {
    if (!question.required) {
      continue;
    }
    const value = answers[question.id];
    if (value === undefined || value === null || value === '') {
      errors.push(`${question.id}: required`);
    }
  }

  if (errors.length > 0) {
    throw new AppError(400, 'Validation failed', errors);
  }
}

export function parseCategoryForRecommend(category: string): PolicyCategorySlug | null {
  if (category === 'others') {
    return null;
  }
  if (!isPolicyCategory(category)) {
    throw new AppError(400, 'Invalid category', [`category: must be one of home, auto, life, pet, others`]);
  }
  return category;
}
