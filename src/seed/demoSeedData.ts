import type { ClaimStatus, ClaimType, ClaimStoredAttachment } from '../models/ClaimRequest';
import type { LeadStatus, LeadType } from '../models/Lead';
import type { PolicyCategorySlug } from '../constants/categories';
import type { NotificationType } from '../constants/purchase';
import type { SupportInquiryReason } from '../models/SupportInquiry';
import type { ClaimIntelligenceReport } from '../types/claimIntelligence';
import {
  demoAutoClaimReport,
  demoHomeClaimReport,
  demoImageAttachment,
  demoMessageAttachment,
  demoPetClaimReport,
  demoTheftClaimReport,
} from './demoSeedAssets';

export const PRIMARY_SEEKER = 'seeker@clearclever.com';
export const SECONDARY_SEEKER = 'syedzurainrizvi@gmail.com';

export interface DemoQuestionnaireRecord {
  userEmail: string;
  category: PolicyCategorySlug;
  answers: Record<string, unknown>;
  completedQuestionIds: string[];
  daysAgo?: number;
}

export interface DemoFavoriteRecord {
  userEmail: string;
  policySlug: string;
  daysAgo?: number;
}

export interface DemoPurchaseRecord {
  userEmail: string;
  policySlug: string;
  answers: Record<string, unknown>;
  status: 'pending' | 'completed' | 'revoked' | 'terminated';
  daysAgoCreated?: number;
  daysAgoCompleted?: number;
}

export interface DemoClaimRecord {
  userEmail: string;
  policySlug: string;
  claimType: ClaimType;
  status: ClaimStatus;
  description: string;
  estimatedAmountPkr: number;
  daysAgoIncident?: number;
  daysAgoCreated?: number;
  intelligenceReport?: ClaimIntelligenceReport;
  attachments?: ClaimStoredAttachment[];
  insurerComment?: string;
}

export interface DemoLeadRecord {
  userEmail: string;
  policySlug: string;
  type: LeadType;
  status: LeadStatus;
  summary: string;
  seen?: boolean;
  daysAgo?: number;
}

export interface DemoNotificationRecord {
  userEmail: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  daysAgo?: number;
}

export interface DemoConversationRecord {
  userEmail: string;
  insurerEmail: string;
  policySlug?: string;
  subject: string;
  messages: Array<{
    senderEmail: string;
    body: string;
    daysAgo?: number;
    attachments?: Array<{ fileName: string; mimeType: string; dataUrl: string }>;
  }>;
}

export interface DemoSupportRecord {
  userEmail: string;
  fullName: string;
  reason: SupportInquiryReason;
  message: string;
  daysAgo?: number;
}

export const DEMO_QUESTIONNAIRES: DemoQuestionnaireRecord[] = [
  {
    userEmail: PRIMARY_SEEKER,
    category: 'home',
    answers: {
      property_type: 'Apartment',
      property_value_pkr: 8500000,
      city: 'Lahore',
      occupancy: 'Owner occupied',
    },
    completedQuestionIds: ['property_type', 'property_value_pkr', 'city'],
    daysAgo: 45,
  },
  {
    userEmail: PRIMARY_SEEKER,
    category: 'auto',
    answers: {
      vehicle_type: 'SUV',
      vehicle_year: 2022,
      city: 'Lahore',
    },
    completedQuestionIds: ['vehicle_type', 'vehicle_year'],
    daysAgo: 40,
  },
  {
    userEmail: PRIMARY_SEEKER,
    category: 'life',
    answers: {
      coverage_goal: 'Family protection',
      annual_income_pkr: 2400000,
      city: 'Lahore',
    },
    completedQuestionIds: ['coverage_goal', 'annual_income_pkr'],
    daysAgo: 35,
  },
  {
    userEmail: PRIMARY_SEEKER,
    category: 'pet',
    answers: {
      pet_type: 'Dog',
      pet_age_years: 3,
      city: 'Lahore',
    },
    completedQuestionIds: ['pet_type', 'pet_age_years'],
    daysAgo: 30,
  },
  {
    userEmail: SECONDARY_SEEKER,
    category: 'home',
    answers: {
      property_type: 'Independent house',
      property_value_pkr: 12000000,
      city: 'Karachi',
    },
    completedQuestionIds: ['property_type', 'property_value_pkr'],
    daysAgo: 25,
  },
  {
    userEmail: SECONDARY_SEEKER,
    category: 'auto',
    answers: {
      vehicle_type: 'Car',
      vehicle_year: 2020,
      city: 'Islamabad',
    },
    completedQuestionIds: ['vehicle_type', 'vehicle_year'],
    daysAgo: 20,
  },
];

