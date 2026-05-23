import type { PolicyCategorySlug } from './categories';
import type { IPolicyQuestion } from '../models/Policy';

/** Category questionnaires — realistic fields insurers typically ask in Pakistan. */
export const CATEGORY_QUESTION_TEMPLATES: Record<PolicyCategorySlug, IPolicyQuestion[]> = {
  home: [
    {
      id: 'property_type',
      text: 'What type of property are you insuring?',
      type: 'single',
      options: ['Apartment', 'Independent house', 'Villa', 'Commercial unit'],
      required: true,
    },
    {
      id: 'occupancy',
      text: 'How is the property occupied?',
      type: 'single',
      options: ['Owner occupied', 'Rented out', 'Vacant / under construction'],
      required: true,
    },
    {
      id: 'property_value_pkr',
      text: 'Estimated rebuild / property value (PKR)?',
      type: 'number',
      required: true,
    },
    {
      id: 'contents_cover',
      text: 'Do you need contents coverage inside the property?',
      type: 'single',
      options: ['Yes — full contents', 'Yes — limited contents', 'Structure only'],
      required: true,
    },
    {
      id: 'city',
      text: 'City where the property is located?',
      type: 'text',
      required: true,
    },
  ],
  auto: [
    {
      id: 'vehicle_type',
      text: 'What type of vehicle do you want to insure?',
      type: 'single',
      options: ['Private car', 'SUV / 4x4', 'Motorcycle', 'Commercial vehicle'],
      required: true,
    },
    {
      id: 'vehicle_year',
      text: 'Vehicle manufacturing year?',
      type: 'number',
      required: true,
    },
    {
      id: 'vehicle_make_model',
      text: 'Make and model (e.g. Toyota Corolla 2020)?',
      type: 'text',
      required: true,
    },
    {
      id: 'registration_city',
      text: 'Registration city?',
      type: 'single',
      options: ['Karachi', 'Lahore', 'Islamabad / Rawalpindi', 'Other'],
      required: true,
    },
    {
      id: 'coverage_type',
      text: 'Preferred coverage level?',
      type: 'single',
      options: ['Comprehensive', 'Third-party only', 'Third-party + theft'],
      required: true,
    },
    {
      id: 'annual_mileage_km',
      text: 'Approximate annual mileage (km)?',
      type: 'number',
      required: true,
    },
  ],
  life: [
    {
      id: 'coverage_goal',
      text: 'What is your primary coverage goal?',
      type: 'single',
      options: [
        'Family income protection',
        'Children education fund',
        'Mortgage / loan protection',
        'Retirement planning',
      ],
      required: true,
    },
    {
      id: 'age_band',
      text: 'Your age group?',
      type: 'single',
      options: ['18–30', '31–40', '41–50', '51–60', '60+'],
      required: true,
    },
    {
      id: 'annual_income_pkr',
      text: 'Annual income (PKR)?',
      type: 'number',
      required: true,
    },
    {
      id: 'dependents',
      text: 'Number of dependents to cover?',
      type: 'single',
      options: ['None', '1–2', '3–4', '5 or more'],
      required: true,
    },
    {
      id: 'smoker',
      text: 'Do you use tobacco products?',
      type: 'single',
      options: ['No', 'Yes — occasionally', 'Yes — regularly'],
      required: true,
    },
  ],
  pet: [
    {
      id: 'pet_type',
      text: 'What type of pet do you have?',
      type: 'single',
      options: ['Dog', 'Cat', 'Bird', 'Other'],
      required: true,
    },
    {
      id: 'pet_breed',
      text: 'Breed or description?',
      type: 'text',
      required: true,
    },
    {
      id: 'pet_age_years',
      text: 'Pet age (years)?',
      type: 'number',
      required: true,
    },
    {
      id: 'pet_weight_kg',
      text: 'Approximate weight (kg)?',
      type: 'number',
      required: true,
    },
    {
      id: 'vaccination_status',
      text: 'Vaccination status?',
      type: 'single',
      options: ['Fully vaccinated', 'Partially vaccinated', 'Not vaccinated yet'],
      required: true,
    },
  ],
};
