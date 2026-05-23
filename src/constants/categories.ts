export const CATEGORY_SLUGS = ['home', 'auto', 'life', 'pet', 'others'] as const;
export type CategorySlug = (typeof CATEGORY_SLUGS)[number];

/** Categories that may have seeded or insurer-created policies (excludes `others`). */
export const POLICY_CATEGORY_SLUGS = ['home', 'auto', 'life', 'pet'] as const;
export type PolicyCategorySlug = (typeof POLICY_CATEGORY_SLUGS)[number];

export interface CategoryDefinition {
  slug: CategorySlug;
  name: string;
  available: boolean;
}

export const CATEGORIES: CategoryDefinition[] = [
  { slug: 'home', name: 'Home Insurance', available: true },
  { slug: 'auto', name: 'Auto Insurance', available: true },
  { slug: 'life', name: 'Life Insurance', available: true },
  { slug: 'pet', name: 'Pet Insurance', available: true },
  { slug: 'others', name: 'Other Insurance', available: false },
];

export function isPolicyCategory(value: string): value is PolicyCategorySlug {
  return (POLICY_CATEGORY_SLUGS as readonly string[]).includes(value);
}