export const DEMO_FAVORITES: DemoFavoriteRecord[] = [
  { userEmail: PRIMARY_SEEKER, policySlug: 'tpl-home-essential', daysAgo: 42 },
  { userEmail: PRIMARY_SEEKER, policySlug: 'jubilee-home-shield', daysAgo: 38 },
  { userEmail: PRIMARY_SEEKER, policySlug: 'hbl-auto-comprehensive', daysAgo: 36 },
  { userEmail: PRIMARY_SEEKER, policySlug: 'allianz-life-secure', daysAgo: 34 },
  { userEmail: PRIMARY_SEEKER, policySlug: 'efu-pet-wellness', daysAgo: 32 },
  { userEmail: PRIMARY_SEEKER, policySlug: 'igi-home-comprehensive', daysAgo: 28 },
  { userEmail: SECONDARY_SEEKER, policySlug: 'adamjee-home-plus', daysAgo: 22 },
  { userEmail: SECONDARY_SEEKER, policySlug: 'jubilee-auto-guard', daysAgo: 18 },
  { userEmail: SECONDARY_SEEKER, policySlug: 'tpl-life-term', daysAgo: 14 },
];

export const DEMO_PURCHASES: DemoPurchaseRecord[] = [
  {
    userEmail: PRIMARY_SEEKER,
    policySlug: 'tpl-home-essential',
    answers: {
      property_type: 'Apartment',
      property_value_pkr: 8500000,
      city: 'Lahore',
    },
    status: 'completed',
    daysAgoCreated: 28,
    daysAgoCompleted: 26,
  },
  {
    userEmail: PRIMARY_SEEKER,
    policySlug: 'jubilee-auto-guard',
    answers: {
      vehicle_type: 'SUV',
      vehicle_year: 2022,
      city: 'Lahore',
    },
    status: 'completed',
    daysAgoCreated: 24,
    daysAgoCompleted: 22,
  },
  {
    userEmail: PRIMARY_SEEKER,
    policySlug: 'adamjee-life-secure',
    answers: {
      coverage_goal: 'Education fund',
      annual_income_pkr: 2400000,
    },
    status: 'completed',
    daysAgoCreated: 20,
    daysAgoCompleted: 18,
  },
  {
    userEmail: PRIMARY_SEEKER,
    policySlug: 'hbl-pet-care',
    answers: { pet_type: 'Dog', pet_age_years: 3 },
    status: 'completed',
    daysAgoCreated: 16,
    daysAgoCompleted: 14,
  },
  {
    userEmail: PRIMARY_SEEKER,
    policySlug: 'allianz-home-shield',
    answers: {
      property_type: 'Villa',
      property_value_pkr: 15000000,
      city: 'Lahore',
    },
    status: 'completed',
    daysAgoCreated: 12,
    daysAgoCompleted: 10,
  },
  {
    userEmail: PRIMARY_SEEKER,
    policySlug: 'efu-auto-smart',
    answers: { vehicle_type: 'Car', vehicle_year: 2019, city: 'Lahore' },
    status: 'pending',
    daysAgoCreated: 5,
  },
  {
    userEmail: PRIMARY_SEEKER,
    policySlug: 'igi-auto-drive',
    answers: { vehicle_type: 'Car', vehicle_year: 2021, city: 'Lahore' },
    status: 'revoked',
    daysAgoCreated: 35,
    daysAgoCompleted: 33,
  },
  {
    userEmail: PRIMARY_SEEKER,
    policySlug: 'tpl-pet-care',
    answers: { pet_type: 'Cat', pet_age_years: 2 },
    status: 'terminated',
    daysAgoCreated: 40,
    daysAgoCompleted: 38,
  },
  {
    userEmail: SECONDARY_SEEKER,
    policySlug: 'jubilee-home-shield',
    answers: {
      property_type: 'Independent house',
      property_value_pkr: 12000000,
      city: 'Karachi',
    },
    status: 'completed',
    daysAgoCreated: 21,
    daysAgoCompleted: 19,
  },
  {
    userEmail: SECONDARY_SEEKER,
    policySlug: 'hbl-auto-city',
    answers: { vehicle_type: 'Car', vehicle_year: 2020, city: 'Islamabad' },
    status: 'completed',
    daysAgoCreated: 15,
    daysAgoCompleted: 13,
  },
  {
    userEmail: SECONDARY_SEEKER,
    policySlug: 'efu-life-education',
    answers: {
      coverage_goal: 'Education fund',
      annual_income_pkr: 1800000,
    },
    status: 'completed',
    daysAgoCreated: 10,
    daysAgoCompleted: 8,
  },
  {
    userEmail: 'fatima.ali@clearclever.com',
    policySlug: 'tpl-home-essential',
    answers: { property_type: 'Apartment', property_value_pkr: 6500000, city: 'Karachi' },
    status: 'completed',
    daysAgoCreated: 19,
    daysAgoCompleted: 17,
  },
  {
    userEmail: 'hassan.raza@clearclever.com',
    policySlug: 'jubilee-auto-guard',
    answers: { vehicle_type: 'Car', vehicle_year: 2021, city: 'Lahore' },
    status: 'completed',
    daysAgoCreated: 15,
    daysAgoCompleted: 13,
  },
  {
    userEmail: 'sana.mirza@clearclever.com',
    policySlug: 'adamjee-home-plus',
    answers: { property_type: 'House', property_value_pkr: 9500000, city: 'Islamabad' },
    status: 'completed',
    daysAgoCreated: 11,
    daysAgoCompleted: 9,
  },
  {
    userEmail: 'usman.khan@clearclever.com',
    policySlug: 'hbl-auto-comprehensive',
    answers: { vehicle_type: 'SUV', vehicle_year: 2018, city: 'Peshawar' },
    status: 'completed',
    daysAgoCreated: 8,
    daysAgoCompleted: 6,
  },
  {
    userEmail: 'nadia.sheikh@clearclever.com',
    policySlug: 'efu-pet-wellness',
    answers: { pet_type: 'Cat', pet_age_years: 4, city: 'Faisalabad' },
    status: 'completed',
    daysAgoCreated: 6,
    daysAgoCompleted: 4,
  },
  {
    userEmail: 'bilal.ahmed@clearclever.com',
    policySlug: 'allianz-life-secure',
    answers: { coverage_goal: 'Retirement', annual_income_pkr: 3200000, city: 'Hyderabad' },
    status: 'completed',
    daysAgoCreated: 4,
    daysAgoCompleted: 2,
  },
];

