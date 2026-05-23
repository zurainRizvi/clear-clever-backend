import type { PolicyCategorySlug } from '../constants/categories';
import type { PolicyStatus } from '../constants/policyStatus';
import type { IPolicyQuestion } from '../models/Policy';

export interface SeedPolicyRecord {
  seedKey: string;
  insurerSeedKey: string;
  slug: string;
  name: string;
  category: PolicyCategorySlug;
  description: string;
  premiumMonthlyPkr: number;
  premiumYearlyPkr: number;
  coverageSummary: string;
  features: string[];
  deductiblePkr: number;
  questions: IPolicyQuestion[];
  status: PolicyStatus;
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

export const SEED_POLICIES: SeedPolicyRecord[] = [
  // Home — 4 policies
  {
    seedKey: 'tpl-home-essential',
    insurerSeedKey: 'tpl',
    slug: 'tpl-home-essential',
    name: 'TPL Home Essential',
    category: 'home',
    description: 'Basic fire and theft cover for apartments and small homes in major Pakistani cities.',
    premiumMonthlyPkr: 3500,
    premiumYearlyPkr: 39900,
    coverageSummary: 'Up to PKR 5,000,000 building cover with theft add-on.',
    features: ['Fire cover', 'Theft protection', '24/7 helpline'],
    deductiblePkr: 25000,
    questions: homeQuestions,
    status: 'approved',
  },
  {
    seedKey: 'jubilee-home-shield',
    insurerSeedKey: 'jubilee',
    slug: 'jubilee-home-shield',
    name: 'Jubilee Home Shield',
    category: 'home',
    description: 'Comprehensive home plan with natural disaster rider for Lahore and Islamabad.',
    premiumMonthlyPkr: 5200,
    premiumYearlyPkr: 59280,
    coverageSummary: 'Up to PKR 8,000,000 combined building and contents.',
    features: ['Flood rider', 'Contents cover', 'Temporary accommodation'],
    deductiblePkr: 35000,
    questions: homeQuestions,
    status: 'approved',
  },
  {
    seedKey: 'adamjee-home-plus',
    insurerSeedKey: 'adamjee',
    slug: 'adamjee-home-plus',
    name: 'Adamjee Home Plus',
    category: 'home',
    description: 'Flexible home insurance for independent houses with optional electronics cover.',
    premiumMonthlyPkr: 4800,
    premiumYearlyPkr: 54720,
    coverageSummary: 'Up to PKR 7,500,000 building with optional electronics bundle.',
    features: ['Electronics add-on', 'Burglary cover', 'Fast claims desk'],
    deductiblePkr: 30000,
    questions: homeQuestions,
    status: 'approved',
  },
  {
    seedKey: 'tpl-home-premium',
    insurerSeedKey: 'tpl',
    slug: 'tpl-home-premium',
    name: 'TPL Home Premium (Pending)',
    category: 'home',
    description: 'Premium villa package awaiting admin approval for demo workflows.',
    premiumMonthlyPkr: 8900,
    premiumYearlyPkr: 101460,
    coverageSummary: 'Up to PKR 15,000,000 villa cover with concierge claims.',
    features: ['Concierge claims', 'Garden structures', 'Guest house cover'],
    deductiblePkr: 50000,
    questions: homeQuestions,
    status: 'pending',
  },

  // Auto — 4 policies
  {
    seedKey: 'tpl-auto-comprehensive',
    insurerSeedKey: 'tpl',
    slug: 'tpl-auto-comprehensive',
    name: 'TPL Auto Comprehensive',
    category: 'auto',
    description: 'Full motor cover for sedans and hatchbacks with nationwide workshop network.',
    premiumMonthlyPkr: 6200,
    premiumYearlyPkr: 70680,
    coverageSummary: 'Own damage plus third-party liability up to PKR 2,000,000.',
    features: ['Own damage', 'Third-party liability', 'Windscreen cover'],
    deductiblePkr: 20000,
    questions: autoQuestions,
    status: 'approved',
  },
  {
    seedKey: 'jubilee-auto-guard',
    insurerSeedKey: 'jubilee',
    slug: 'jubilee-auto-guard',
    name: 'Jubilee Auto Guard',
    category: 'auto',
    description: 'Popular motor plan for family SUVs with roadside assistance in Punjab.',
    premiumMonthlyPkr: 7800,
    premiumYearlyPkr: 88920,
    coverageSummary: 'Comprehensive SUV cover up to PKR 4,500,000 vehicle value.',
    features: ['Roadside assistance', 'Replacement car', 'Theft cover'],
    deductiblePkr: 25000,
    questions: autoQuestions,
    status: 'approved',
  },
  {
    seedKey: 'adamjee-auto-smart',
    insurerSeedKey: 'adamjee',
    slug: 'adamjee-auto-smart',
    name: 'Adamjee Auto Smart',
    category: 'auto',
    description: 'Budget-friendly motor Takaful-style plan for daily commuters.',
    premiumMonthlyPkr: 4100,
    premiumYearlyPkr: 46740,
    coverageSummary: 'Third-party plus limited own damage up to PKR 1,500,000.',
    features: ['Affordable premium', 'Quick renewal', 'Digital policy card'],
    deductiblePkr: 15000,
    questions: autoQuestions,
    status: 'approved',
  },
  {
    seedKey: 'jubilee-auto-fleet',
    insurerSeedKey: 'jubilee',
    slug: 'jubilee-auto-fleet',
    name: 'Jubilee Auto Fleet (Pending)',
    category: 'auto',
    description: 'Small business fleet package pending employee approval.',
    premiumMonthlyPkr: 12500,
    premiumYearlyPkr: 142500,
    coverageSummary: 'Multi-vehicle fleet cover for up to 5 commercial vehicles.',
    features: ['Fleet dashboard', 'Driver training discount', 'Bulk renewal'],
    deductiblePkr: 40000,
    questions: autoQuestions,
    status: 'pending',
  },

  // Life — 4 policies
  {
    seedKey: 'jubilee-life-family',
    insurerSeedKey: 'jubilee',
    slug: 'jubilee-life-family',
    name: 'Jubilee Life Family Plan',
    category: 'life',
    description: 'Term life protection designed for young families in urban Pakistan.',
    premiumMonthlyPkr: 2800,
    premiumYearlyPkr: 31920,
    coverageSummary: 'PKR 3,000,000 sum assured with optional critical illness rider.',
    features: ['Critical illness rider', 'Monthly payout option', 'Sharia-compliant option'],
    deductiblePkr: 0,
    questions: lifeQuestions,
    status: 'approved',
  },
  {
    seedKey: 'adamjee-life-secure',
    insurerSeedKey: 'adamjee',
    slug: 'adamjee-life-secure',
    name: 'Adamjee Life Secure',
    category: 'life',
    description: 'Whole life plan with education benefit for children.',
    premiumMonthlyPkr: 4500,
    premiumYearlyPkr: 51300,
    coverageSummary: 'PKR 5,000,000 life cover with education milestone bonuses.',
    features: ['Education bonus', 'Maturity benefit', 'Premium waiver'],
    deductiblePkr: 0,
    questions: lifeQuestions,
    status: 'approved',
  },
  {
    seedKey: 'tpl-life-term',
    insurerSeedKey: 'tpl',
    slug: 'tpl-life-term',
    name: 'TPL Life Term 20',
    category: 'life',
    description: 'Affordable 20-year term life cover with simple underwriting.',
    premiumMonthlyPkr: 2200,
    premiumYearlyPkr: 25080,
    coverageSummary: 'PKR 2,500,000 term cover for ages 25–50.',
    features: ['Simple underwriting', 'Online nomination', 'Tax documentation support'],
    deductiblePkr: 0,
    questions: lifeQuestions,
    status: 'approved',
  },
  {
    seedKey: 'adamjee-life-wealth',
    insurerSeedKey: 'adamjee',
    slug: 'adamjee-life-wealth',
    name: 'Adamjee Life Wealth (Pending)',
    category: 'life',
    description: 'Investment-linked life plan awaiting compliance review.',
    premiumMonthlyPkr: 9500,
    premiumYearlyPkr: 108300,
    coverageSummary: 'PKR 10,000,000 cover/universal life hybrid.',
    features: ['Fund switching', 'Partial withdrawal', 'Wealth advisor access'],
    deductiblePkr: 0,
    questions: lifeQuestions,
    status: 'pending',
  },

  // Pet — 4 policies
  {
    seedKey: 'tpl-pet-care',
    insurerSeedKey: 'tpl',
    slug: 'tpl-pet-care',
    name: 'TPL Pet Care Basic',
    category: 'pet',
    description: 'Veterinary expense cover for dogs and cats in Karachi and Lahore.',
    premiumMonthlyPkr: 1800,
    premiumYearlyPkr: 20520,
    coverageSummary: 'Up to PKR 150,000 annual vet bills with accident cover.',
    features: ['Accident cover', 'Vaccination allowance', 'Partner clinic network'],
    deductiblePkr: 5000,
    questions: petQuestions,
    status: 'approved',
  },
  {
    seedKey: 'jubilee-pet-shield',
    insurerSeedKey: 'jubilee',
    slug: 'jubilee-pet-shield',
    name: 'Jubilee Pet Shield',
    category: 'pet',
    description: 'Enhanced pet plan with surgery and hospitalization benefits.',
    premiumMonthlyPkr: 2600,
    premiumYearlyPkr: 29640,
    coverageSummary: 'Up to PKR 250,000 vet cover including surgery.',
    features: ['Surgery cover', 'Hospitalization', 'Lost pet poster support'],
    deductiblePkr: 7500,
    questions: petQuestions,
    status: 'approved',
  },
  {
    seedKey: 'adamjee-pet-plus',
    insurerSeedKey: 'adamjee',
    slug: 'adamjee-pet-plus',
    name: 'Adamjee Pet Plus',
    category: 'pet',
    description: 'Wellness-focused pet insurance with annual check-up allowance.',
    premiumMonthlyPkr: 2100,
    premiumYearlyPkr: 23940,
    coverageSummary: 'Up to PKR 200,000 combined accident and wellness cover.',
    features: ['Wellness visits', 'Dental cleaning', 'Tele-vet consults'],
    deductiblePkr: 6000,
    questions: petQuestions,
    status: 'approved',
  },
  {
    seedKey: 'tpl-pet-premium',
    insurerSeedKey: 'tpl',
    slug: 'tpl-pet-premium',
    name: 'TPL Pet Premium (Pending)',
    category: 'pet',
    description: 'Premium exotic pet cover pending admin approval.',
    premiumMonthlyPkr: 4200,
    premiumYearlyPkr: 47880,
    coverageSummary: 'Up to PKR 400,000 cover for exotic breeds and birds.',
    features: ['Exotic breed cover', 'Specialist vet network', 'Emergency transport'],
    deductiblePkr: 10000,
    questions: petQuestions,
    status: 'pending',
  },
];

export const SEED_POLICY_COUNT = SEED_POLICIES.length;

export const SEED_APPROVED_POLICY_COUNT = SEED_POLICIES.filter((p) => p.status === 'approved').length;

export const SEED_PENDING_POLICY_COUNT = SEED_POLICIES.filter((p) => p.status === 'pending').length;
