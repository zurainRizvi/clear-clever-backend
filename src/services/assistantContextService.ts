import { CATEGORIES } from '../constants/categories';
import type { PolicyCategorySlug } from '../constants/categories';
import type { IUserDocument } from '../models/User';
import { QuestionnaireResponse } from '../models/QuestionnaireResponse';
import { Policy } from '../models/Policy';
import { Purchase } from '../models/Purchase';
import { ClaimRequest } from '../models/ClaimRequest';
import { InsurerProfile } from '../models/InsurerProfile';
import { Lead } from '../models/Lead';
import { User } from '../models/User';
import { AppError } from '../utils/apiResponse';
import { enrichPolicies } from './policyPresentation';
import { getCategoryQuestions, parseCategoryForRecommend } from './questionsService';
import { scorePolicies } from './recommendationService';

export interface ScoredPolicySummary {
  policyId: string;
  name: string;
  insurer: string;
  premiumMonthlyPkr: number;
  coverageSummary: string;
  score: number;
  matchReasons: string[];
  rank: number;
}

const PLATFORM_FAQ = [
  'ClearClever helps policy seekers compare home, auto, life, and pet insurance in Pakistan.',
  'Recommendations use a rule-based engine (affordability, coverage fit, features) — not invented by AI.',
  'Purchases redirect to insurer affiliate checkout; ClearClever tracks status and reminders.',
  'Sign in for personalized explanations based on your questionnaire and policies.',
];

export interface AssistantContext {
  audience: 'public' | 'seeker' | 'insurer' | 'staff';
  personalized: boolean;
  platformFaq: string[];
  categories: Array<{ slug: string; name: string; available: boolean }>;
  user?: { role: string; fullName?: string };
  questionnaireSummaries?: Array<{ category: string; answers: Record<string, unknown> }>;
  topRecommendations?: Array<{
    category: string;
    policies: Array<{
      policyId: string;
      name: string;
      insurer: string;
      premiumMonthlyPkr: number;
      coverageSummary: string;
      score: number;
      matchReasons: string[];
      rank: number;
    }>;
  }>;
  recentPurchases?: Array<{
    policyName: string;
    status: string;
    premiumMonthlyPkr?: number;
  }>;
  openClaims?: Array<{ status: string; claimType: string }>;
  insurerSummary?: {
    companyName: string;
    approvedPolicies: number;
    pendingPolicies: number;
    leadCount: number;
  };
  staffSummary?: {
    activeUsers: number;
    pendingPolicyApprovals: number;
    openSupportInquiries?: number;
  };
}

export async function buildAssistantContext(user?: IUserDocument): Promise<AssistantContext> {
  const base: AssistantContext = {
    audience: 'public',
    personalized: false,
    platformFaq: PLATFORM_FAQ,
    categories: CATEGORIES.map((c) => ({
      slug: c.slug,
      name: c.name,
      available: c.available,
    })),
  };

  if (!user) {
    return base;
  }

  base.user = {
    role: user.role,
    fullName: user.fullName,
  };

  if (user.role === 'user') {
    base.audience = 'seeker';
    base.personalized = true;
    await attachSeekerContext(base, user);
    return base;
  }

  if (user.role === 'insurer') {
    base.audience = 'insurer';
    base.personalized = true;
    await attachInsurerContext(base, user);
    return base;
  }

  if (user.role === 'admin' || user.role === 'superadmin') {
    base.audience = 'staff';
    base.personalized = true;
    await attachStaffContext(base);
    return base;
  }

  return base;
}

async function attachSeekerContext(context: AssistantContext, user: IUserDocument): Promise<void> {
  const responses = await QuestionnaireResponse.find({ userId: user._id }).sort({ updatedAt: -1 });

  context.questionnaireSummaries = responses.map((r) => ({
    category: r.category,
    answers: r.answers,
  }));

  context.topRecommendations = [];
  for (const response of responses.slice(0, 4)) {
    const recs = await scoreTopRecommendations(response.category, response.answers);
    if (recs.length > 0) {
      context.topRecommendations.push({
        category: response.category,
        policies: recs,
      });
    }
  }

  const purchases = await Purchase.find({ userId: user._id }).sort({ createdAt: -1 }).limit(5);
  const policyIds = purchases.map((p) => p.policyId);
  const policies = await Policy.find({ _id: { $in: policyIds } });
  const policyById = new Map(policies.map((p) => [String(p._id), p]));

  context.recentPurchases = purchases.map((p) => {
    const policy = policyById.get(String(p.policyId));
    return {
      policyName: policy?.name ?? 'Policy',
      status: p.status,
      premiumMonthlyPkr: policy?.premiumMonthlyPkr,
    };
  });

  const claims = await ClaimRequest.find({ userId: user._id })
    .sort({ createdAt: -1 })
    .limit(5);

  context.openClaims = claims.map((c) => ({
    status: c.status,
    claimType: c.claimType,
  }));
}

