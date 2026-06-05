import type { Types } from 'mongoose';
import { CATEGORIES, type PolicyCategorySlug } from '../constants/categories';
import { ClaimRequest } from '../models/ClaimRequest';
import { Lead } from '../models/Lead';
import type { ILeadDocument } from '../models/Lead';
import { Policy } from '../models/Policy';
import type { IPolicyDocument } from '../models/Policy';
import { Purchase } from '../models/Purchase';
import { QuestionnaireResponse } from '../models/QuestionnaireResponse';
import { enrichPolicies } from '../services/policyPresentation';
import { getCategoryQuestions } from '../services/questionsService';
import {
  uniquePurchasersInRange,
  uniqueSeekersInRange,
} from './insurerFunnelService';
import {
  detectBundleOpportunities,
  detectCategoryDemandSignals,
  inferAudienceLabel,
} from './insurerSignalAnalysis';
import { buildInsurerCustomerGroups } from './insurerCustomerService';
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

export interface DashboardDateRange {
  from: Date;
  to: Date;
  label: string;
}

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
    email: string;
    category: string;
    time: string;
    status: 'Hot' | 'Warm';
    isNew: boolean;
    leadCount: number;
    purchaseCount: number;
    preview: string;
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

function defaultRange(): DashboardDateRange {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 6);
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return { from, to, label: formatRangeLabel(from, to) };
}

