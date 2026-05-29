import type { Types } from 'mongoose';
import { CATEGORIES, type PolicyCategorySlug } from '../constants/categories';
import { ClaimRequest } from '../models/ClaimRequest';
import { Lead } from '../models/Lead';
import { User } from '../models/User';
import type { ILeadDocument } from '../models/Lead';
import { Policy } from '../models/Policy';
import type { IPolicyDocument } from '../models/Policy';
import { QuestionnaireResponse } from '../models/QuestionnaireResponse';
import { enrichPolicies } from '../services/policyPresentation';
import { getCategoryQuestions } from '../services/questionsService';
import {
  detectBundleOpportunities,
  detectCategoryDemandSignals,
  inferAudienceLabel,
} from './insurerSignalAnalysis';
import {
  inInsurerRange,
  parseInsurerDateRange,
  previousInsurerRange,
  type InsurerDateRange,
} from './insurerDateRange';
import { scorePolicies } from './recommendationService';

const CATEGORY_COLORS: Record<PolicyCategorySlug, string> = {
  home: '#2563EB',
  auto: '#10B981',
  life: '#F59E0B',
  pet: '#8B5CF6',
};

const CATEGORY_LABELS: Record<PolicyCategorySlug, string> = {
  home: 'Home Insurance',
  auto: 'Vehicle Insurance',
  life: 'Life Insurance',
  pet: 'Pet Insurance',
};

export interface DashboardDateRange extends InsurerDateRange {}

export interface InsurerDashboardPayload {
  dateRange: DashboardDateRange;
  overviewStats: Array<{
    title: string;
    value: string;
    change: string;
    trend: 'up' | 'down' | 'neutral';
    icon: string;
    iconColor: string;
  }>;
  smartInsights: Array<{
    badge: string;
    title: string;
    description: string;
    metricLabel: string;
    metricValue: string;
    theme: 'blue' | 'green' | 'purple' | 'orange';
    sparkline: number[];
    priority: number;
    actionType?: string;
  }>;
  topPolicies: Array<{
    policyId: string;
    policy: string;
    category: string;
    match: string;
    conversion: string;
    audience: string;
    revenue: string;
    revenuePkr: number;
    trend: number[];
  }>;
  demandTrends: {
    centerLabel: string;
    segments: Array<{
      label: string;
      value: string;
      color: string;
      trend: string;
      count: number;
    }>;
    footerInsight: {
      label: string;
      text: string;
      badge: string;
    };
  };
  recentLeads: Array<{
    id: string;
    name: string;
    category: string;
    time: string;
    status: 'Hot' | 'Warm';
  }>;
  pendingClaims: Array<{
    id: string;
    claimId: string;
    category: string;
    submitted: string;
  }>;
  badges: {
    claims: number;
    queries: number;
    support: number;
    notifications: number;
  };
}

function pctChange(current: number, previous: number): { text: string; trend: 'up' | 'down' | 'neutral' } {
  if (previous === 0) {
    if (current === 0) return { text: 'No prior activity', trend: 'neutral' };
    return { text: `+${current} new`, trend: 'up' };
  }
  const pct = ((current - previous) / previous) * 100;
  const rounded = Math.round(pct * 10) / 10;
  if (Math.abs(rounded) < 0.5) return { text: 'Flat vs prior period', trend: 'neutral' };
  return {
    text: `${rounded > 0 ? '+' : ''}${rounded}%`,
    trend: rounded > 0 ? 'up' : 'down',
  };
}

function formatPkr(amount: number): string {
  return `Rs ${Math.round(amount).toLocaleString('en-PK')}`;
}

function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function leadCategory(lead: ILeadDocument, policyById: Map<string, IPolicyDocument>): PolicyCategorySlug | null {
  const policy = lead.policyId ? policyById.get(String(lead.policyId)) : undefined;
  if (policy && CATEGORIES.some((c) => c.slug === policy.category)) {
    return policy.category as PolicyCategorySlug;
  }
  const metaCategory = lead.metadata?.category;
  if (typeof metaCategory === 'string' && ['home', 'auto', 'life', 'pet'].includes(metaCategory)) {
    return metaCategory as PolicyCategorySlug;
  }
  return null;
}