export const DEMO_CLAIMS: DemoClaimRecord[] = [
  {
    userEmail: PRIMARY_SEEKER,
    policySlug: 'tpl-home-essential',
    claimType: 'home',
    status: 'submitted',
    description: 'Water damage from burst pipe in kitchen — requesting assessment for repairs.',
    estimatedAmountPkr: 85000,
    daysAgoIncident: 4,
    daysAgoCreated: 3,
    intelligenceReport: demoHomeClaimReport(),
    attachments: [
      demoImageAttachment('kitchen-water-damage.png'),
      demoImageAttachment('burst-pipe-closeup.png'),
    ],
  },
  {
    userEmail: PRIMARY_SEEKER,
    policySlug: 'jubilee-auto-guard',
    claimType: 'auto',
    status: 'in_review',
    description: 'Rear bumper damage from parking lot incident at Emporium Mall, Lahore.',
    estimatedAmountPkr: 120000,
    daysAgoIncident: 10,
    daysAgoCreated: 9,
    intelligenceReport: demoAutoClaimReport(),
    attachments: [
      demoImageAttachment('rear-bumper-damage.png'),
      demoImageAttachment('emporium-parking-context.png'),
    ],
    insurerComment: 'Workshop inspection scheduled at Johar Town partner garage.',
  },
  {
    userEmail: PRIMARY_SEEKER,
    policySlug: 'hbl-pet-care',
    claimType: 'pet',
    status: 'approved',
    description: 'Emergency vet surgery for ligament injury — partner clinic invoice attached.',
    estimatedAmountPkr: 45000,
    daysAgoIncident: 18,
    daysAgoCreated: 17,
    intelligenceReport: demoPetClaimReport(),
    attachments: [
      demoImageAttachment('vet-invoice-hbl-pet.png'),
      demoImageAttachment('surgery-notes.pdf.png'),
    ],
    insurerComment: 'Approved — settlement processed to registered bank account.',
  },
  {
    userEmail: PRIMARY_SEEKER,
    policySlug: 'allianz-home-shield',
    claimType: 'damage',
    status: 'rejected',
    description: 'Claim for garden furniture damage during storm — seeking review of rejection.',
    estimatedAmountPkr: 35000,
    daysAgoIncident: 25,
    daysAgoCreated: 24,
    intelligenceReport: demoHomeClaimReport(),
    attachments: [demoImageAttachment('garden-storm-damage.png')],
    insurerComment: 'Outdoor furniture not listed under contents schedule — rejection upheld pending rider.',
  },
  {
    userEmail: PRIMARY_SEEKER,
    policySlug: 'tpl-home-essential',
    claimType: 'theft',
    status: 'submitted',
    description: 'Stolen laptop from home office — police report filed at Gulberg station.',
    estimatedAmountPkr: 95000,
    daysAgoIncident: 2,
    daysAgoCreated: 1,
    intelligenceReport: demoTheftClaimReport(),
    attachments: [
      demoImageAttachment('police-report-gulberg.png'),
      demoImageAttachment('home-office-theft-scene.png'),
    ],
  },
  {
    userEmail: PRIMARY_SEEKER,
    policySlug: 'jubilee-auto-guard',
    claimType: 'accident',
    status: 'submitted',
    description: 'Minor fender bender on Canal Road — third party involved, photos uploaded.',
    estimatedAmountPkr: 65000,
    daysAgoIncident: 1,
    daysAgoCreated: 1,
    intelligenceReport: demoAutoClaimReport(),
    attachments: [
      demoImageAttachment('canal-road-fender.png'),
      demoImageAttachment('third-party-vehicle.png'),
    ],
  },
  {
    userEmail: SECONDARY_SEEKER,
    policySlug: 'jubilee-home-shield',
    claimType: 'home',
    status: 'approved',
    description: 'Ceiling repair after monsoon leakage in DHA Karachi property.',
    estimatedAmountPkr: 110000,
    daysAgoIncident: 14,
    daysAgoCreated: 13,
  },
];

