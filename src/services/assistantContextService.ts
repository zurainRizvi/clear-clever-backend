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
import { SupportInquiry } from '../models/SupportInquiry';
import { AppError } from '../utils/apiResponse';
import { enrichPolicies } from './policyPresentation';
import { getCategoryQuestions, parseCategoryForRecommend } from './questionsService';
import { scorePoliciesHybrid } from './hybridRecommendationService';
import { extractFirstName } from './assistantPrompts';

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

export type AssistantAudience = 'public' | 'seeker' | 'insurer' | 'admin' | 'superadmin';

export interface AssistantContext {
  audience: AssistantAudience;
  personalized: boolean;
  platformFaq: string[];
  categories: Array<{ slug: string; name: string; available: boolean }>;
  addressing?: { fullName: string; firstName: string };
  user?: { role: string; fullName?: string };
  questionnaireSummaries?: Array<{ category: string; answers: Record<string, unknown> }>;
  topRecommendations?: Array<{
    category: string;
    policies: ScoredPolicySummary[];
  }>;
  recentPurchases?: Array<{
    policyName: string;
    status: string;
    premiumMonthlyPkr?: number;
  }>;
  openClaims?: Array<{ status: string; claimType: string; createdAt: string }>;
  insurerSummary?: {
    companyName: string;
    approvedPolicies: number;
    pendingPolicies: number;
    leadCount: number;
    policies: Array<{
      name: string;
      category: string;
      status: string;
      premiumMonthlyPkr: number;
    }>;
    recentLeads: Array<{ status: string; createdAt: string }>;
  };
  staffSummary?: {
    activeUsers: number;
    pendingPolicyApprovals: number;
    openSupportInquiries: number;
    usersByRole?: Record<string, number>;
  };
  currentMessageAttachments?: Array<{ fileName: string; mimeType: string }>;
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

  const firstName = extractFirstName(user.fullName);
  base.user = { role: user.role, fullName: user.fullName };
  if (firstName) {
    base.addressing = { fullName: user.fullName, firstName };
  }

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

  if (user.role === 'superadmin') {
    base.audience = 'superadmin';
    base.personalized = true;
    await attachStaffContext(base, true);
    return base;
  }

  if (user.role === 'admin') {
    base.audience = 'admin';
    base.personalized = true;
    await attachStaffContext(base, false);
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
    createdAt: c.createdAt.toISOString(),
  }));
}

async function scoreTopRecommendations(
  category: PolicyCategorySlug,
  answers: Record<string, unknown>
): Promise<ScoredPolicySummary[]> {
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
  const scored = scorePoliciesHybrid(
    policyCategory,
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

  const [approvedPolicies, pendingPolicies, leadCount, policyDocs, recentLeads] =
    await Promise.all([
      Policy.countDocuments({ insurerProfileId: profile._id, status: 'approved' }),
      Policy.countDocuments({ insurerProfileId: profile._id, status: 'pending' }),
      Lead.countDocuments({ insurerProfileId: profile._id }),
      Policy.find({ insurerProfileId: profile._id })
        .sort({ updatedAt: -1 })
        .limit(12)
        .select('name category status premiumMonthlyPkr'),
      Lead.find({ insurerProfileId: profile._id })
        .sort({ createdAt: -1 })
        .limit(8)
        .select('status createdAt'),
    ]);

  context.insurerSummary = {
    companyName: profile.companyName,
    approvedPolicies,
    pendingPolicies,
    leadCount,
    policies: policyDocs.map((p) => ({
      name: p.name,
      category: p.category,
      status: p.status,
      premiumMonthlyPkr: p.premiumMonthlyPkr,
    })),
    recentLeads: recentLeads.map((l) => ({
      status: l.status,
      createdAt: l.createdAt.toISOString(),
    })),
  };
}

async function attachStaffContext(context: AssistantContext, isSuperadmin: boolean): Promise<void> {
  const [activeUsers, pendingPolicyApprovals, openSupportInquiries, roleCounts] =
    await Promise.all([
      User.countDocuments({ status: 'active' }),
      Policy.countDocuments({ status: 'pending' }),
      SupportInquiry.countDocuments({}),
      User.aggregate<{ _id: string; count: number }>([
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
    ]);

  const usersByRole: Record<string, number> = {};
  for (const row of roleCounts) {
    usersByRole[row._id] = row.count;
  }

  context.staffSummary = {
    activeUsers,
    pendingPolicyApprovals,
    openSupportInquiries,
    ...(isSuperadmin ? { usersByRole } : {}),
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

// Re-export for backward compatibility in tests/imports
export { buildSystemInstruction, buildExplainSystemInstruction } from './assistantPrompts';
