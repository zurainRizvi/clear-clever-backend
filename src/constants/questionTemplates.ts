import type { PolicyCategorySlug } from './categories';
import type { IPolicyQuestion } from '../models/Policy';

/** Base questionnaire fields per active category (merged with insurer policy questions). */
export const CATEGORY_QUESTION_TEMPLATES: Record<PolicyCategorySlug, IPolicyQuestion[]> = {
  home: [
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
  ],
  auto: [
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
  ],
  life: [
    {
      id: 'coverage_goal',
      text: 'Primary coverage goal?',
      type: 'single',
      options: ['Family protection', 'Education fund', 'Retirement planning'],
      required: true,
    },
    { id: 'annual_income_pkr', text: 'Annual income (PKR)?', type: 'number', required: true },
  ],
  pet: [
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
  ],
};
