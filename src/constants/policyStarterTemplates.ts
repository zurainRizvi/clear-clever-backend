import type { PolicyCategorySlug } from './categories';
import type { IPolicyQuestion } from '../models/Policy';

export interface PolicyStarterTemplate {
  category: PolicyCategorySlug;
  nameSuffix: string;
  description: string;
  premiumMonthlyPkr: number;
  premiumYearlyPkr: number;
  coverageSummary: string;
  features: string[];
  deductiblePkr: number;
  questions: IPolicyQuestion[];
}

const homeQuestions: IPolicyQuestion[] = [
  {
    id: 'property_type',
    text: 'What type of property do you want to insure?',
    type: 'single',
    options: ['Apartment', 'Independent house', 'Villa'],
    required: true,
  },
  {
    id: 'property_value_pkr',
    text: 'Estimated property value (PKR)?',
    type: 'number',
    required: true,
  },
];

const autoQuestions: IPolicyQuestion[] = [
  {
    id: 'vehicle_type',
    text: 'What type of vehicle do you drive?',
    type: 'single',
    options: ['Car', 'Motorcycle', 'SUV'],
    required: true,
  },
  {
    id: 'vehicle_year',
    text: 'Vehicle manufacturing year?',
    type: 'number',
    required: true,
  },
];

const lifeQuestions: IPolicyQuestion[] = [
  {
    id: 'coverage_goal',
    text: 'Primary coverage goal?',
    type: 'single',
    options: ['Family protection', 'Education fund', 'Retirement planning'],
    required: true,
  },
  {
    id: 'annual_income_pkr',
    text: 'Annual income (PKR)?',
    type: 'number',
    required: true,
  },
];

const petQuestions: IPolicyQuestion[] = [
  {
    id: 'pet_type',
    text: 'What type of pet do you have?',
    type: 'single',
    options: ['Dog', 'Cat', 'Other'],
    required: true,
  },
  {
    id: 'pet_age_years',
    text: 'Pet age in years?',
    type: 'number',
    required: true,
  },
];

export const POLICY_STARTER_TEMPLATES: PolicyStarterTemplate[] = [
  {
    category: 'home',
    nameSuffix: 'Home Insurance Starter',
    description:
      'Sample home insurance plan. Update premiums, coverage, and features to match your offering.',
    premiumMonthlyPkr: 3500,
    premiumYearlyPkr: 39900,
    coverageSummary: 'Up to PKR 5,000,000 building cover with theft add-on.',
    features: [
      'Fire & lightning cover',
      'Theft & burglary protection',
      '24/7 claims helpline',
      'Fast cashless claims desk',
    ],
    deductiblePkr: 25000,
    questions: homeQuestions,
  },
  {
    category: 'auto',
    nameSuffix: 'Auto Insurance Starter',
    description:
      'Sample auto insurance plan. Update premiums, coverage, and features to match your offering.',
    premiumMonthlyPkr: 2800,
    premiumYearlyPkr: 31920,
    coverageSummary: 'Third-party liability plus optional own-damage cover.',
    features: [
      'Third-party liability',
      'Own-damage cover option',
      'Roadside assistance',
      'Windscreen cover',
    ],
    deductiblePkr: 15000,
    questions: autoQuestions,
  },
  {
    category: 'life',
    nameSuffix: 'Life Insurance Starter',
    description:
      'Sample life insurance plan. Update premiums, coverage, and features to match your offering.',
    premiumMonthlyPkr: 2200,
    premiumYearlyPkr: 25080,
    coverageSummary: 'Term life cover with optional critical illness rider.',
    features: [
      'Term life benefit',
      'Critical illness rider option',
      'Family income benefit',
      'Flexible premium payment',
    ],
    deductiblePkr: 0,
    questions: lifeQuestions,
  },
  {
    category: 'pet',
    nameSuffix: 'Pet Insurance Starter',
    description:
      'Sample pet insurance plan. Update premiums, coverage, and features to match your offering.',
    premiumMonthlyPkr: 1800,
    premiumYearlyPkr: 20520,
    coverageSummary: 'Veterinary expenses and accident cover for dogs and cats.',
    features: [
      'Accident cover',
      'Illness treatment',
      'Annual wellness check',
      'Emergency vet visits',
    ],
    deductiblePkr: 5000,
    questions: petQuestions,
  },
];

export function starterPolicySlug(insurerSlug: string, category: PolicyCategorySlug): string {
  return `${insurerSlug}-${category}-starter`;
}

export function isStarterPolicySlug(slug: string): boolean {
  return slug.endsWith('-starter');
}
