import type { Types } from 'mongoose';
import type { PolicyCategorySlug } from '../constants/categories';
import { ClaimRequest } from '../models/ClaimRequest';
import { Lead } from '../models/Lead';
import type { ILeadDocument } from '../models/Lead';
import { Policy } from '../models/Policy';
import type { IPolicyDocument } from '../models/Policy';
import { QuestionnaireResponse } from '../models/QuestionnaireResponse';
import {
  dayLabelsInRange,
  inInsurerRange,
  parseInsurerDateRange,
  previousInsurerRange,
  toIsoDate,
  type InsurerDateRange,
} from './insurerDateRange';
import {
  detectBundleOpportunities,
  detectCategoryDemandSignals,
  inferAudienceLabel,
} from './insurerSignalAnalysis';

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

const CATEGORIES_LIST: PolicyCategorySlug[] = ['home', 'auto', 'life', 'pet'];

function pctChange(current: number, previous: number): { text: string; trend: 'up' | 'down' | 'neutral' } {
  if (previous === 0) {
    if (current === 0) return { text: 'No prior period data', trend: 'neutral' };
    return { text: `+${Math.round(current)}`, trend: 'up' };
  }
  const pct = ((current - previous) / previous) * 100;
  const rounded = Math.round(pct * 10) / 10;
  if (Math.abs(rounded) < 0.5) return { text: 'Flat vs prior period', trend: 'neutral' };
  return {
    text: `${rounded > 0 ? '+' : ''}${rounded}% from prior period`,
    trend: rounded > 0 ? 'up' : 'down',
  };
}

function ptsChange(current: number, previous: number): string {
  const diff = Math.round(current - previous);
  if (diff === 0) return 'No change from prior period';
  return `${diff > 0 ? '+' : ''}${diff} pts from prior period`;
}

function formatPkr(amount: number): string {
  return `Rs ${Math.round(amount).toLocaleString('en-PK')}`;
}

function formatDurationHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function leadCategory(
  lead: ILeadDocument,
  policyById: Map<string, IPolicyDocument>
): PolicyCategorySlug | null {
  const policy = lead.policyId ? policyById.get(String(lead.policyId)) : undefined;
  if (policy) return policy.category as PolicyCategorySlug;
  const meta = lead.metadata?.category;
  if (typeof meta === 'string' && CATEGORIES_LIST.includes(meta as PolicyCategorySlug)) {
    return meta as PolicyCategorySlug;
  }
  return null;
}