async function scoreTopRecommendations(
  category: PolicyCategorySlug,
  answers: Record<string, unknown>
) {
  const policyCategory = parseCategoryForRecommend(category);
  if (!policyCategory) {
    return [];
  }

  const questionSet = await getCategoryQuestions(policyCategory);
  const approvedPolicies = await Policy.find({
    category: policyCategory,
    status: 'approved',
  });
  const publicPolicies = await enrichPolicies(approvedPolicies);
  const scored = scorePolicies(
    approvedPolicies,
    publicPolicies,
    questionSet.questions,
    answers
  );

  return scored.slice(0, 3).map((item, index) => ({
    policyId: item.policy.id,
    name: item.policy.name,
    insurer: item.policy.insurer.companyName,
    premiumMonthlyPkr: item.policy.premiumMonthlyPkr,
    coverageSummary: item.policy.coverageSummary,
    score: item.score,
    matchReasons: item.matchReasons,
    rank: index + 1,
  }));
}

async function attachInsurerContext(context: AssistantContext, user: IUserDocument): Promise<void> {
  const profile = await InsurerProfile.findOne({ userId: user._id });
  if (!profile) {
    return;
  }

  const [approvedPolicies, pendingPolicies, leadCount] = await Promise.all([
    Policy.countDocuments({ insurerProfileId: profile._id, status: 'approved' }),
    Policy.countDocuments({ insurerProfileId: profile._id, status: 'pending' }),
    Lead.countDocuments({ insurerProfileId: profile._id }),
  ]);

  context.insurerSummary = {
    companyName: profile.companyName,
    approvedPolicies,
    pendingPolicies,
    leadCount,
  };
}

async function attachStaffContext(context: AssistantContext): Promise<void> {
  const [activeUsers, pendingPolicyApprovals] = await Promise.all([
    User.countDocuments({ status: 'active' }),
    Policy.countDocuments({ status: 'pending' }),
  ]);

  context.staffSummary = {
    activeUsers,
    pendingPolicyApprovals,
  };
}

export async function buildExplainPayload(input: {
  user: IUserDocument;
  category: string;
  policyId?: string;
}): Promise<{
  context: AssistantContext;
  target: ScoredPolicySummary;
  answers: Record<string, unknown>;
  topThree: ScoredPolicySummary[];
}> {
  const policyCategory = parseCategoryForRecommend(input.category);
  if (!policyCategory) {
    throw new AppError(400, 'Category is not available for recommendations');
  }

  const stored = await QuestionnaireResponse.findOne({
    userId: input.user._id,
    category: policyCategory,
  });

  if (!stored) {
    throw new AppError(400, 'Complete the questionnaire for this category first');
  }

  const topPolicies = await scoreTopRecommendations(policyCategory, stored.answers);
  if (topPolicies.length === 0) {
    throw new AppError(400, 'No recommendations available for this category');
  }

  const target =
    (input.policyId
      ? topPolicies.find((p) => p.policyId === input.policyId)
      : topPolicies[0]) ?? topPolicies[0];

  const context = await buildAssistantContext(input.user);

  return {
    context,
    target,
    answers: stored.answers,
    topThree: topPolicies,
  };
}

export function buildSystemInstruction(context: AssistantContext): string {
  return [
    'You are ClearClever Assistant, a helpful insurance guidance chatbot for Pakistan.',
    'Use ONLY the JSON context provided. Do not invent policy names, premiums, scores, or coverage amounts.',
    'If data is missing, say you do not have it and suggest signing in or completing the questionnaire.',
    'Do not provide legal or financial advice; encourage users to confirm details with the insurer.',
    'Keep answers concise, friendly, and actionable (2–4 short paragraphs max unless explaining a policy).',
    `Context JSON:\n${JSON.stringify(context)}`,
  ].join('\n\n');
}

export function buildExplainSystemInstruction(
  context: AssistantContext,
  explain: {
    target: {
      name: string;
      insurer: string;
      premiumMonthlyPkr: number;
      coverageSummary: string;
      score: number;
      matchReasons: string[];
      rank: number;
    };
    answers: Record<string, unknown>;
    topThree: Array<{
      policyId: string;
      name: string;
      score: number;
      premiumMonthlyPkr: number;
      rank: number;
    }>;
  }
): string {
  return [
    buildSystemInstruction(context),
    'Task: Explain why the TARGET policy is a strong match for this user based on questionnaire answers and the rule-based score.',
    'Reference exact numbers from the data (premium PKR, score, match reasons). Do not change the ranking order.',
    `Explain payload:\n${JSON.stringify(explain)}`,
  ].join('\n\n');
}
