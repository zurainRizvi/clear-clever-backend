import { CATEGORIES, isPolicyCategory, type PolicyCategorySlug } from '../constants/categories';
import { CATEGORY_QUESTION_TEMPLATES } from '../constants/questionTemplates';
import type { IPolicyQuestion } from '../models/Policy';
import { Policy } from '../models/Policy';
import { AppError } from '../utils/apiResponse';

const CATEGORY_ALIASES: Record<string, PolicyCategorySlug> = {
  motorcycle: 'auto',
  vehicle: 'auto',
  car: 'auto',
  bike: 'auto',
  'pet-dog': 'pet',
  'pet-cat': 'pet',
  'pet-bird': 'pet',
  'pet-other': 'pet',
};

export function resolvePolicyCategorySlug(raw: string): PolicyCategorySlug | null {
  const key = raw.trim().toLowerCase();
  if (isPolicyCategory(key)) return key;
  return CATEGORY_ALIASES[key] ?? null;
}

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
  const normalized = category.trim().toLowerCase();
  if (normalized === 'others') {
    return {
      category: 'others',
      name: 'Other Insurance',
      available: false,
      questions: [],
    };
  }

  const slug = resolvePolicyCategorySlug(category);
  if (!slug) {
    throw new AppError(400, 'Invalid category', [`category: must be one of ${CATEGORIES.map((c) => c.slug).join(', ')}`]);
  }
  const definition = CATEGORIES.find((item) => item.slug === slug);
  if (!definition) {
    throw new AppError(400, 'Invalid category', [`category: must be one of ${CATEGORIES.map((c) => c.slug).join(', ')}`]);
  }

  if (definition.slug === 'others' || !definition.available) {
    return {
      category: definition.slug,
      name: definition.name,
      available: false,
      questions: [],
    };
  }

  const policyCategory = slug;
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

function isOtherAnswerValue(value: string): boolean {
  return /^other(\s|$| pet| condition)/i.test(value.trim());
}

function validateOtherDetail(
  question: IPolicyQuestion,
  answers: Record<string, unknown>,
  errors: string[]
): void {
  const value = answers[question.id];
  const otherKey = `${question.id}_other`;
  const otherDetail = answers[otherKey];

  const needsOther =
    (typeof value === 'string' && isOtherAnswerValue(value)) ||
    (Array.isArray(value) && value.some((item) => isOtherAnswerValue(String(item))));

  if (needsOther) {
    if (typeof otherDetail !== 'string' || otherDetail.trim().length < 2) {
      errors.push(`${otherKey}: required when Other is selected`);
    }
  }
}

export function assertAnswersForQuestions(
  answers: Record<string, unknown>,
  questions: IPolicyQuestion[]
): void {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    throw new AppError(400, 'Validation failed', ['answers: must be an object']);
  }

  const isAnswered = (value: unknown) =>
    value !== undefined &&
    value !== null &&
    value !== '' &&
    (!Array.isArray(value) || value.length > 0);

  const questionIds = new Set(questions.map((q) => q.id));
  const providedKeys = Object.keys(answers).filter((key) => {
    if (key.endsWith('_other')) {
      const baseId = key.replace(/_other$/, '');
      return questionIds.has(baseId) && isAnswered(answers[key]);
    }
    return isAnswered(answers[key]);
  });

  if (providedKeys.length === 0) {
    throw new AppError(400, 'Validation failed', ['answers: at least one answer is required']);
  }

  const errors: string[] = [];
  for (const question of questions) {
    if (!question.required) {
      validateOtherDetail(question, answers, errors);
      continue;
    }
    const value = answers[question.id];
    if (!isAnswered(value)) {
      errors.push(`${question.id}: required`);
    }
    validateOtherDetail(question, answers, errors);
  }

  if (errors.length > 0) {
    throw new AppError(400, 'Validation failed', errors);
  }
}

export function parseCategoryForRecommend(category: string): PolicyCategorySlug | null {
  const normalized = category.trim().toLowerCase();
  if (normalized === 'others') {
    return null;
  }
  const slug = resolvePolicyCategorySlug(category);
  if (!slug) {
    throw new AppError(400, 'Invalid category', [`category: must be one of home, auto, life, pet, others`]);
  }
  return slug;
}