export const DEMO_EXTRA_LEADS: DemoLeadRecord[] = [
  {
    userEmail: PRIMARY_SEEKER,
    policySlug: 'jubilee-home-elite',
    type: 'inquiry',
    status: 'new',
    summary: 'Interested in premium villa cover for DHA Lahore property',
    daysAgo: 3,
  },
  {
    userEmail: PRIMARY_SEEKER,
    policySlug: 'tpl-auto-comprehensive',
    type: 'favorite',
    status: 'new',
    summary: 'Saved comprehensive auto plan for comparison',
    daysAgo: 6,
  },
  {
    userEmail: PRIMARY_SEEKER,
    policySlug: 'efu-life-retirement',
    type: 'inquiry',
    status: 'in_progress',
    summary: 'Requested callback about retirement annuity options',
    seen: true,
    daysAgo: 11,
  },
  {
    userEmail: SECONDARY_SEEKER,
    policySlug: 'allianz-auto-guard',
    type: 'inquiry',
    status: 'new',
    summary: 'Comparing SUV plans before renewal',
    daysAgo: 4,
  },
  {
    userEmail: SECONDARY_SEEKER,
    policySlug: 'igi-life-term',
    type: 'favorite',
    status: 'closed',
    summary: 'Saved term life plan — purchased EFU education plan instead',
    seen: true,
    daysAgo: 15,
  },
  {
    userEmail: PRIMARY_SEEKER,
    policySlug: 'adamjee-auto-smart',
    type: 'inquiry',
    status: 'closed',
    summary: 'Budget auto quote — decided on Jubilee instead',
    seen: true,
    daysAgo: 20,
  },
];