function countLeadsByCategory(
  leads: ILeadDocument[],
  policyById: Map<string, IPolicyDocument>,
  range: DashboardDateRange
): Map<PolicyCategorySlug, number> {
  const counts = new Map<PolicyCategorySlug, number>();
  for (const lead of leads) {
    if (!inInsurerRange(lead.createdAt, range)) continue;
    const category = leadCategory(lead, policyById);
    if (!category) continue;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return counts;
}

function buildSparkline(values: number[]): number[] {
  if (values.length >= 4) return values.slice(-7);
  const padded = [...values];
  while (padded.length < 7) {
    padded.unshift(padded[0] ?? 0);
  }
  return padded.slice(-7);
}

function dailyPurchaseCounts(
  leads: ILeadDocument[],
  policyId: string,
  range: DashboardDateRange
): number[] {
  const days: number[] = [];
  const cursor = new Date(range.from);
  while (cursor <= range.to) {
    const dayStart = new Date(cursor);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(cursor);
    dayEnd.setHours(23, 59, 59, 999);
    const count = leads.filter(
      (lead) =>
        lead.type === 'purchase' &&
        String(lead.policyId) === policyId &&
        lead.createdAt >= dayStart &&
        lead.createdAt <= dayEnd
    ).length;
    days.push(count);
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

async function averageMatchScoreForPolicy(
  policy: IPolicyDocument,
  responses: Array<{ category: string; answers: Record<string, unknown> }>
): Promise<number> {
  const category = policy.category as PolicyCategorySlug;
  const categoryResponses = responses.filter((r) => r.category === category);
  if (categoryResponses.length === 0) {
    return policy.status === 'approved' ? 65 : 40;
  }

  const questionSet = await getCategoryQuestions(category);
  const approvedInCategory = await Policy.find({
    category,
    status: 'approved',
  });
  const publicPolicies = await enrichPolicies(approvedInCategory);

  const scores: number[] = [];
  for (const response of categoryResponses) {
    const recommendations = scorePolicies(
      approvedInCategory,
      publicPolicies,
      questionSet.questions,
      response.answers
    );
    const match = recommendations.find((item) => String(item.policy.id) === String(policy._id));
    if (match) {
      scores.push(match.score);
    }
  }

  if (scores.length === 0) {
    return 55;
  }
  return Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
}

export async function buildInsurerDashboard(
  insurerProfileId: Types.ObjectId | string,
  options?: { from?: string; to?: string }
): Promise<InsurerDashboardPayload> {
  const dateRange = parseInsurerDateRange(options?.from, options?.to);
  const priorRange = previousInsurerRange(dateRange);

  const [policies, leads, claims] = await Promise.all([
    Policy.find({ insurerProfileId }).sort({ updatedAt: -1 }),
    Lead.find({ insurerProfileId }).sort({ createdAt: -1 }),
    ClaimRequest.find({ insurerProfileId }).sort({ createdAt: -1 }),
  ]);

  const policyById = new Map(policies.map((p) => [String(p._id), p]));
  const approvedPolicies = policies.filter((p) => p.status === 'approved');

  const leadUserIds = [...new Set(leads.map((l) => String(l.userId)))];
  const questionnaireDocs = await QuestionnaireResponse.find({
    userId: { $in: leadUserIds },
  });
  const questionnaireResponses = questionnaireDocs.map((doc) => ({
    category: doc.category,
    answers: doc.answers as Record<string, unknown>,
  }));

  const insurerCategories = new Set(
    approvedPolicies.map((p) => p.category as PolicyCategorySlug)
  );

  const currentLeads = leads.filter((l) => inInsurerRange(l.createdAt, dateRange));
  const priorLeads = leads.filter((l) => inInsurerRange(l.createdAt, priorRange));

  const purchaseLeadsCurrent = currentLeads.filter((l) => l.type === 'purchase');
  const purchaseLeadsPrior = priorLeads.filter((l) => l.type === 'purchase');
  const newLeadsCurrent = currentLeads.length;
  const newLeadsPrior = priorLeads.length;

  const conversionCurrent =
    currentLeads.length > 0
      ? Math.round((purchaseLeadsCurrent.length / currentLeads.length) * 1000) / 10
      : 0;
  const conversionPrior =
    priorLeads.length > 0
      ? Math.round((purchaseLeadsPrior.length / priorLeads.length) * 1000) / 10
      : 0;

  const revenueCurrent = purchaseLeadsCurrent.reduce((sum, lead) => {
    const policy = lead.policyId ? policyById.get(String(lead.policyId)) : undefined;
    return sum + (policy?.premiumYearlyPkr ?? 0);
  }, 0);
  const revenuePrior = purchaseLeadsPrior.reduce((sum, lead) => {
    const policy = lead.policyId ? policyById.get(String(lead.policyId)) : undefined;
    return sum + (policy?.premiumYearlyPkr ?? 0);
  }, 0);

  const newlyApprovedInPeriod = policies.filter(
    (p) => p.status === 'approved' && inInsurerRange(p.reviewedAt ?? p.createdAt, dateRange)
  ).length;
  const policiesChange = pctChange(newlyApprovedInPeriod, Math.max(0, approvedPolicies.length - newlyApprovedInPeriod));
  const leadsChange = pctChange(newLeadsCurrent, newLeadsPrior);
  const conversionChange = pctChange(conversionCurrent, conversionPrior);
  const revenueChange = pctChange(revenueCurrent, revenuePrior);

  const seenLeads = leads.filter((l) => l.seenAt).length;
  const seenRate = leads.length > 0 ? seenLeads / leads.length : 0;

  const resolvedClaims = claims.filter((c) => c.status === 'approved' || c.status === 'rejected');
  const approvalRate =
    resolvedClaims.length > 0
      ? claims.filter((c) => c.status === 'approved').length / resolvedClaims.length
      : 0.75;

  const responseHours: number[] = [];
  for (const claim of claims) {
    if (claim.status === 'submitted') continue;
    const hours = (claim.updatedAt.getTime() - claim.createdAt.getTime()) / 3600000;
    if (hours >= 0) responseHours.push(hours);
  }
  const avgResponseHours =
    responseHours.length > 0
      ? responseHours.reduce((a, b) => a + b, 0) / responseHours.length
      : 24;

  const categoryCoverage = insurerCategories.size / 4;
  const visibilityScore = Math.min(
    100,
    Math.round(
      (approvedPolicies.length > 0 ? 20 : 0) +
        seenRate * 25 +
        (avgResponseHours <= 48 ? 25 : Math.max(0, 25 - (avgResponseHours - 48) / 4)) +
        categoryCoverage * 30
    )
  );

  const satisfaction = Math.min(
    5,
    Math.round(
      (3.2 +
        approvalRate * 1.2 +
        (conversionCurrent / 100) * 0.8 +
        seenRate * 0.5 -
        Math.min(0.4, avgResponseHours / 120)) *
        10
    ) / 10
  );
  const satisfactionPrior = Math.max(3, satisfaction - 0.4);

  const overviewStats: InsurerDashboardPayload['overviewStats'] = [
    {
      title: 'Total Policies',
      value: String(approvedPolicies.length),
      change: policiesChange.text === 'No prior activity' ? `${policies.length} in catalog` : `${policiesChange.text} vs prior period`,
      trend: policiesChange.trend,
      icon: 'clipboard-check',
      iconColor: '#2563EB',
    },
    {
      title: 'New Leads',
      value: String(newLeadsCurrent),
      change: `${leadsChange.text} vs prior period`,
      trend: leadsChange.trend,
      icon: 'users',
      iconColor: '#10B981',
    },
    {
      title: 'Conversion Rate',
      value: `${conversionCurrent}%`,
      change: `${conversionChange.text} vs prior period`,
      trend: conversionChange.trend,
      icon: 'trending-up',
      iconColor: '#8B5CF6',
    },
    {
      title: 'Projected Revenue',
      value: formatPkr(revenueCurrent),
      change: `${revenueChange.text} vs prior period`,
      trend: revenueChange.trend,
      icon: 'wallet',
      iconColor: '#F59E0B',
    },
    {
      title: 'Visibility Score',
      value: `${visibilityScore}/100`,
      change: visibilityScore >= 70 ? 'Good standing' : visibilityScore >= 50 ? 'Needs attention' : 'Improve response time',
      trend: 'neutral',
      icon: 'star',
      iconColor: '#8B5CF6',
    },
    {
      title: 'Customer Satisfaction',
      value: `${satisfaction}/5`,
      change: satisfaction >= satisfactionPrior ? `+${(satisfaction - satisfactionPrior).toFixed(1)}` : `${(satisfaction - satisfactionPrior).toFixed(1)}`,
      trend: satisfaction >= satisfactionPrior ? 'up' : 'down',
      icon: 'smile',
      iconColor: '#10B981',
    },
  ];

  const currentByCategory = countLeadsByCategory(leads, policyById, dateRange);
  const priorByCategory = countLeadsByCategory(leads, policyById, priorRange);
  const demandSignals = detectCategoryDemandSignals(currentByCategory, priorByCategory);
  const bundleSignals = detectBundleOpportunities(questionnaireResponses, insurerCategories);

  const inquiryLeads = currentLeads.filter((l) => l.type === 'inquiry').length;
  const favoriteLeads = currentLeads.filter((l) => l.type === 'favorite').length;
  const topOfFunnel = inquiryLeads + favoriteLeads;
  const funnelDrop =
    topOfFunnel > 0 ? Math.round((1 - purchaseLeadsCurrent.length / topOfFunnel) * 100) : 0;

  const categoryPremiums = approvedPolicies.map((p) => p.premiumMonthlyPkr);
  const medianPremium =
    categoryPremiums.length > 0
      ? [...categoryPremiums].sort((a, b) => a - b)[Math.floor(categoryPremiums.length / 2)]
      : 0;
  const pricedAboveMedian = approvedPolicies.filter((p) => p.premiumMonthlyPkr > medianPremium * 1.08).length;

  const smartInsights: InsurerDashboardPayload['smartInsights'] = [];

  const topDemand = demandSignals[0];
  if (topDemand) {
    const hasPolicy = insurerCategories.has(topDemand.category);
    smartInsights.push({
      badge: topDemand.growthPct >= 10 ? 'High Demand' : 'Market Signal',
      title: topDemand.label.replace(' Insurance', ' Insurance'),
      description: hasPolicy
        ? topDemand.reason
        : `${topDemand.reason} You do not have an approved ${topDemand.category} policy yet — adding one captures this demand.`,
      metricLabel: 'Potential Growth',
      metricValue: `+${Math.max(topDemand.growthPct, 8)}%`,
      theme: 'blue',
      sparkline: buildSparkline([
        priorByCategory.get(topDemand.category) ?? 0,
        ...Array.from({ length: 5 }, (_, i) =>
          Math.round(((currentByCategory.get(topDemand.category) ?? 0) * (i + 1)) / 6)
        ),
        currentByCategory.get(topDemand.category) ?? 0,
      ]),
      priority: 100 + topDemand.demandScore,
      actionType: hasPolicy ? 'view_leads' : 'create_policy',
    });
  }

  const topBundle = bundleSignals[0];
  if (topBundle) {
    smartInsights.push({
      badge: 'Bundle Opportunity',
      title: topBundle.title,
      description: topBundle.description,
      metricLabel: 'Expected Improvement',
      metricValue: `+${topBundle.expectedImprovementPct}%`,
      theme: 'green',
      sparkline: buildSparkline([2, 3, 4, 5, 6, 7, topBundle.expectedImprovementPct]),
      priority: 90,
      actionType: 'create_policy',
    });
  }

  if (funnelDrop >= 40 && pricedAboveMedian > 0) {
    const discountPct = Math.min(8, Math.round(funnelDrop / 8));
    smartInsights.push({
      badge: 'Pricing Suggestion',
      title: `Offer ${discountPct}% Discount`,
      description:
        'Inquiry and saved-policy leads are not converting to purchases at the expected rate. Your premiums are above the median for your active catalog — a targeted discount can recover conversions.',
      metricLabel: 'Conversion Boost',
      metricValue: `+${Math.min(15, Math.round(discountPct * 2))}%`,
      theme: 'purple',
      sparkline: buildSparkline([topOfFunnel, topOfFunnel - 1, purchaseLeadsCurrent.length + 1, purchaseLeadsCurrent.length + 2, purchaseLeadsCurrent.length + 3, purchaseLeadsCurrent.length + 4, purchaseLeadsCurrent.length + 5]),
      priority: 80 + funnelDrop,
      actionType: 'view_leads',
    });
  }

  const pendingClaims = claims.filter((c) => c.status === 'submitted' || c.status === 'in_review');
  if (avgResponseHours > 36 || pendingClaims.length > 0) {
    const impact = Math.min(15, Math.round(avgResponseHours / 6));
    smartInsights.push({
      badge: 'Response Time',
      title: 'Improve Claim Speed',
      description:
        pendingClaims.length > 0
          ? `You have ${pendingClaims.length} open claim(s) and an average first-response time of ${Math.round(avgResponseHours)} hours. Faster reviews improve seeker trust and your visibility score.`
          : `Average claim first-response is ${Math.round(avgResponseHours)} hours. Faster reviews improve seeker trust and your visibility score.`,
      metricLabel: 'Impact on Score',
      metricValue: `+${impact}%`,
      theme: 'orange',
      sparkline: buildSparkline(responseHours.slice(-7).map((h) => Math.max(1, Math.round(48 - h)))),
      priority: 70 + pendingClaims.length * 5,
      actionType: 'review_claims',
    });
  }

  smartInsights.sort((a, b) => b.priority - a.priority);
  const insightsOut = smartInsights.slice(0, 4);

  const topPoliciesRaw = await Promise.all(
    approvedPolicies.map(async (policy) => {
      const policyLeads = leads.filter((l) => String(l.policyId) === String(policy._id));
      const periodLeads = policyLeads.filter((l) => inInsurerRange(l.createdAt, dateRange));
      const purchases = periodLeads.filter((l) => l.type === 'purchase');
      const conversion =
        periodLeads.length > 0 ? Math.round((purchases.length / periodLeads.length) * 1000) / 10 : 0;
      const revenuePkr = purchases.reduce((sum) => sum + policy.premiumYearlyPkr, 0);
      const matchScore = await averageMatchScoreForPolicy(policy, questionnaireResponses);

      return {
        policyId: String(policy._id),
        policy: policy.name,
        category: policy.category.charAt(0).toUpperCase() + policy.category.slice(1),
        match: `${matchScore}%`,
        conversion: `${conversion}%`,
        audience: inferAudienceLabel(questionnaireResponses, policy.category as PolicyCategorySlug),
        revenue: formatPkr(revenuePkr),
        revenuePkr,
        trend: dailyPurchaseCounts(leads, String(policy._id), dateRange),
        matchScore,
      };
    })
  );

  const topPolicies = topPoliciesRaw
    .sort((a, b) => b.revenuePkr - a.revenuePkr || b.matchScore - a.matchScore)
    .slice(0, 5)
    .map(({ matchScore: _matchScore, ...row }) => row);

  const totalCategoryLeads = [...currentByCategory.values()].reduce((a, b) => a + b, 0) || 1;
  const segments = (['home', 'auto', 'life', 'pet'] as PolicyCategorySlug[])
    .map((category) => {
      const count = currentByCategory.get(category) ?? 0;
      const prev = priorByCategory.get(category) ?? 0;
      const pct = Math.round((count / totalCategoryLeads) * 100);
      const trendPct =
        prev === 0 ? (count > 0 ? 100 : 0) : Math.round(((count - prev) / prev) * 100);
      return {
        label: CATEGORY_LABELS[category],
        value: `${pct}%`,
        color: CATEGORY_COLORS[category],
        trend: `${trendPct >= 0 ? '+' : ''}${trendPct}%`,
        count,
        growthPct: trendPct,
      };
    })
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count)
    .map(({ growthPct: _growthPct, ...segment }) => segment);

  const trending = demandSignals[0];
  const footerInsight = trending
    ? {
        label: 'Trending Now',
        text: trending.reason,
        badge: trending.growthPct >= 8 ? 'High Growth' : 'Watch',
      }
    : {
        label: 'Trending Now',
        text: 'Lead activity is building across your categories this period.',
        badge: 'Stable',
      };

  const recentLeadUsers = await User.find({
    _id: { $in: leads.slice(0, 8).map((l) => l.userId) },
  });
  const userById = new Map(recentLeadUsers.map((u) => [String(u._id), u]));

  const recentLeads = leads.slice(0, 4).map((lead) => {
    const seeker = userById.get(String(lead.userId));
    const policy = lead.policyId ? policyById.get(String(lead.policyId)) : undefined;
    const category = policy
      ? (CATEGORY_LABELS[policy.category as PolicyCategorySlug] ?? titleCase(policy.category))
      : 'Insurance';
    const isHot =
      (lead.status === 'new' && !lead.seenAt && Date.now() - lead.createdAt.getTime() < 2 * 3600000) ||
      lead.type === 'purchase';

    return {
      id: String(lead._id),
      name:
        seeker?.fullName ??
        (typeof lead.metadata?.seekerName === 'string' ? lead.metadata.seekerName : 'Policy seeker'),
      category,
      time: relativeTime(lead.createdAt),
      status: isHot ? ('Hot' as const) : ('Warm' as const),
    };
  });

  const pendingClaimsOut = pendingClaims.slice(0, 2).map((claim) => {
    const policy = policyById.get(String(claim.policyId));
    return {
      id: String(claim._id),
      claimId: `#CLM-${String(claim._id).slice(-5).toUpperCase()}`,
      category: policy
        ? CATEGORY_LABELS[policy.category as PolicyCategorySlug] ?? 'Insurance'
        : 'Insurance',
      submitted: `Submitted ${relativeTime(claim.createdAt)}`,
    };
  });

  const inquiryUnseen = leads.filter(
    (l) => l.type === 'inquiry' && l.status === 'new' && !l.seenAt
  ).length;

  return {
    dateRange,
    overviewStats,
    smartInsights: insightsOut,
    topPolicies,
    demandTrends: {
      centerLabel: 'This Week Leads by Category',
      segments:
        segments.length > 0
          ? segments
          : [
              {
                label: 'No leads yet',
                value: '100%',
                color: '#94A3B8',
                trend: '0%',
                count: 0,
              },
            ],
      footerInsight,
    },
    recentLeads,
    pendingClaims: pendingClaimsOut,
    badges: {
      claims: pendingClaims.length,
      queries: inquiryUnseen + leads.filter((l) => l.type === 'inquiry' && l.status === 'new').length,
      support: leads.filter((l) => l.type === 'inquiry' && !l.seenAt).length > 0 ? 1 : 0,
      notifications:
        inquiryUnseen +
        pendingClaims.length +
        leads.filter((l) => l.status === 'new' && !l.seenAt).length,
    },
  };
}

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