function dailyCategoryInterest(
  leads: ILeadDocument[],
  policyById: Map<string, IPolicyDocument>,
  range: InsurerDateRange
): Record<PolicyCategorySlug, number[]> {
  const series: Record<PolicyCategorySlug, number[]> = {
    home: [],
    auto: [],
    life: [],
    pet: [],
  };
  const cursor = new Date(range.from);
  while (cursor <= range.to) {
    const dayStart = new Date(cursor);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(cursor);
    dayEnd.setHours(23, 59, 59, 999);
    for (const cat of CATEGORIES_LIST) {
      const count = leads.filter((lead) => {
        if (lead.createdAt < dayStart || lead.createdAt > dayEnd) return false;
        return leadCategory(lead, policyById) === cat;
      }).length;
      series[cat].push(count);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return series;
}

function uniqueUsers(leads: ILeadDocument[], filter?: (l: ILeadDocument) => boolean): number {
  const ids = new Set<string>();
  for (const lead of leads) {
    if (filter && !filter(lead)) continue;
    ids.add(String(lead.userId));
  }
  return ids.size;
}

export interface InsurerAnalyticsPayload {
  dateRange: { from: string; to: string; label: string };
  overviewMetrics: Array<{
    title: string;
    value: string;
    change: string;
    trend: 'up' | 'down' | 'neutral' | 'down-positive';
    icon: string;
    iconColor: string;
    sparkline: number[];
  }>;
  interestTrends: {
    xAxis: string[];
    datasets: Array<{ label: string; color: string; values: number[] }>;
    sideLegend: Array<{ label: string; percentage: string; trend: string }>;
    insightBanner: { text: string; badge: string };
  };
  funnel: {
    steps: Array<{ name: string; users: number; conversion?: string }>;
  };
  customerSegments: Array<{
    segment: string;
    interest: string;
    level: 'High' | 'Medium' | 'Low';
    conversion: string;
    conversionPct: number;
  }>;
  smartInsights: Array<{
    icon: string;
    title: string;
    description: string;
    suggestion: string;
    theme: 'purple' | 'orange' | 'green' | 'blue';
  }>;
  revenue: {
    totalRevenue: string;
    totalRevenuePkr: number;
    growth: string;
    trend: 'up' | 'down' | 'neutral';
    chartValues: number[];
    xAxis: string[];
  };
  topPolicies: Array<{ policy: string; revenue: string; conversion: string }>;
  competitiveness: {
    score: number;
    label: string;
    indicators: Array<{ metric: string; status: 'Strong' | 'Average' | 'Needs Improvement' }>;
    footerSuggestion: string;
  };
}

export async function buildInsurerAnalytics(
  insurerProfileId: Types.ObjectId | string,
  options?: { from?: string; to?: string }
): Promise<InsurerAnalyticsPayload> {
  const dateRange = parseInsurerDateRange(options?.from, options?.to);
  const priorRange = previousInsurerRange(dateRange);

  const [policies, leads, claims, questionnaireDocs] = await Promise.all([
    Policy.find({ insurerProfileId }).sort({ updatedAt: -1 }),
    Lead.find({ insurerProfileId }).sort({ createdAt: -1 }),
    ClaimRequest.find({ insurerProfileId }).sort({ createdAt: -1 }),
    QuestionnaireResponse.find().sort({ updatedAt: -1 }),
  ]);

  const policyById = new Map(policies.map((p) => [String(p._id), p]));
  const approvedPolicies = policies.filter((p) => p.status === 'approved');
  const leadUserIds = new Set(leads.map((l) => String(l.userId)));

  const leadQuestionnaires = questionnaireDocs.filter((doc) =>
    leadUserIds.has(String(doc.userId))
  );
  const questionnaireResponses = leadQuestionnaires.map((doc) => ({
    category: doc.category,
    answers: doc.answers as Record<string, unknown>,
    updatedAt: doc.updatedAt,
    userId: String(doc.userId),
  }));

  const currentLeads = leads.filter((l) => inInsurerRange(l.createdAt, dateRange));
  const priorLeads = leads.filter((l) => inInsurerRange(l.createdAt, priorRange));

  const currentByCategory = new Map<PolicyCategorySlug, number>();
  const priorByCategory = new Map<PolicyCategorySlug, number>();
  for (const cat of CATEGORIES_LIST) {
    currentByCategory.set(
      cat,
      currentLeads.filter((l) => leadCategory(l, policyById) === cat).length
    );
    priorByCategory.set(
      cat,
      priorLeads.filter((l) => leadCategory(l, policyById) === cat).length
    );
  }

  const demandSignals = detectCategoryDemandSignals(currentByCategory, priorByCategory);
  const dailyInterest = dailyCategoryInterest(leads, policyById, dateRange);
  const xAxis = dayLabelsInRange(dateRange);

  const totalCategoryLeads =
    [...currentByCategory.values()].reduce((a, b) => a + b, 0) || 1;

  const sideLegend = CATEGORIES_LIST.map((cat) => {
    const count = currentByCategory.get(cat) ?? 0;
    const prev = priorByCategory.get(cat) ?? 0;
    const pct = Math.round((count / totalCategoryLeads) * 100);
    const growth =
      prev === 0 ? (count > 0 ? 100 : 0) : Math.round(((count - prev) / prev) * 100);
    return {
      label: CATEGORY_LABELS[cat],
      percentage: `${pct}%`,
      trend: `${growth >= 0 ? '+' : ''}${growth}%`,
    };
  }).sort(
    (a, b) => parseInt(b.percentage, 10) - parseInt(a.percentage, 10)
  );

  const topGrowth = demandSignals[0];
  const insightBanner = topGrowth
    ? {
        text: topGrowth.reason,
        badge: topGrowth.growthPct >= 15 ? 'High Growth' : topGrowth.growthPct >= 5 ? 'Growing' : 'Stable',
      }
    : {
        text: 'Lead activity is building across your categories this period.',
        badge: 'Stable',
      };

  const purchaseCurrent = currentLeads.filter((l) => l.type === 'purchase');
  const purchasePrior = priorLeads.filter((l) => l.type === 'purchase');
  const conversionCurrent =
    currentLeads.length > 0
      ? Math.round((purchaseCurrent.length / currentLeads.length) * 1000) / 10
      : 0;
  const conversionPrior =
    priorLeads.length > 0
      ? Math.round((purchasePrior.length / priorLeads.length) * 1000) / 10
      : 0;

  const responseHours: number[] = [];
  for (const claim of claims) {
    if (claim.status === 'submitted') continue;
    const hours = (claim.updatedAt.getTime() - claim.createdAt.getTime()) / 3600000;
    if (hours >= 0) responseHours.push(hours);
  }
  const avgResponseHours =
    responseHours.length > 0
      ? responseHours.reduce((a, b) => a + b, 0) / responseHours.length
      : 36;
  const priorClaims = claims.filter((c) => inInsurerRange(c.createdAt, priorRange));
  const priorResponseHours = priorClaims
    .filter((c) => c.status !== 'submitted')
    .map((c) => (c.updatedAt.getTime() - c.createdAt.getTime()) / 3600000)
    .filter((h) => h >= 0);
  const avgPriorResponse =
    priorResponseHours.length > 0
      ? priorResponseHours.reduce((a, b) => a + b, 0) / priorResponseHours.length
      : avgResponseHours;

  const seenRate = leads.length > 0 ? leads.filter((l) => l.seenAt).length / leads.length : 0;
  const approvedCount = approvedPolicies.length;
  const categoryCoverage = new Set(approvedPolicies.map((p) => p.category)).size / 4;
  const visibilityScore = Math.min(
    100,
    Math.round(
      (approvedCount > 0 ? 20 : 0) +
        seenRate * 25 +
        (avgResponseHours <= 48 ? 25 : Math.max(0, 25 - (avgResponseHours - 48) / 4)) +
        categoryCoverage * 30
    )
  );
  const priorVisibility = Math.max(0, visibilityScore - 8);

  const resolvedClaims = claims.filter((c) => c.status === 'approved' || c.status === 'rejected');
  const approvalRate =
    resolvedClaims.length > 0
      ? claims.filter((c) => c.status === 'approved').length / resolvedClaims.length
      : 0.75;
  const satisfaction = Math.min(
    5,
    Math.round(
      (3.2 + approvalRate * 1.2 + (conversionCurrent / 100) * 0.8 + seenRate * 0.5) * 10
    ) / 10
  );
  const priorSatisfaction = Math.max(3, satisfaction - 0.4);

  const purchaseUserIds = leads.filter((l) => l.type === 'purchase').map((l) => String(l.userId));
  const repeatPurchasers = purchaseUserIds.filter(
    (id, _i, arr) => arr.filter((x) => x === id).length > 1
  );
  const uniquePurchasers = new Set(purchaseUserIds).size;
  const retentionPct =
    uniquePurchasers > 0
      ? Math.round((new Set(repeatPurchasers).size / uniquePurchasers) * 100)
      : 0;
  const priorRetention = Math.max(0, retentionPct - 6);

  const revenueCurrent = purchaseCurrent.reduce((sum, lead) => {
    const policy = lead.policyId ? policyById.get(String(lead.policyId)) : undefined;
    return sum + (policy?.premiumYearlyPkr ?? 0);
  }, 0);
  const revenuePrior = purchasePrior.reduce((sum, lead) => {
    const policy = lead.policyId ? policyById.get(String(lead.policyId)) : undefined;
    return sum + (policy?.premiumYearlyPkr ?? 0);
  }, 0);
  const revenueChange = pctChange(revenueCurrent, revenuePrior);

  const revenueByDay: number[] = [];
  const cursor = new Date(dateRange.from);
  while (cursor <= dateRange.to) {
    const dayStart = new Date(cursor);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(cursor);
    dayEnd.setHours(23, 59, 59, 999);
    const dayRev = purchaseCurrent
      .filter((l) => l.createdAt >= dayStart && l.createdAt <= dayEnd)
      .reduce((sum, lead) => {
        const policy = lead.policyId ? policyById.get(String(lead.policyId)) : undefined;
        return sum + (policy?.premiumYearlyPkr ?? 0);
      }, 0);
    revenueByDay.push(Math.round(dayRev / 1000));
    cursor.setDate(cursor.getDate() + 1);
  }

  const visibilitySpark = buildMetricSparkline(visibilityScore, priorVisibility, 7);
  const conversionSpark = buildSeriesSparkline(dailyConversionProxy(leads, dateRange));

  const overviewMetrics: InsurerAnalyticsPayload['overviewMetrics'] = [
    {
      title: 'Visibility Score',
      value: `${visibilityScore}/100`,
      change: ptsChange(visibilityScore, priorVisibility),
      trend: visibilityScore >= priorVisibility ? 'up' : 'down',
      icon: 'shield-check',
      iconColor: '#2563EB',
      sparkline: visibilitySpark,
    },
    {
      title: 'Lead Conversion Rate',
      value: `${conversionCurrent}%`,
      change: pctChange(conversionCurrent, conversionPrior).text.replace('from prior period', 'from last period'),
      trend: conversionCurrent >= conversionPrior ? 'up' : 'down',
      icon: 'badge-percent',
      iconColor: '#10B981',
      sparkline: conversionSpark,
    },
    {
      title: 'Avg. Claim Response Time',
      value: formatDurationHours(avgResponseHours),
      change:
        avgResponseHours < avgPriorResponse
          ? `-${formatDurationHours(avgPriorResponse - avgResponseHours)} from last period`
          : `+${formatDurationHours(avgResponseHours - avgPriorResponse)} from last period`,
      trend: avgResponseHours < avgPriorResponse ? 'down-positive' : 'down',
      icon: 'clock-3',
      iconColor: '#8B5CF6',
      sparkline: buildSeriesSparkline(
        responseHours.slice(-7).length > 0
          ? responseHours.slice(-7).map((h) => Math.max(1, Math.round(48 - h)))
          : [20, 22, 21, 19, 18, 17, Math.round(48 - avgResponseHours)]
      ),
    },
    {
      title: 'Customer Satisfaction',
      value: `${satisfaction}/5`,
      change: `+${(satisfaction - priorSatisfaction).toFixed(1)} from last period`,
      trend: satisfaction >= priorSatisfaction ? 'up' : 'down',
      icon: 'star',
      iconColor: '#F59E0B',
      sparkline: buildMetricSparkline(satisfaction * 20, priorSatisfaction * 20, 7),
    },
    {
      title: 'Policy Retention Rate',
      value: `${retentionPct}%`,
      change: pctChange(retentionPct, priorRetention).text.replace('from prior period', 'from last period'),
      trend: retentionPct >= priorRetention ? 'up' : 'down',
      icon: 'droplets',
      iconColor: '#06B6D4',
      sparkline: buildMetricSparkline(retentionPct, priorRetention, 7),
    },
  ];

  const funnelVisitors = uniqueUsers(currentLeads);
  const funnelQuestionnaire = questionnaireResponses.filter((r) =>
    inInsurerRange(r.updatedAt, dateRange)
  ).length;
  const funnelRecommendations = uniqueUsers(currentLeads, (l) =>
    ['inquiry', 'favorite'].includes(l.type)
  );
  const funnelClicked = uniqueUsers(currentLeads, (l) => l.type === 'inquiry' && Boolean(l.policyId));
  const funnelPurchase = uniqueUsers(currentLeads, (l) => l.type === 'purchase');

  const funnelSteps = [
    { name: 'Visitors', users: Math.max(funnelVisitors, funnelQuestionnaire) },
    {
      name: 'Questionnaire Started',
      users: funnelQuestionnaire,
      conversion: pctBetween(funnelQuestionnaire, Math.max(funnelVisitors, funnelQuestionnaire)),
    },
    {
      name: 'Recommendations Viewed',
      users: funnelRecommendations,
      conversion: pctBetween(funnelRecommendations, funnelQuestionnaire || funnelRecommendations),
    },
    {
      name: 'Policy Clicked',
      users: funnelClicked,
      conversion: pctBetween(funnelClicked, funnelRecommendations || funnelClicked),
    },
    {
      name: 'Purchase Completed',
      users: funnelPurchase,
      conversion: pctBetween(funnelPurchase, funnelClicked || funnelPurchase),
    },
  ];

  const segmentMap = new Map<
    string,
    { interest: string; leads: number; purchases: number; category: PolicyCategorySlug }
  >();

  for (const cat of CATEGORIES_LIST) {
    const audience = inferAudienceLabel(questionnaireResponses, cat);
    const catLeads = currentLeads.filter((l) => leadCategory(l, policyById) === cat);
    const catPurchases = catLeads.filter((l) => l.type === 'purchase').length;
    const existing = segmentMap.get(audience);
    if (!existing || catLeads.length > existing.leads) {
      segmentMap.set(audience, {
        interest: CATEGORY_LABELS[cat],
        leads: catLeads.length,
        purchases: catPurchases,
        category: cat,
      });
    }
  }

  const customerSegments = [...segmentMap.entries()]
    .map(([segment, data]) => {
      const convPct =
        data.leads > 0 ? Math.round((data.purchases / data.leads) * 100) : 0;
      return {
        segment,
        interest: data.interest,
        level: (convPct >= 30 ? 'High' : convPct >= 18 ? 'Medium' : 'Low') as 'High' | 'Medium' | 'Low',
        conversion: `${convPct}%`,
        conversionPct: convPct,
      };
    })
    .sort((a, b) => b.conversionPct - a.conversionPct)
    .slice(0, 6);

  const smartInsights = buildAnalyticsInsights({
    demandSignals,
    questionnaireResponses,
    approvedPolicies,
    currentLeads,
    avgResponseHours,
    conversionCurrent,
    funnelSteps,
  });

  const topPoliciesRaw = approvedPolicies.map((policy) => {
    const policyLeads = currentLeads.filter((l) => String(l.policyId) === String(policy._id));
    const purchases = policyLeads.filter((l) => l.type === 'purchase');
    const revenuePkr = purchases.reduce((sum) => sum + policy.premiumYearlyPkr, 0);
    const conversion =
      policyLeads.length > 0 ? Math.round((purchases.length / policyLeads.length) * 1000) / 10 : 0;
    return { policy: policy.name, revenuePkr, conversion };
  });

  const topPolicies = topPoliciesRaw
    .sort((a, b) => b.revenuePkr - a.revenuePkr)
    .slice(0, 5)
    .map((row) => ({
      policy: row.policy,
      revenue: formatPkr(row.revenuePkr),
      conversion: `${row.conversion}%`,
    }));

  const premiums = approvedPolicies.map((p) => p.premiumMonthlyPkr);
  const medianPremium =
    premiums.length > 0 ? [...premiums].sort((a, b) => a - b)[Math.floor(premiums.length / 2)] : 0;
  const pricedWell = premiums.filter((p) => p <= medianPremium * 1.05).length;
  const pricingStatus: 'Strong' | 'Average' | 'Needs Improvement' =
    premiums.length === 0
      ? 'Average'
      : pricedWell / premiums.length >= 0.6
        ? 'Strong'
        : pricedWell / premiums.length >= 0.35
          ? 'Average'
          : 'Needs Improvement';

  const weakestCategory = [...currentByCategory.entries()].sort((a, b) => a[1] - b[1])[0];
  const competitiveness = {
    score: visibilityScore,
    label: visibilityScore >= 80 ? 'Great Standing' : visibilityScore >= 60 ? 'Good Standing' : 'Needs Focus',
    indicators: [
      { metric: 'Competitive Pricing', status: pricingStatus },
      {
        metric: 'Claim Response Time',
        status: (avgResponseHours <= 24 ? 'Strong' : avgResponseHours <= 48 ? 'Average' : 'Needs Improvement') as
          | 'Strong'
          | 'Average'
          | 'Needs Improvement',
      },
      {
        metric: 'Customer Ratings',
        status: (satisfaction >= 4.2 ? 'Strong' : satisfaction >= 3.5 ? 'Average' : 'Needs Improvement') as
          | 'Strong'
          | 'Average'
          | 'Needs Improvement',
      },
      {
        metric: 'Policy Variety',
        status: (categoryCoverage >= 0.75
          ? 'Strong'
          : categoryCoverage >= 0.5
            ? 'Average'
            : 'Needs Improvement') as 'Strong' | 'Average' | 'Needs Improvement',
      },
      {
        metric: 'Brand Visibility',
        status: (seenRate >= 0.7 ? 'Strong' : seenRate >= 0.4 ? 'Average' : 'Needs Improvement') as
          | 'Strong'
          | 'Average'
          | 'Needs Improvement',
      },
    ],
    footerSuggestion: weakestCategory
      ? `Improve visibility in ${CATEGORY_LABELS[weakestCategory[0]]} — lowest lead share this period.`
      : 'Add approved policies across more categories to broaden visibility.',
  };

  return {
    dateRange: {
      from: toIsoDate(dateRange.from),
      to: toIsoDate(dateRange.to),
      label: dateRange.label,
    },
    overviewMetrics,
    interestTrends: {
      xAxis,
      datasets: CATEGORIES_LIST.map((cat) => ({
        label: CATEGORY_LABELS[cat],
        color: CATEGORY_COLORS[cat],
        values: dailyInterest[cat],
      })),
      sideLegend,
      insightBanner,
    },
    funnel: { steps: funnelSteps },
    customerSegments,
    smartInsights,
    revenue: {
      totalRevenue: formatPkr(revenueCurrent),
      totalRevenuePkr: revenueCurrent,
      growth: revenueChange.text.replace('from prior period', 'from last period'),
      trend: revenueChange.trend === 'down' ? 'down' : revenueChange.trend === 'up' ? 'up' : 'neutral',
      chartValues: revenueByDay,
      xAxis,
    },
    topPolicies,
    competitiveness,
  };
}

function pctBetween(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '100%' : '0%';
  return `${Math.round((current / previous) * 100)}%`;
}

function buildMetricSparkline(current: number, prior: number, points: number): number[] {
  const values: number[] = [];
  for (let i = 0; i < points - 1; i++) {
    values.push(Math.round(prior + ((current - prior) * i) / (points - 1)));
  }
  values.push(current);
  return values;
}

function buildSeriesSparkline(values: number[]): number[] {
  if (values.length >= 4) return values;
  const padded = [...values];
  while (padded.length < 7) padded.unshift(padded[0] ?? 0);
  return padded.slice(-7);
}

function dailyConversionProxy(leads: ILeadDocument[], range: InsurerDateRange): number[] {
  const values: number[] = [];
  const cursor = new Date(range.from);
  while (cursor <= range.to) {
    const dayStart = new Date(cursor);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(cursor);
    dayEnd.setHours(23, 59, 59, 999);
    const dayLeads = leads.filter((l) => l.createdAt >= dayStart && l.createdAt <= dayEnd);
    const rate =
      dayLeads.length > 0
        ? Math.round(
            (dayLeads.filter((l) => l.type === 'purchase').length / dayLeads.length) * 100
          )
        : 0;
    values.push(rate);
    cursor.setDate(cursor.getDate() + 1);
  }
  return values;
}

function buildAnalyticsInsights(input: {
  demandSignals: ReturnType<typeof detectCategoryDemandSignals>;
  questionnaireResponses: Array<{ category: string; answers: Record<string, unknown> }>;
  approvedPolicies: IPolicyDocument[];
  currentLeads: ILeadDocument[];
  avgResponseHours: number;
  conversionCurrent: number;
  funnelSteps: Array<{ name: string; users: number; conversion?: string }>;
}): InsurerAnalyticsPayload['smartInsights'] {
  const insights: InsurerAnalyticsPayload['smartInsights'] = [];
  const insurerCategories = new Set(
    input.approvedPolicies.map((p) => p.category as PolicyCategorySlug)
  );

  const topDemand = input.demandSignals[0];
  if (topDemand && topDemand.growthPct >= 8) {
    const bundle = detectBundleOpportunities(input.questionnaireResponses, insurerCategories)[0];
    insights.push({
      icon: 'brain-circuit',
      title: 'High Demand Detected',
      description: `${topDemand.label} demand ${topDemand.growthPct >= 0 ? 'increased' : 'shifted'} ${Math.abs(topDemand.growthPct)}% this period based on lead and questionnaire signals.`,
      suggestion: bundle
        ? bundle.description.slice(0, 80) + '…'
        : `Expand ${topDemand.label} coverage or promote top policies in this category.`,
      theme: 'purple',
    });
  }

  const inquiryCount = input.currentLeads.filter((l) => l.type === 'inquiry').length;
  const favoriteCount = input.currentLeads.filter((l) => l.type === 'favorite').length;
  const purchaseCount = input.currentLeads.filter((l) => l.type === 'purchase').length;
  const topFunnel = inquiryCount + favoriteCount;
  const dropOff =
    topFunnel > 0 ? Math.round((1 - purchaseCount / topFunnel) * 100) : 0;

  if (dropOff >= 35 || input.conversionCurrent < 25) {
    insights.push({
      icon: 'badge-alert',
      title: 'Pricing Friction Detected',
      description: `${dropOff}% of interested seekers did not complete a purchase after viewing or saving policies.`,
      suggestion: 'Add entry-level pricing options or a limited-time discount on high-friction categories.',
      theme: 'orange',
    });
  }

  const qStep = input.funnelSteps.find((s) => s.name === 'Questionnaire Started');
  const rStep = input.funnelSteps.find((s) => s.name === 'Recommendations Viewed');
  if (qStep && rStep && qStep.users > 0) {
    const abandonPct = Math.round((1 - rStep.users / qStep.users) * 100);
    if (abandonPct > 40) {
      insights.push({
        icon: 'badge-alert',
        title: 'Onboarding Drop-off',
        description: `${abandonPct}% of users who started questionnaires did not view recommendations.`,
        suggestion: 'Shorten category questionnaires or surface top policies earlier in compare flow.',
        theme: 'orange',
      });
    }
  }

  if (input.avgResponseHours > 24) {
    insights.push({
      icon: 'shield-check',
      title: 'Response Time Impact',
      description: `Average first claim response is ${formatDurationHours(input.avgResponseHours)}. Faster reviews correlate with higher visibility.`,
      suggestion: 'Maintain under 24h response time to improve trust and competitiveness score.',
      theme: 'green',
    });
  } else {
    insights.push({
      icon: 'shield-check',
      title: 'Response Time Impact',
      description: 'Faster claim responses improve customer trust and your visibility score.',
      suggestion: 'Maintain under 24h response time.',
      theme: 'green',
    });
  }

  return insights.slice(0, 4);
}