export const DEMO_INSURER_LEADS: DemoLeadRecord[] = [
  {
    userEmail: SECONDARY_SEEKER,
    policySlug: 'tpl-auto-comprehensive',
    type: 'inquiry',
    status: 'new',
    summary: 'Seeking quote for 2020 Honda City comprehensive cover',
    daysAgo: 2,
  },
  {
    userEmail: PRIMARY_SEEKER,
    policySlug: 'tpl-motorcycle-ride',
    type: 'favorite',
    status: 'in_progress',
    summary: 'Saved motorcycle plan for daily commute',
    seen: true,
    daysAgo: 7,
  },
  {
    userEmail: SECONDARY_SEEKER,
    policySlug: 'jubilee-life-family',
    type: 'inquiry',
    status: 'new',
    summary: 'Family life plan inquiry for two children',
    daysAgo: 5,
  },
  {
    userEmail: PRIMARY_SEEKER,
    policySlug: 'adamjee-pet-plus',
    type: 'inquiry',
    status: 'closed',
    summary: 'Pet wellness questions answered — purchased HBL plan',
    seen: true,
    daysAgo: 19,
  },
  {
    userEmail: SECONDARY_SEEKER,
    policySlug: 'hbl-life-family',
    type: 'inquiry',
    status: 'new',
    summary: 'Education rider questions for family life plan',
    daysAgo: 3,
  },
  {
    userEmail: PRIMARY_SEEKER,
    policySlug: 'allianz-pet-shield',
    type: 'favorite',
    status: 'new',
    summary: 'Comparing pet chronic illness cover options',
    daysAgo: 4,
  },
  {
    userEmail: SECONDARY_SEEKER,
    policySlug: 'efu-home-plus',
    type: 'inquiry',
    status: 'in_progress',
    summary: 'Home electronics bundle quote for Gulberg house',
    seen: true,
    daysAgo: 8,
  },
  {
    userEmail: PRIMARY_SEEKER,
    policySlug: 'igi-pet-premium',
    type: 'inquiry',
    status: 'new',
    summary: 'Premium pet surgery cover inquiry',
    daysAgo: 2,
  },
];

export const DEMO_EXTRA_NOTIFICATIONS: DemoNotificationRecord[] = [
  {
    userEmail: PRIMARY_SEEKER,
    type: 'claim_submitted',
    title: 'Claim submitted',
    body: 'Your home insurance claim has been received and is under review.',
    read: false,
    daysAgo: 3,
  },
  {
    userEmail: PRIMARY_SEEKER,
    type: 'claim_status',
    title: 'Claim status update',
    body: 'Your auto claim is now in review with Jubilee General Insurance.',
    read: true,
    daysAgo: 9,
  },
  {
    userEmail: PRIMARY_SEEKER,
    type: 'premium_reminder',
    title: 'Premium reminder',
    body: 'Your TPL Home Essential premium is due in 5 days.',
    read: false,
    daysAgo: 2,
  },
  {
    userEmail: PRIMARY_SEEKER,
    type: 'policy_review',
    title: 'Annual policy review',
    body: 'Review your coverage limits before renewal season.',
    read: true,
    daysAgo: 14,
  },
  {
    userEmail: SECONDARY_SEEKER,
    type: 'claim_status',
    title: 'Claim approved',
    body: 'Your home claim with Jubilee has been approved for PKR 110,000.',
    read: true,
    daysAgo: 12,
  },
  {
    userEmail: SECONDARY_SEEKER,
    type: 'premium_reminder',
    title: 'Premium reminder',
    body: 'HBL Auto City premium due next week.',
    read: false,
    daysAgo: 1,
  },
];

