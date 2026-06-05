import type { PolicyCategorySlug } from '../constants/categories';

const CONTACT_PREFIX = 'contact_';

export function stripContactFields(answers: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(answers).filter(([key]) => !key.startsWith(CONTACT_PREFIX))
  );
}

export function hasMeaningfulAnswers(answers: Record<string, unknown>): boolean {
  return Object.values(stripContactFields(answers)).some((value) => {
    if (value === undefined || value === null || value === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  });
}

export function mergeQuestionnaireAnswers(
  existing: Record<string, unknown> | undefined,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const base = stripContactFields(existing ?? {});
  const next = stripContactFields(incoming);
  return { ...base, ...next };
}

export function categoryFromPurchasePolicy(category: string): PolicyCategorySlug | null {
  if (category === 'home' || category === 'auto' || category === 'life' || category === 'pet') {
    return category;
  }
  return null;
}