function formatRangeLabel(from: Date, to: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${fmt(from)} – ${fmt(to)}`;
}

function parseRange(fromParam?: string, toParam?: string): DashboardDateRange {
  if (!fromParam || !toParam) {
    return defaultRange();
  }
  const from = new Date(fromParam);
  const to = new Date(toParam);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return defaultRange();
  }
  to.setHours(23, 59, 59, 999);
  from.setHours(0, 0, 0, 0);
  return { from, to, label: formatRangeLabel(from, to) };
}

function previousRange(range: DashboardDateRange): DashboardDateRange {
  const durationMs = range.to.getTime() - range.from.getTime();
  const to = new Date(range.from.getTime() - 1);
  const from = new Date(to.getTime() - durationMs);
  return { from, to, label: formatRangeLabel(from, to) };
}

function inRange(date: Date, range: DashboardDateRange): boolean {
  return date >= range.from && date <= range.to;
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
    text: `${rounded > 0 ? '+' : ''}${rounded}% vs prior period`,
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
    if (!inRange(lead.createdAt, range)) continue;
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
  const dateRange = parseRange(options?.from, options?.to) as DashboardDateRange;
  const priorRange = previousRange(dateRange);

  const [policies, leads, claims, purchases] = await Promise.all([
    Policy.find({ insurerProfileId }).sort({ updatedAt: -1 }),
    Lead.find({ insurerProfileId }).sort({ createdAt: -1 }),
    ClaimRequest.find({ insurerProfileId }).sort({ createdAt: -1 }),
    Purchase.find({ insurerProfileId }).sort({ updatedAt: -1 }),
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

  const currentLeads = leads.filter((l) => inRange(l.createdAt, dateRange));
  const priorLeads = leads.filter((l) => inRange(l.createdAt, priorRange));

  const currentSeekers = uniqueSeekersInRange(leads, {
    from: dateRange.from,
    to: dateRange.to,
    label: dateRange.label,
  });
  const priorSeekers = uniqueSeekersInRange(leads, {
    from: priorRange.from,
    to: priorRange.to,
    label: priorRange.label,
  });
  const currentPurchasers = uniquePurchasersInRange(leads, purchases, {
    from: dateRange.from,
    to: dateRange.to,
    label: dateRange.label,
  });
  const priorPurchasers = uniquePurchasersInRange(leads, purchases, {
    from: priorRange.from,
    to: priorRange.to,
    label: priorRange.label,
  });

  const purchaseLeadsCurrent = currentLeads.filter((l) => l.type === 'purchase');
  const newLeadsCurrent = currentLeads.length;
  const newLeadsPrior = priorLeads.length;
  const unreadLeads = currentLeads.filter((l) => !l.seenAt).length;

  const seekerPurchaseRate =
    currentSeekers.size > 0
      ? Math.round((currentPurchasers.size / currentSeekers.size) * 1000) / 10
      : 0;
  const priorSeekerPurchaseRate =
    priorSeekers.size > 0
      ? Math.round((priorPurchasers.size / priorSeekers.size) * 1000) / 10
      : 0;

  let revenueCurrent = 0;
  for (const lead of purchaseLeadsCurrent) {
    const policy = lead.policyId ? policyById.get(String(lead.policyId)) : undefined;
    revenueCurrent += policy?.premiumYearlyPkr ?? 0;
  }
  let revenuePrior = 0;
  for (const lead of priorLeads.filter((l) => l.type === 'purchase')) {
    const policy = lead.policyId ? policyById.get(String(lead.policyId)) : undefined;
    revenuePrior += policy?.premiumYearlyPkr ?? 0;
  }

  const newlyApprovedInPeriod = policies.filter(
    (p) => p.status === 'approved' && inRange(p.reviewedAt ?? p.createdAt, dateRange)
  ).length;
  const policiesChange = pctChange(newlyApprovedInPeriod, Math.max(0, approvedPolicies.length - newlyApprovedInPeriod));
  const leadsChange = pctChange(newLeadsCurrent, newLeadsPrior);
  const seekersChange = pctChange(currentSeekers.size, priorSeekers.size);
  const conversionChange = pctChange(seekerPurchaseRate, priorSeekerPurchaseRate);
  const soldChange = pctChange(currentPurchasers.size, priorPurchasers.size);
  const revenueChange = pctChange(revenueCurrent, revenuePrior);

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

  const overviewStats: InsurerDashboardPayload['overviewStats'] = [
    {
      title: 'Total Policies',
      value: String(approvedPolicies.length),
      change:
        policiesChange.text === 'No prior activity'
          ? `${policies.length} in catalog`
          : policiesChange.text,
      trend: policiesChange.trend,
      icon: 'clipboard-check',
      iconColor: '#2563EB',
    },
    {
      title: 'Active Seekers',
      value: String(currentSeekers.size),
      change: seekersChange.text,
      trend: seekersChange.trend,
      icon: 'users',
      iconColor: '#10B981',
    },
    {
      title: 'New Lead Events',
      value: String(newLeadsCurrent),
      change: `${unreadLeads} unread · ${leadsChange.text}`,
      trend: leadsChange.trend,
      icon: 'inbox',
      iconColor: '#8B5CF6',
    },
    {
      title: 'Seeker → Purchase Rate',
      value: `${seekerPurchaseRate}%`,
      change: conversionChange.text,
      trend: conversionChange.trend,
      icon: 'trending-up',
      iconColor: '#F59E0B',
    },
    {
      title: 'Policies Sold',
      value: String(currentPurchasers.size),
      change: soldChange.text,
      trend: soldChange.trend,
      icon: 'shopping-bag',
      iconColor: '#8B5CF6',
    },
    {
      title: 'Annual Premium Volume',
      value: formatPkr(revenueCurrent),
      change: revenueChange.text,
      trend: revenueChange.trend,
      icon: 'wallet',
      iconColor: '#06B6D4',
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
      metricLabel: 'Lead growth',
      metricValue: `${topDemand.growthPct >= 0 ? '+' : ''}${topDemand.growthPct}%`,
      theme: 'blue',
      sparkline: buildSparkline([
        priorByCategory.get(topDemand.category) ?? 0,
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
      metricLabel: 'Categories',
      metricValue: `${topBundle.primaryCategory} + ${topBundle.secondaryCategory}`,
      theme: 'green',
      sparkline: buildSparkline([1, 2, 3, 4, 5, 6, 7]),
      priority: 90,
      actionType: 'create_policy',
    });
  }

  if (funnelDrop >= 40 && pricedAboveMedian > 0) {
    smartInsights.push({
      badge: 'Checkout drop-off',
      title: 'Review pricing on high-friction policies',
      description:
        'Inquiry and saved-policy leads are not converting to purchases at the expected rate. Review premiums on policies with checkout activity.',
      metricLabel: 'Drop-off',
      metricValue: `${funnelDrop}%`,
      theme: 'purple',
      sparkline: buildSparkline([topOfFunnel, purchaseLeadsCurrent.length]),
      priority: 80 + funnelDrop,
      actionType: 'view_leads',
    });
  }

  const pendingClaims = claims.filter((c) => c.status === 'submitted' || c.status === 'in_review');
  if (unreadLeads > 0) {
    smartInsights.push({
      badge: 'Unread leads',
      title: 'Review new leads',
      description: `${unreadLeads} lead event(s) are unread in your Leads tab. Prompt follow-up improves conversion.`,
      metricLabel: 'Unread',
      metricValue: String(unreadLeads),
      theme: 'orange',
      sparkline: buildSparkline([unreadLeads]),
      priority: 95 + unreadLeads,
      actionType: 'view_leads',
    });
  } else if (avgResponseHours > 36 || pendingClaims.length > 0) {
    smartInsights.push({
      badge: 'Response Time',
      title: 'Improve Claim Speed',
      description:
        pendingClaims.length > 0
          ? `You have ${pendingClaims.length} open claim(s) and an average review time of ${Math.round(avgResponseHours)} hours.`
          : `Average claim review time is ${Math.round(avgResponseHours)} hours.`,
      metricLabel: 'Avg review',
      metricValue: `${Math.round(avgResponseHours)}h`,
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
      const periodLeads = policyLeads.filter((l) => inRange(l.createdAt, dateRange));
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

  const customerGroups = await buildInsurerCustomerGroups(insurerProfileId);
  const recentLeads = customerGroups.slice(0, 4).map((group) => {
    const sortedLeads = [...group.leads].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const latestLead = sortedLeads[0];
    const policyCategory = latestLead?.policy?.category;
    const category =
      policyCategory && CATEGORY_LABELS[policyCategory as PolicyCategorySlug]
        ? CATEGORY_LABELS[policyCategory as PolicyCategorySlug]
        : group.purchases[0]?.policy?.category
          ? CATEGORY_LABELS[group.purchases[0].policy.category as PolicyCategorySlug] ??
            titleCase(group.purchases[0].policy.category)
          : 'Insurance';
    const isHot =
      group.isNew ||
      group.leads.some((lead) => lead.type === 'purchase') ||
      group.purchases.length > 0;

    return {
      id: group.seeker.id,
      name: group.seeker.fullName,
      email: group.seeker.email,
      category,
      time: relativeTime(new Date(group.latestActivityAt)),
      status: isHot ? ('Hot' as const) : ('Warm' as const),
      isNew: group.isNew,
      leadCount: group.leads.length,
      purchaseCount: group.purchases.length,
      preview:
        latestLead?.summary ||
        latestLead?.policy?.name ||
        (group.purchases[0]?.policy?.name
          ? `Purchased ${group.purchases[0].policy.name}`
          : 'Customer activity'),
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