export const DEMO_CONVERSATIONS: DemoConversationRecord[] = [
  {
    userEmail: PRIMARY_SEEKER,
    insurerEmail: 'insurer.tpl@clearclever.com',
    policySlug: 'tpl-home-essential',
    subject: 'Home policy documents',
    messages: [
      {
        senderEmail: PRIMARY_SEEKER,
        body: 'Hi, could you confirm when my policy documents will be emailed?',
        daysAgo: 20,
      },
      {
        senderEmail: 'insurer.tpl@clearclever.com',
        body: 'Dear Ayesha, your documents were sent yesterday. Please check your registered email or the purchases timeline.',
        daysAgo: 19,
      },
      {
        senderEmail: PRIMARY_SEEKER,
        body: 'Received them, thank you!',
        daysAgo: 18,
      },
    ],
  },
  {
    userEmail: PRIMARY_SEEKER,
    insurerEmail: 'insurer.jubilee@clearclever.com',
    policySlug: 'jubilee-auto-guard',
    subject: 'Auto claim follow-up',
    messages: [
      {
        senderEmail: 'insurer.jubilee@clearclever.com',
        body: 'We are reviewing your auto claim and may need workshop inspection photos.',
        daysAgo: 8,
      },
      {
        senderEmail: PRIMARY_SEEKER,
        body: 'I have uploaded photos from the partner workshop in Johar Town.',
        daysAgo: 7,
        attachments: [demoMessageAttachment('workshop-inspection-photos.png')],
      },
    ],
  },
  {
    userEmail: PRIMARY_SEEKER,
    insurerEmail: 'insurer.hbl@clearclever.com',
    policySlug: 'hbl-pet-care',
    subject: 'Pet claim vet invoice',
    messages: [
      {
        senderEmail: PRIMARY_SEEKER,
        body: 'Sharing the vet invoice for my dog\'s surgery as discussed on the call.',
        daysAgo: 16,
        attachments: [demoMessageAttachment('vet-invoice-surgery.pdf.png')],
      },
      {
        senderEmail: 'insurer.hbl@clearclever.com',
        body: 'Thank you — your pet claim has been approved. Settlement within 3 business days.',
        daysAgo: 15,
      },
    ],
  },
  {
    userEmail: PRIMARY_SEEKER,
    insurerEmail: 'insurer.allianz@clearclever.com',
    policySlug: 'allianz-home-shield',
    subject: 'Allianz Home Shield — coverage confirmation',
    messages: [
      {
        senderEmail: PRIMARY_SEEKER,
        body: 'Please confirm my DHA Lahore villa is covered under the natural disaster rider.',
        daysAgo: 12,
      },
      {
        senderEmail: 'insurer.allianz@clearclever.com',
        body: 'Your policy schedule includes flood and earthquake rider for Lahore. Schedule attached.',
        daysAgo: 11,
        attachments: [demoMessageAttachment('allianz-policy-schedule.png')],
      },
      {
        senderEmail: PRIMARY_SEEKER,
        body: 'Perfect — saved for my records. Thank you!',
        daysAgo: 10,
      },
    ],
  },
  {
    userEmail: PRIMARY_SEEKER,
    insurerEmail: 'insurer.adamjee@clearclever.com',
    policySlug: 'adamjee-life-secure',
    subject: 'Life policy beneficiary update',
    messages: [
      {
        senderEmail: PRIMARY_SEEKER,
        body: 'I need to add my spouse as nominee on the Adamjee Life Secure plan.',
        daysAgo: 15,
      },
      {
        senderEmail: 'insurer.adamjee@clearclever.com',
        body: 'Nomination form attached. Return a signed CNIC copy of the new nominee.',
        daysAgo: 14,
        attachments: [demoMessageAttachment('nomination-form-adamjee.png')],
      },
    ],
  },
  {
    userEmail: SECONDARY_SEEKER,
    insurerEmail: 'insurer.jubilee@clearclever.com',
    policySlug: 'jubilee-home-shield',
    subject: 'Home claim settlement',
    messages: [
      {
        senderEmail: 'insurer.jubilee@clearclever.com',
        body: 'Your home claim settlement of PKR 110,000 has been processed.',
        daysAgo: 11,
      },
      {
        senderEmail: SECONDARY_SEEKER,
        body: 'Confirmed receipt. Thank you for the quick turnaround.',
        daysAgo: 10,
      },
    ],
  },
];

export const DEMO_SUPPORT: DemoSupportRecord[] = [
  {
    userEmail: PRIMARY_SEEKER,
    fullName: 'Ayesha Khan',
    reason: 'billing',
    message:
      'I need clarification on the premium breakdown shown after completing my Allianz home purchase.',
    daysAgo: 6,
  },
  {
    userEmail: SECONDARY_SEEKER,
    fullName: 'Zurain Rizvi',
    reason: 'policy',
    message: 'Question about adding a rider to my existing Jubilee home policy in Karachi.',
    daysAgo: 4,
  },
  {
    userEmail: PRIMARY_SEEKER,
    fullName: 'Ayesha Khan',
    reason: 'technical',
    message: 'Compare page occasionally shows stale recommendations after updating questionnaire answers.',
    daysAgo: 2,
  },
];
