import type { Types } from 'mongoose';
import type { PolicyCategorySlug } from '../constants/categories';
import type { LeadSource } from './leadTrackingService';
import { ClaimRequest } from '../models/ClaimRequest';
import { Lead } from '../models/Lead';
import type { ILeadDocument } from '../models/Lead';
import { Policy } from '../models/Policy';
import type { IPolicyDocument } from '../models/Policy';
import { Purchase } from '../models/Purchase';
import type { IPurchaseDocument } from '../models/Purchase';
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
  buildInsurerFunnel,
  countLeadSources,
  uniquePurchasersInRange,
  uniqueSeekersInRange,
} from './insurerFunnelService';
import {
  detectBundleOpportunities,
  detectCategoryDemandSignals,
  inferAudienceLabel,
} from './insurerSignalAnalysis';
import { getLatestKycByUserIds } from './kycService';
import { buildCustomerDemographics } from './kycDemographicsService';
import { buildUsersByPakistanRegion, type PakistanRegionSlug } from './pakistanRegionStats';

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

const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  recommend: 'Recommendations',
  compare: 'Compare',
  favorite: 'Saved',
  message: 'Messages',
  checkout: 'Checkout',
  purchase: 'Purchases',
};

function pctChange(current: number, previous: number): { text: string; trend: 'up' | 'down' | 'neutral' } {
  if (previous === 0) {
    if (current === 0) return { text: 'No prior period data', trend: 'neutral' };
    return { text: `+${Math.round(current)} vs prior period`, trend: 'up' };
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

function leadSource(lead: ILeadDocument): LeadSource | null {
  const raw = lead.metadata?.source;
  if (typeof raw === 'string') return raw as LeadSource;
  if (lead.type === 'purchase') return 'purchase';
  if (lead.type === 'favorite') return 'favorite';
  if (lead.type === 'inquiry') return 'recommend';
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

function dailyLeadCount(leads: ILeadDocument[], range: InsurerDateRange): number[] {
  const values: number[] = [];
  const cursor = new Date(range.from);
  while (cursor <= range.to) {
    const dayStart = new Date(cursor);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(cursor);
    dayEnd.setHours(23, 59, 59, 999);
    values.push(
      leads.filter((l) => l.createdAt >= dayStart && l.createdAt <= dayEnd).length
    );
    cursor.setDate(cursor.getDate() + 1);
  }
  return values;
}

function dailyPurchaseCount(
  leads: ILeadDocument[],
  purchases: IPurchaseDocument[],
  range: InsurerDateRange
): number[] {
  const values: number[] = [];
  const cursor = new Date(range.from);
  while (cursor <= range.to) {
    const dayStart = new Date(cursor);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(cursor);
    dayEnd.setHours(23, 59, 59, 999);
    const leadPurchases = leads.filter(
      (l) =>
        l.type === 'purchase' &&
        l.createdAt >= dayStart &&
        l.createdAt <= dayEnd
    ).length;
    const completedPurchases = purchases.filter(
      (p) =>
        p.status === 'completed' &&
        p.completedAt &&
        p.completedAt >= dayStart &&
        p.completedAt <= dayEnd
    ).length;
    values.push(Math.max(leadPurchases, completedPurchases));
    cursor.setDate(cursor.getDate() + 1);
  }
  return values;
}

function buildSeriesSparkline(values: number[]): number[] {
  if (values.length >= 4) return values;
  const padded = [...values];
  while (padded.length < 7) padded.unshift(padded[0] ?? 0);
  return padded.slice(-7);
}

export interface InsurerAnalyticsMetric {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral' | 'down-positive';
  icon: string;
  iconColor: string;
  definition: string;
  whyItMatters: string;
  sparkline: number[];
}

export interface InsurerAnalyticsPayload {
  dateRange: { from: string; to: string; label: string };
  overviewMetrics: InsurerAnalyticsMetric[];
  interestTrends: {
    title: string;
    definition: string;
    xAxis: string[];
    datasets: Array<{ key: string; label: string; color: string; values: number[] }>;
    sideLegend: Array<{ label: string; percentage: string; trend: string }>;
    insightBanner: { text: string; badge: string };
  };
  funnel: {
    title: string;
    definition: string;
    steps: Array<{ name: string; users: number; conversion?: string; dropOff?: number }>;
  };
  leadSources: Array<{ source: string; label: string; count: number; sharePct: number }>;
  customerSegments: Array<{
    segment: string;
    category: string;
    seekers: number;
    leads: number;
    purchaseRate: string;
    purchaseRatePct: number;
    opportunity: 'High' | 'Medium' | 'Low';
  }>;
  smartInsights: Array<{
    icon: string;
    title: string;
    description: string;
    evidence: string;
    suggestion: string;
    theme: 'purple' | 'orange' | 'green' | 'blue';
  }>;
  revenue: {
    title: string;
    definition: string;
    totalRevenue: string;
    totalRevenuePkr: number;
    growth: string;
    trend: 'up' | 'down' | 'neutral';
    chartValues: number[];
    xAxis: string[];
  };
  policyPerformance: Array<{
    policy: string;
    recommended: number;
    saved: number;
    checkouts: number;
    sold: number;
    premiumPkr: number;
    premiumFormatted: string;
    purchaseRatePct: number;
    purchaseRate: string;
  }>;
  operations: Array<{
    metric: string;
    value: string;
    status: 'Strong' | 'Needs attention';
    definition: string;
    whyItMatters: string;
  }>;
  usersByRegion: {
    title: string;
    subtitle: string;
    totalUsers: number;
    mappedUsers: number;
    coverageNote?: string;
    regions: Array<{
      slug: string;
      label: string;
      color: string;
      userCount: number;
    }>;
  };
  usersByRegionLifetime: InsurerAnalyticsPayload['usersByRegion'];
  customerDemographics: import('./kycDemographicsService').CustomerDemographicsPayload;
}

export async function buildInsurerAnalytics(
  insurerProfileId: Types.ObjectId | string,
  options?: { from?: string; to?: string }
): Promise<InsurerAnalyticsPayload> {
  const dateRange = parseInsurerDateRange(options?.from, options?.to);
  const priorRange = previousInsurerRange(dateRange);

  const [policies, leads, claims, purchases] = await Promise.all([
    Policy.find({ insurerProfileId }).sort({ updatedAt: -1 }),
    Lead.find({ insurerProfileId }).sort({ createdAt: -1 }),
    ClaimRequest.find({ insurerProfileId }).sort({ createdAt: -1 }),
    Purchase.find({ insurerProfileId }).sort({ updatedAt: -1 }),
  ]);

  const policyById = new Map(policies.map((p) => [String(p._id), p]));
  const approvedPolicies = policies.filter((p) => p.status === 'approved');
  const leadUserIds = [...new Set(leads.map((l) => l.userId))];

  const questionnaireDocs =
    leadUserIds.length > 0
      ? await QuestionnaireResponse.find({ userId: { $in: leadUserIds } }).sort({ updatedAt: -1 })
      : [];

  const questionnaireResponses = questionnaireDocs.map((doc) => ({
    category: doc.category,
    answers: doc.answers as Record<string, unknown>,
    updatedAt: doc.updatedAt,
    userId: String(doc.userId),
  }));

  const currentLeads = leads.filter((l) => inInsurerRange(l.createdAt, dateRange));
  const priorLeads = leads.filter((l) => inInsurerRange(l.createdAt, priorRange));

  const currentSeekers = uniqueSeekersInRange(leads, dateRange);
  const priorSeekers = uniqueSeekersInRange(leads, priorRange);
  const currentPurchasers = uniquePurchasersInRange(leads, purchases, dateRange);
  const priorPurchasers = uniquePurchasersInRange(leads, purchases, priorRange);

  const seekerPurchaseRate =
    currentSeekers.size > 0
      ? Math.round((currentPurchasers.size / currentSeekers.size) * 1000) / 10
      : 0;
  const priorSeekerPurchaseRate =
    priorSeekers.size > 0
      ? Math.round((priorPurchasers.size / priorSeekers.size) * 1000) / 10
      : 0;

  const unreadLeads = currentLeads.filter((l) => !l.seenAt).length;
  const policiesSold = currentPurchasers.size;
  const priorPoliciesSold = priorPurchasers.size;

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
  }).sort((a, b) => parseInt(b.percentage, 10) - parseInt(a.percentage, 10));

  const topGrowth = demandSignals[0];
  const priorTopCount = topGrowth ? (priorByCategory.get(topGrowth.category) ?? 0) : 0;
  const currentTopCount = topGrowth ? (currentByCategory.get(topGrowth.category) ?? 0) : 0;
  const insightBanner = topGrowth
    ? {
        text:
          topGrowth.growthPct > 0
            ? `${topGrowth.label} leads rose ${topGrowth.growthPct}% (${priorTopCount} → ${currentTopCount}) this period.`
            : `${topGrowth.label} leads: ${currentTopCount} events this period.`,
        badge: topGrowth.growthPct >= 15 ? 'High Growth' : topGrowth.growthPct >= 5 ? 'Growing' : 'Stable',
      }
    : {
        text: 'Lead activity is building across your categories this period.',
        badge: 'Stable',
      };

  let revenueCurrent = 0;
  for (const userId of currentPurchasers) {
    const userPurchaseLeads = currentLeads.filter(
      (l) => String(l.userId) === userId && l.type === 'purchase'
    );
    if (userPurchaseLeads.length > 0) {
      for (const lead of userPurchaseLeads) {
        const policy = lead.policyId ? policyById.get(String(lead.policyId)) : undefined;
        if (policy) revenueCurrent += policy.premiumYearlyPkr;
      }
      continue;
    }
    for (const purchase of purchases) {
      if (
        String(purchase.userId) === userId &&
        purchase.status === 'completed' &&
        purchase.completedAt &&
        inInsurerRange(purchase.completedAt, dateRange)
      ) {
        const policy = policyById.get(String(purchase.policyId));
        if (policy) revenueCurrent += policy.premiumYearlyPkr;
      }
    }
  }

  const revenuePrior = [...priorPurchasers].reduce((sum, userId) => {
    const userPurchaseLeads = priorLeads.filter(
      (l) => String(l.userId) === userId && l.type === 'purchase'
    );
    for (const lead of userPurchaseLeads) {
      const policy = lead.policyId ? policyById.get(String(lead.policyId)) : undefined;
      if (policy) sum += policy.premiumYearlyPkr;
    }
    return sum;
  }, 0);
  const revenueChange = pctChange(revenueCurrent, revenuePrior);

  const revenueByDay: number[] = [];
  const revCursor = new Date(dateRange.from);
  while (revCursor <= dateRange.to) {
    const dayStart = new Date(revCursor);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(revCursor);
    dayEnd.setHours(23, 59, 59, 999);
    let dayRev = 0;
    for (const lead of currentLeads) {
      if (lead.type !== 'purchase') continue;
      if (lead.createdAt < dayStart || lead.createdAt > dayEnd) continue;
      const policy = lead.policyId ? policyById.get(String(lead.policyId)) : undefined;
      dayRev += policy?.premiumYearlyPkr ?? 0;
    }
    revenueByDay.push(Math.round(dayRev / 1000));
    revCursor.setDate(revCursor.getDate() + 1);
  }

  const seekersChange = pctChange(currentSeekers.size, priorSeekers.size);
  const leadsChange = pctChange(currentLeads.length, priorLeads.length);
  const conversionChange = pctChange(seekerPurchaseRate, priorSeekerPurchaseRate);
  const soldChange = pctChange(policiesSold, priorPoliciesSold);

  const overviewMetrics: InsurerAnalyticsMetric[] = [
    {
      title: 'Active Seekers',
      value: String(currentSeekers.size),
      change: seekersChange.text,
      trend: seekersChange.trend === 'down' ? 'down' : seekersChange.trend === 'up' ? 'up' : 'neutral',
      icon: 'users',
      iconColor: '#2563EB',
      definition:
        'Unique policy seekers who generated at least one lead for your policies in this date range.',
      whyItMatters:
        'Shows how many distinct people showed interest in your products on ClearClever this period.',
      sparkline: buildSeriesSparkline(dailyLeadCount(currentLeads, dateRange).map((_, i) => {
        const daySeekers = new Set<string>();
        const cursor = new Date(dateRange.from);
        cursor.setDate(cursor.getDate() + i);
        const dayStart = new Date(cursor);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(cursor);
        dayEnd.setHours(23, 59, 59, 999);
        for (const lead of currentLeads) {
          if (lead.createdAt >= dayStart && lead.createdAt <= dayEnd) {
            daySeekers.add(String(lead.userId));
          }
        }
        return daySeekers.size;
      })),
    },
    {
      title: 'New Lead Events',
      value: String(currentLeads.length),
      change: `${unreadLeads} unread · ${leadsChange.text}`,
      trend: unreadLeads > currentLeads.length * 0.5 ? 'down' : 'up',
      icon: 'inbox',
      iconColor: '#10B981',
      definition:
        'Total lead records created (recommendations, saves, messages, checkouts, purchases). Unread = not yet opened in your Leads tab.',
      whyItMatters:
        'Volume of sales signals plus whether your team is reviewing incoming interest promptly.',
      sparkline: buildSeriesSparkline(dailyLeadCount(currentLeads, dateRange)),
    },
    {
      title: 'Seeker → Purchase Rate',
      value: `${seekerPurchaseRate}%`,
      change: conversionChange.text,
      trend:
        seekerPurchaseRate >= priorSeekerPurchaseRate
          ? 'up'
          : seekerPurchaseRate < priorSeekerPurchaseRate
            ? 'down'
            : 'neutral',
      icon: 'badge-percent',
      iconColor: '#8B5CF6',
      definition:
        'Unique purchasers divided by unique seekers in this period (user-level, not lead events).',
      whyItMatters:
        'Your true conversion rate — how many interested seekers actually bought a policy.',
      sparkline: buildSeriesSparkline(
        dailyPurchaseCount(currentLeads, purchases, dateRange).map((purchasesOnDay, i) => {
          const cursor = new Date(dateRange.from);
          cursor.setDate(cursor.getDate() + i);
          const dayStart = new Date(cursor);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(cursor);
          dayEnd.setHours(23, 59, 59, 999);
          const daySeekers = new Set<string>();
          for (const lead of currentLeads) {
            if (lead.createdAt >= dayStart && lead.createdAt <= dayEnd) {
              daySeekers.add(String(lead.userId));
            }
          }
          return daySeekers.size > 0
            ? Math.round((purchasesOnDay / daySeekers.size) * 100)
            : 0;
        })
      ),
    },
    {
      title: 'Policies Sold',
      value: String(policiesSold),
      change: soldChange.text,
      trend: soldChange.trend === 'down' ? 'down' : soldChange.trend === 'up' ? 'up' : 'neutral',
      icon: 'shopping-bag',
      iconColor: '#F59E0B',
      definition: 'Completed purchases from seekers in this period.',
      whyItMatters: 'Concrete sales outcomes from your ClearClever pipeline.',
      sparkline: buildSeriesSparkline(dailyPurchaseCount(currentLeads, purchases, dateRange)),
    },
    {
      title: 'Annual Premium Volume',
      value: formatPkr(revenueCurrent),
      change: revenueChange.text,
      trend: revenueChange.trend === 'down' ? 'down' : revenueChange.trend === 'up' ? 'up' : 'neutral',
      icon: 'wallet',
      iconColor: '#06B6D4',
      definition:
        'Sum of yearly premiums on policies sold this period. This is projected annual premium value, not cash collected.',
      whyItMatters:
        'Estimates revenue potential from sales closed on ClearClever — useful for forecasting, not accounting.',
      sparkline: buildSeriesSparkline(revenueByDay),
    },
  ];

  const funnel = buildInsurerFunnel({
    currentLeads,
    purchases,
    questionnaireResponses: questionnaireResponses.map((r) => ({
      userId: r.userId,
      updatedAt: r.updatedAt,
    })),
    range: dateRange,
  });

  const sourceCounts = countLeadSources(leads, dateRange);
  const totalSourceLeads = [...sourceCounts.values()].reduce((a, b) => a + b, 0) || 1;
  const leadSources = (Object.keys(LEAD_SOURCE_LABELS) as LeadSource[])
    .map((source) => ({
      source,
      label: LEAD_SOURCE_LABELS[source],
      count: sourceCounts.get(source) ?? 0,
      sharePct: Math.round(((sourceCounts.get(source) ?? 0) / totalSourceLeads) * 100),
    }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);

  const segmentMap = new Map<
    string,
    {
      category: PolicyCategorySlug;
      categoryLabel: string;
      seekerIds: Set<string>;
      leads: number;
      purchases: number;
    }
  >();

  for (const cat of CATEGORIES_LIST) {
    const audience = inferAudienceLabel(questionnaireResponses, cat);
    const catLeads = currentLeads.filter((l) => leadCategory(l, policyById) === cat);
    const catPurchases = catLeads.filter((l) => l.type === 'purchase').length;
    const seekerIds = new Set(catLeads.map((l) => String(l.userId)));
    const existing = segmentMap.get(audience);
    if (!existing || catLeads.length > existing.leads) {
      segmentMap.set(audience, {
        category: cat,
        categoryLabel: CATEGORY_LABELS[cat],
        seekerIds,
        leads: catLeads.length,
        purchases: catPurchases,
      });
    }
  }

  const customerSegments = [...segmentMap.entries()]
    .map(([segment, data]) => {
      const seekers = data.seekerIds.size;
      const convPct = seekers > 0 ? Math.round((data.purchases / seekers) * 100) : 0;
      const volumeScore = seekers >= 5 ? 2 : seekers >= 2 ? 1 : 0;
      const rateScore = convPct >= 25 ? 2 : convPct >= 12 ? 1 : 0;
      const opportunityScore = volumeScore + rateScore;
      return {
        segment,
        category: data.categoryLabel,
        seekers,
        leads: data.leads,
        purchaseRate: `${convPct}%`,
        purchaseRatePct: convPct,
        opportunity: (opportunityScore >= 3
          ? 'High'
          : opportunityScore >= 2
            ? 'Medium'
            : 'Low') as 'High' | 'Medium' | 'Low',
      };
    })
    .sort((a, b) => b.purchaseRatePct - a.purchaseRatePct || b.seekers - a.seekers)
    .slice(0, 6);

  const policyPerformance = approvedPolicies
    .map((policy) => {
      const policyLeads = currentLeads.filter((l) => String(l.policyId) === String(policy._id));
      const recommended = policyLeads.filter(
        (l) => l.type === 'inquiry' && leadSource(l) === 'recommend'
      ).length;
      const saved = policyLeads.filter((l) => l.type === 'favorite').length;
      const checkouts = policyLeads.filter((l) => leadSource(l) === 'checkout').length;
      const sold = policyLeads.filter((l) => l.type === 'purchase').length;
      const topOfFunnel = recommended + saved + checkouts;
      const purchaseRatePct =
        topOfFunnel > 0 ? Math.round((sold / topOfFunnel) * 1000) / 10 : 0;
      const premiumPkr = sold * policy.premiumYearlyPkr;
      return {
        policy: policy.name,
        recommended,
        saved,
        checkouts,
        sold,
        premiumPkr,
        premiumFormatted: formatPkr(premiumPkr),
        purchaseRatePct,
        purchaseRate: `${purchaseRatePct}%`,
      };
    })
    .sort((a, b) => b.sold - a.sold || b.premiumPkr - a.premiumPkr)
    .slice(0, 8);

  const followUpRate =
    currentLeads.length > 0
      ? Math.round((currentLeads.filter((l) => l.seenAt).length / currentLeads.length) * 100)
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
      : 0;

  const pendingClaims = claims.filter((c) => c.status === 'submitted').length;
  const approvedCategories = new Set(approvedPolicies.map((p) => p.category));
  const demandCategories = [...currentByCategory.entries()]
    .filter(([, count]) => count > 0)
    .map(([cat]) => cat);
  const missingCategories = demandCategories.filter((cat) => !approvedCategories.has(cat));

  const insurerCategories = new Set(approvedPolicies.map((p) => p.category as PolicyCategorySlug));

  const periodUserIds = [...currentSeekers];
  const purchaserUserIds = [...currentPurchasers];
  const lifetimeUserIds = [
    ...new Set(
      purchases.filter((p) => p.status === 'completed').map((p) => String(p.userId))
    ),
  ];
  const questionnaireByUser = buildAnswersByUser(questionnaireResponses);
  const allLeadMetadataByUser = buildLeadMetadataByUser(leads);
  const leadMetadataByUser = buildLeadMetadataByUser(currentLeads);
  const purchaseAnswersByUser = buildPurchaseAnswersByUser(purchases, dateRange);
  const allPurchaseAnswersByUser = buildAllPurchaseAnswersByUser(purchases);

  const kycByUser = await getLatestKycByUserIds([
    ...new Set([...periodUserIds, ...purchaserUserIds, ...lifetimeUserIds]),
  ]);
  const kycRegionByUser = new Map<string, PakistanRegionSlug>();
  for (const [userId, kyc] of kycByUser) {
    if (kyc.regionSlug) kycRegionByUser.set(userId, kyc.regionSlug);
  }

  const smartInsights = buildAnalyticsInsights({
    demandSignals,
    questionnaireResponses,
    approvedPolicies,
    currentLeads,
    priorLeads,
    avgResponseHours,
    seekerPurchaseRate,
    funnelSteps: funnel.steps,
    unreadLeads,
    insurerCategories,
    missingCategories,
    policyPerformance,
    periodUserIds,
    regionRows: buildUsersByPakistanRegion({
      userIds: periodUserIds,
      questionnaireByUser,
      leadMetadataByUser,
      purchaseAnswersByUser,
      kycRegionByUser,
    }),
  });

  const regionRows = buildUsersByPakistanRegion({
    userIds: periodUserIds,
    questionnaireByUser,
    leadMetadataByUser,
    purchaseAnswersByUser,
    kycRegionByUser,
  });

  const lifetimeRegionRows = buildUsersByPakistanRegion({
    userIds: lifetimeUserIds,
    questionnaireByUser,
    leadMetadataByUser: allLeadMetadataByUser,
    purchaseAnswersByUser: allPurchaseAnswersByUser,
    kycRegionByUser,
  });

  const customerDemographics = buildCustomerDemographics({
    purchaserUserIds,
    kycByUser,
  });
  const mappedUsers = regionRows.reduce((sum, row) => sum + row.userCount, 0);
  const usersByRegion = {
    title: 'Seekers by region',
    subtitle: `Activity in ${dateRange.label} — mapped from city, KYC, and questionnaire answers`,
    totalUsers: periodUserIds.length,
    mappedUsers,
    coverageNote:
      mappedUsers < periodUserIds.length
        ? `${periodUserIds.length - mappedUsers} seeker(s) had no location data in this period.`
        : undefined,
    regions: regionRows,
  };

  const lifetimeMapped = lifetimeRegionRows.reduce((sum, row) => sum + row.userCount, 0);
  const usersByRegionLifetime = {
    title: 'All customers by region',
    subtitle: 'Cumulative map of everyone who completed a purchase — counts persist across sessions',
    totalUsers: lifetimeUserIds.length,
    mappedUsers: lifetimeMapped,
    coverageNote:
      lifetimeMapped < lifetimeUserIds.length
        ? `${lifetimeUserIds.length - lifetimeMapped} customer(s) had no locatable region data.`
        : undefined,
    regions: lifetimeRegionRows,
  };

  const operations = buildOperationsSnapshot({
    unreadLeads,
    followUpRate,
    avgResponseHours,
    pendingClaims,
    missingCategories,
    totalLeads: currentLeads.length,
  });

  return {
    dateRange: {
      from: toIsoDate(dateRange.from),
      to: toIsoDate(dateRange.to),
      label: dateRange.label,
    },
    overviewMetrics,
    interestTrends: {
      title: 'Lead activity by insurance category',
      definition:
        'Daily count of lead events grouped by policy category (recommendations, saves, messages, checkouts, purchases).',
      xAxis,
      datasets: CATEGORIES_LIST.map((cat) => ({
        key: cat,
        label: CATEGORY_LABELS[cat],
        color: CATEGORY_COLORS[cat],
        values: dailyInterest[cat],
      })),
      sideLegend,
      insightBanner,
    },
    funnel: {
      title: 'Seeker journey on ClearClever',
      definition:
        'Unique seekers at each stage based on questionnaires, lead sources, and purchase records. Drop-off shows seekers who did not reach the next step.',
      steps: funnel.steps,
    },
    leadSources,
    customerSegments,
    smartInsights,
    revenue: {
      title: 'Annual premium volume',
      definition:
        'Projected yearly premium from policies sold this period — not cash received.',
      totalRevenue: formatPkr(revenueCurrent),
      totalRevenuePkr: revenueCurrent,
      growth: revenueChange.text,
      trend: revenueChange.trend === 'down' ? 'down' : revenueChange.trend === 'up' ? 'up' : 'neutral',
      chartValues: revenueByDay,
      xAxis,
    },
    policyPerformance,
    operations,
    usersByRegion,
    usersByRegionLifetime,
    customerDemographics,
  };
}

function buildAnswersByUser(
  questionnaireResponses: Array<{ userId: string; answers: Record<string, unknown> }>
): Map<string, Record<string, unknown>[]> {
  const map = new Map<string, Record<string, unknown>[]>();
  for (const doc of questionnaireResponses) {
    const list = map.get(doc.userId) ?? [];
    list.push(doc.answers);
    map.set(doc.userId, list);
  }
  return map;
}

function buildLeadMetadataByUser(
  currentLeads: ILeadDocument[]
): Map<string, Record<string, unknown>[]> {
  const map = new Map<string, Record<string, unknown>[]>();
  for (const lead of currentLeads) {
    if (lead.metadata && typeof lead.metadata === 'object') {
      const userId = String(lead.userId);
      const list = map.get(userId) ?? [];
      list.push(lead.metadata as Record<string, unknown>);
      map.set(userId, list);
    }
  }
  return map;
}

function buildPurchaseAnswersByUser(
  purchases: IPurchaseDocument[],
  range: InsurerDateRange
): Map<string, Record<string, unknown>[]> {
  const map = new Map<string, Record<string, unknown>[]>();
  for (const purchase of purchases) {
    if (!inInsurerRange(purchase.createdAt, range)) continue;
    const userId = String(purchase.userId);
    const list = map.get(userId) ?? [];
    list.push(purchase.answers as Record<string, unknown>);
    map.set(userId, list);
  }
  return map;
}

function buildAllPurchaseAnswersByUser(
  purchases: IPurchaseDocument[]
): Map<string, Record<string, unknown>[]> {
  const map = new Map<string, Record<string, unknown>[]>();
  for (const purchase of purchases) {
    if (purchase.status !== 'completed') continue;
    const userId = String(purchase.userId);
    const list = map.get(userId) ?? [];
    list.push(purchase.answers as Record<string, unknown>);
    map.set(userId, list);
  }
  return map;
}

function buildOperationsSnapshot(input: {
  unreadLeads: number;
  followUpRate: number;
  avgResponseHours: number;
  pendingClaims: number;
  missingCategories: PolicyCategorySlug[];
  totalLeads: number;
}): InsurerAnalyticsPayload['operations'] {
  const categoryGapText =
    input.missingCategories.length > 0
      ? `Demand in ${input.missingCategories.map((c) => CATEGORY_LABELS[c]).join(', ')} without approved policies`
      : 'All active demand categories have approved policies';

  return [
    {
      metric: 'Unread leads',
      value: String(input.unreadLeads),
      status: input.unreadLeads === 0 ? 'Strong' : input.unreadLeads <= 5 ? 'Strong' : 'Needs attention',
      definition: 'Lead records not yet opened in your Leads tab.',
      whyItMatters: 'Unread leads are missed sales opportunities — review them promptly.',
    },
    {
      metric: 'Lead follow-up rate',
      value: `${input.followUpRate}%`,
      status: input.followUpRate >= 50 ? 'Strong' : 'Needs attention',
      definition: 'Share of lead events marked as seen in your Leads tab.',
      whyItMatters: 'Shows how consistently your team reviews incoming seeker interest.',
    },
    {
      metric: 'Avg claim review time',
      value: input.avgResponseHours > 0 ? formatDurationHours(input.avgResponseHours) : 'No reviews yet',
      status:
        input.avgResponseHours === 0 || input.avgResponseHours <= 48 ? 'Strong' : 'Needs attention',
      definition: 'Average time from claim submission to first status update (approved, rejected, or in review).',
      whyItMatters: 'Faster claim handling builds trust with policyholders on ClearClever.',
    },
    {
      metric: 'Pending claims',
      value: String(input.pendingClaims),
      status: input.pendingClaims <= 3 ? 'Strong' : 'Needs attention',
      definition: 'Claims awaiting your first review action.',
      whyItMatters: 'Your current claims workload — prioritize older submissions first.',
    },
    {
      metric: 'Category coverage',
      value: categoryGapText,
      status: input.missingCategories.length === 0 ? 'Strong' : 'Needs attention',
      definition: 'Whether you have approved policies in categories where seekers are generating leads.',
      whyItMatters: 'Gaps mean demand you cannot convert — consider adding products in those categories.',
    },
  ];
}

function buildAnalyticsInsights(input: {
  demandSignals: ReturnType<typeof detectCategoryDemandSignals>;
  questionnaireResponses: Array<{ category: string; answers: Record<string, unknown> }>;
  approvedPolicies: IPolicyDocument[];
  currentLeads: ILeadDocument[];
  priorLeads: ILeadDocument[];
  avgResponseHours: number;
  seekerPurchaseRate: number;
  funnelSteps: Array<{ name: string; users: number; dropOff?: number }>;
  unreadLeads: number;
  insurerCategories: Set<PolicyCategorySlug>;
  missingCategories: PolicyCategorySlug[];
  policyPerformance: InsurerAnalyticsPayload['policyPerformance'];
  periodUserIds: string[];
  regionRows: Array<{ slug: string; label: string; userCount: number }>;
}): InsurerAnalyticsPayload['smartInsights'] {
  type ScoredInsight = InsurerAnalyticsPayload['smartInsights'][number] & { priority: number };
  const insights: ScoredInsight[] = [];

  if (input.unreadLeads > 0) {
    insights.push({
      icon: 'inbox',
      title: 'Unread leads need attention',
      description: `${input.unreadLeads} lead event(s) have not been opened in your Leads tab.`,
      evidence: `${input.unreadLeads} unread of ${input.currentLeads.length} total leads this period`,
      suggestion: 'Open your Leads tab and review new inquiries — unread leads are missed opportunities.',
      theme: 'orange',
      priority: 100 + input.unreadLeads,
    });
  }

  const checkoutStep = input.funnelSteps.find((s) => s.name === 'Started checkout');
  const purchasedStep = input.funnelSteps.find((s) => s.name === 'Policy purchased');
  if (checkoutStep && purchasedStep && checkoutStep.users > 0) {
    const dropPct = Math.round((1 - purchasedStep.users / checkoutStep.users) * 100);
    if (dropPct >= 30) {
      const topPolicy = input.policyPerformance.find((p) => p.checkouts > 0 || p.sold > 0);
      insights.push({
        icon: 'badge-alert',
        title: 'Checkout drop-off detected',
        description: `${checkoutStep.users} seeker(s) started checkout; ${purchasedStep.users} completed (${dropPct}% drop-off).`,
        evidence: `${checkoutStep.users} checkout → ${purchasedStep.users} purchased`,
        suggestion: topPolicy
          ? `Review pricing and questionnaire length on "${topPolicy.policy}" — highest checkout activity.`
          : 'Review pricing on policies with checkout activity — seekers are dropping before purchase.',
        theme: 'orange',
        priority: 80 + dropPct,
      });
    }
  }

  const topDemand = input.demandSignals[0];
  if (topDemand && topDemand.growthPct >= 8) {
    const topRegion = [...input.regionRows].sort((a, b) => b.userCount - a.userCount)[0];
    const bundle = detectBundleOpportunities(input.questionnaireResponses, input.insurerCategories)[0];
    const regionNote = topRegion?.userCount
      ? ` Top region: ${topRegion.label} (${topRegion.userCount} seeker(s)).`
      : '';
    insights.push({
      icon: 'brain-circuit',
      title: 'Category demand rising',
      description: `${topDemand.label} leads ${topDemand.growthPct >= 0 ? 'increased' : 'shifted'} ${Math.abs(topDemand.growthPct)}% vs prior period.${regionNote}`,
      evidence: topDemand.reason,
      suggestion: bundle
        ? bundle.description
        : input.insurerCategories.has(topDemand.category)
          ? `Promote your ${topDemand.label.toLowerCase()} policies to capture this demand.`
          : `Add an approved ${topDemand.label.toLowerCase()} policy — demand exists but you have no product listed.`,
      theme: 'purple',
      priority: 60 + topDemand.growthPct,
    });
  }

  for (const cat of input.missingCategories) {
    insights.push({
      icon: 'badge-alert',
      title: 'Category gap',
      description: `Seekers generated ${CATEGORY_LABELS[cat]} leads but you have no approved policy in this category.`,
      evidence: `Active demand in ${CATEGORY_LABELS[cat]} without matching product`,
      suggestion: `Add an approved ${CATEGORY_LABELS[cat].toLowerCase()} policy to convert this demand.`,
      theme: 'blue',
      priority: 55,
    });
  }

  if (input.avgResponseHours > 24) {
    insights.push({
      icon: 'shield-check',
      title: 'Slow claim reviews',
      description: `Average claim review time is ${formatDurationHours(input.avgResponseHours)}.`,
      evidence: `Avg review time: ${formatDurationHours(input.avgResponseHours)}`,
      suggestion: 'Aim for under 24 hours on first claim review to maintain seeker trust.',
      theme: 'green',
      priority: 40,
    });
  } else if (input.seekerPurchaseRate < 10 && input.currentLeads.length >= 5) {
    insights.push({
      icon: 'badge-percent',
      title: 'Low purchase conversion',
      description: `Only ${input.seekerPurchaseRate}% of seekers purchased this period.`,
      evidence: `${input.seekerPurchaseRate}% seeker → purchase rate`,
      suggestion: 'Follow up on warm leads in your Leads tab and ensure pricing is competitive within your catalog.',
      theme: 'blue',
      priority: 35,
    });
  }

  return insights
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 4)
    .map(({ priority: _priority, ...rest }) => rest);
}
