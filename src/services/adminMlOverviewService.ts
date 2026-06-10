import fs from 'fs';
import path from 'path';
import { ClaimRequest } from '../models/ClaimRequest';
import { KycVerification } from '../models/KycVerification';
import { Purchase } from '../models/Purchase';
import { QuestionnaireResponse } from '../models/QuestionnaireResponse';
import type { PolicyRankerCategory } from '../ml/types';
import { getAssistantUsageSummary } from './assistantUsageTracker';

const ARTIFACT_DIR = path.join(__dirname, '../ml/artifacts');

const CATEGORY_LABELS: Record<PolicyRankerCategory, string> = {
  home: 'Home insurance',
  auto: 'Auto insurance',
  life: 'Life insurance',
  pet: 'Pet insurance',
};

interface ArtifactMeta {
  version?: string;
  trainedAt?: string;
  metrics?: {
    accuracy?: number;
    roc_auc?: number;
    precision?: number;
    recall?: number;
    f1?: number;
    train_rows?: number;
    test_rows?: number;
  };
  category?: string;
}

export interface AdminMlModelInsight {
  id: string;
  title: string;
  subtitle: string;
  status: 'active' | 'missing';
  statusLabel: string;
  useCase: string;
  businessValue: string;
  whereUsed: string;
  metrics: Array<{ label: string; value: string; description?: string }>;
}

export interface AdminMlOverview {
  geminiUsage: ReturnType<typeof getAssistantUsageSummary>;
  summary: {
    activeModels: number;
    totalModels: number;
    aiReportAdoptionPct: number;
    verifiedIdentities: number;
    completedPurchases: number;
    questionnaireSeekers: number;
  };
  models: AdminMlModelInsight[];
  platformActivity: {
    claimsTotal: number;
    claimsWithAiReports: number;
    claimsLast24h: number;
    claimsWithAiLast24h: number;
    questionnaireResponses: number;
    questionnaireUniqueUsers: number;
    purchasesCompleted: number;
  };
  adoption: {
    aiReportRateLabel: string;
    kycVerifiedRateLabel: string;
    rankerCoverageLabel: string;
  };
  trends: {
    labels: string[];
    claimsSubmitted: number[];
    aiReportsGenerated: number[];
    questionnaireCompletions: number[];
  };
  insights: Array<{
    title: string;
    description: string;
    badge: string;
    theme: 'blue' | 'green' | 'purple' | 'amber';
  }>;
}

function readMeta(fileName: string): ArtifactMeta | null {
  const filePath = path.join(ARTIFACT_DIR, fileName);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as ArtifactMeta;
  } catch {
    return null;
  }
}

function artifactLoaded(fileName: string): boolean {
  return fs.existsSync(path.join(ARTIFACT_DIR, fileName));
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function formatPct(value: number): string {
  return `${value}%`;
}

function formatMetricPct(value?: number): string {
  if (value == null) return '—';
  return `${Math.round(value * 1000) / 10}%`;
}

function buildClaimRiskInsight(): AdminMlModelInsight {
  const loaded = artifactLoaded('claim_risk_v1.json');
  const meta = readMeta('claim_risk_v1.meta.json');
  return {
    id: 'claim-risk',
    title: 'Claim fraud & risk scoring',
    subtitle: 'Flags high-risk claims before insurers approve payouts',
    status: loaded ? 'active' : 'missing',
    statusLabel: loaded ? 'Live on platform' : 'Model not deployed',
    useCase:
      'Scores every claim submission for fraud signals, amount anomalies, and evidence gaps so insurers can prioritize review queues.',
    businessValue:
      'Reduces manual review load and helps catch suspicious claims early — surfaced in insurer claim cards and AI intelligence reports.',
    whereUsed: 'Insurer Claims tab · Claim AI reports · Admin fraud signals',
    metrics: [
      {
        label: 'Overall correctness',
        value: formatMetricPct(meta?.metrics?.accuracy),
        description: 'How often the model’s risk prediction matched reality in practice tests.',
      },
      {
        label: 'Ranking quality',
        value: formatMetricPct(meta?.metrics?.roc_auc),
        description: 'How well the model separates risky claims from routine ones.',
      },
      {
        label: 'Practice dataset size',
        value: meta?.metrics?.train_rows?.toLocaleString() ?? '—',
        description: 'Number of historical examples used to train this model.',
      },
    ],
  };
}

function buildFraudInsight(): AdminMlModelInsight {
  const loaded = artifactLoaded('fraud_v1.json');
  const meta = readMeta('fraud_v1.meta.json');
  return {
    id: 'fraud-detection',
    title: 'Platform fraud detection',
    subtitle: 'Monitors accounts, commerce, and catalog abuse patterns',
    status: loaded ? 'active' : 'missing',
    statusLabel: loaded ? 'Live on platform' : 'Model not deployed',
    useCase:
      'Detects suspicious signup, purchase, and catalog patterns across ClearClever — powering the Super Admin fraud dashboard.',
    businessValue:
      'Protects insurers and seekers from coordinated abuse before it spreads across the marketplace.',
    whereUsed: 'Super Admin → Fraud Detection · Risk signal queue',
    metrics: [
      {
        label: 'Correct fraud alerts',
        value: formatMetricPct(meta?.metrics?.precision),
        description: 'Of all fraud flags raised, how many were truly suspicious.',
      },
      {
        label: 'Fraud caught',
        value: formatMetricPct(meta?.metrics?.recall),
        description: 'Of all actual fraud patterns, how much the model detected.',
      },
      {
        label: 'Overall balance',
        value: formatMetricPct(meta?.metrics?.f1),
        description: 'Combined score when both precision and recall matter equally.',
      },
    ],
  };
}

function buildRankerInsights(): AdminMlModelInsight[] {
  const categories: PolicyRankerCategory[] = ['home', 'auto', 'life', 'pet'];
  return categories.map((category) => {
    const loaded = artifactLoaded(`policy_ranker_${category}_v1.json`);
    const meta = readMeta(`policy_ranker_${category}_v1.meta.json`);
    return {
      id: `ranker-${category}`,
      title: `${CATEGORY_LABELS[category]} recommender`,
      subtitle: 'Hybrid ML + rules ranking for policy comparison',
      status: loaded ? 'active' : 'missing',
      statusLabel: loaded ? 'Ranking live' : 'Awaiting model export',
      useCase: `Ranks ${CATEGORY_LABELS[category].toLowerCase()} policies for each seeker based on questionnaire answers and engagement signals.`,
      businessValue:
        'Drives higher-quality recommendations in Compare Policies — improving lead quality for insurers.',
      whereUsed: 'Seeker Compare Policies · Questionnaire results · Insurer lead analytics',
      metrics: [
        {
          label: 'Overall correctness',
          value: formatMetricPct(meta?.metrics?.accuracy),
          description: 'How often recommended policies matched seeker needs in test data.',
        },
        {
          label: 'Ranking quality',
          value: formatMetricPct(meta?.metrics?.roc_auc),
          description: 'How well the ranker separates strong matches from weak ones.',
        },
        {
          label: 'Validation dataset size',
          value: meta?.metrics?.test_rows?.toLocaleString() ?? '—',
          description: 'Number of held-out examples used to validate recommendations.',
        },
      ],
    };
  });
}

function buildGeminiInsight(usage: ReturnType<typeof getAssistantUsageSummary>): AdminMlModelInsight {
  return {
    id: 'gemini-vision',
    title: 'Gemini AI intelligence layer',
    subtitle: 'Vision + structured analysis for claims and identity',
    status: 'active',
    statusLabel: usage.totalApiCalls > 0 ? 'Processing requests' : 'Ready',
    useCase:
      'Powers claim evidence analysis, CNIC document verification, and the ClearClever assistant — combining vision with structured JSON outputs.',
    businessValue:
      'Turns uploaded documents into insurer-ready intelligence reports and verified identity checks without manual data entry.',
    whereUsed: 'Claim wizard · KYC verification · Support assistant · Policy explainers',
    metrics: [
      { label: 'Claim AI calls', value: String(usage.claimIntelligenceApiCalls ?? 0) },
      { label: 'KYC AI calls', value: String(usage.kycApiCalls ?? 0) },
      { label: 'Tokens used', value: usage.totalTokens.toLocaleString() },
    ],
  };
}

async function buildTrendSeries(): Promise<AdminMlOverview['trends']> {
  const labels: string[] = [];
  const claimsSubmitted: number[] = [];
  const aiReportsGenerated: number[] = [];
  const questionnaireCompletions: number[] = [];

  for (let i = 6; i >= 0; i -= 1) {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() - i);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    labels.push(
      dayStart.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    );

    const [claims, aiClaims, questionnaires] = await Promise.all([
      ClaimRequest.countDocuments({ createdAt: { $gte: dayStart, $lte: dayEnd } }),
      ClaimRequest.countDocuments({
        createdAt: { $gte: dayStart, $lte: dayEnd },
        intelligenceReport: { $exists: true, $ne: null },
      }),
      QuestionnaireResponse.countDocuments({ updatedAt: { $gte: dayStart, $lte: dayEnd } }),
    ]);

    claimsSubmitted.push(claims);
    aiReportsGenerated.push(aiClaims);
    questionnaireCompletions.push(questionnaires);
  }

  return { labels, claimsSubmitted, aiReportsGenerated, questionnaireCompletions };
}

export async function buildAdminMlOverview(): Promise<AdminMlOverview> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const geminiUsage = getAssistantUsageSummary();

  const [
    totalClaims,
    withReport,
    last24hClaims,
    last24hAiClaims,
    questionnaireDocs,
    completedPurchases,
    verifiedKyc,
    trends,
  ] = await Promise.all([
    ClaimRequest.countDocuments(),
    ClaimRequest.countDocuments({ intelligenceReport: { $exists: true, $ne: null } }),
    ClaimRequest.countDocuments({ createdAt: { $gte: since24h } }),
    ClaimRequest.countDocuments({
      createdAt: { $gte: since24h },
      intelligenceReport: { $exists: true, $ne: null },
    }),
    QuestionnaireResponse.find().select('userId').lean(),
    Purchase.countDocuments({ status: 'completed' }),
    KycVerification.countDocuments({ status: 'verified', identityVerified: true }),
    buildTrendSeries(),
  ]);

  const uniqueQuestionnaireUsers = new Set(questionnaireDocs.map((doc) => String(doc.userId)));
  const rankerInsights = buildRankerInsights();
  const tabularModels = [buildClaimRiskInsight(), buildFraudInsight(), ...rankerInsights];
  const geminiInsight = buildGeminiInsight(geminiUsage);
  const models = [geminiInsight, ...tabularModels];
  const activeModels = tabularModels.filter((model) => model.status === 'active').length;
  const totalModels = tabularModels.length;
  const aiReportAdoptionPct = pct(withReport, totalClaims);
  const activeRankers = rankerInsights.filter((model) => model.status === 'active').length;

  const insights: AdminMlOverview['insights'] = [
    {
      title: 'AI-assisted claims are growing',
      description:
        totalClaims > 0
          ? `${formatPct(aiReportAdoptionPct)} of all claims include a Gemini intelligence report — giving insurers structured evidence review before approval.`
          : 'Claims intelligence activates as soon as seekers submit their first claim with AI analysis.',
      badge: `${withReport} AI reports`,
      theme: 'blue',
    },
    {
      title: 'Recommendation engine coverage',
      description:
        activeRankers === 4
          ? 'All four insurance categories have live ML rankers powering personalized policy recommendations.'
          : `${activeRankers} of 4 category rankers are live. Export remaining models from the ML pipeline to unlock full hybrid recommendations.`,
      badge: `${activeRankers}/4 categories`,
      theme: 'green',
    },
    {
      title: 'Verified identities on platform',
      description:
        verifiedKyc > 0
          ? `${verifiedKyc} seeker identities passed CNIC verification aligned with purchased policies — improving trust for insurers at checkout and claims.`
          : 'KYC verification links CNIC documents to policyholder details on completed purchases.',
      badge: `${verifiedKyc} verified`,
      theme: 'purple',
    },
    {
      title: 'Seeker engagement signals',
      description: `${uniqueQuestionnaireUsers.size} unique seekers completed ${questionnaireDocs.length} questionnaires — feeding ML features for ranking, analytics, and fraud detection.`,
      badge: `${questionnaireDocs.length} responses`,
      theme: 'amber',
    },
  ];

  return {
    geminiUsage,
    summary: {
      activeModels,
      totalModels,
      aiReportAdoptionPct,
      verifiedIdentities: verifiedKyc,
      completedPurchases,
      questionnaireSeekers: uniqueQuestionnaireUsers.size,
    },
    models,
    platformActivity: {
      claimsTotal: totalClaims,
      claimsWithAiReports: withReport,
      claimsLast24h: last24hClaims,
      claimsWithAiLast24h: last24hAiClaims,
      questionnaireResponses: questionnaireDocs.length,
      questionnaireUniqueUsers: uniqueQuestionnaireUsers.size,
      purchasesCompleted: completedPurchases,
    },
    adoption: {
      aiReportRateLabel: formatPct(aiReportAdoptionPct),
      kycVerifiedRateLabel:
        completedPurchases > 0
          ? formatPct(pct(verifiedKyc, completedPurchases))
          : `${verifiedKyc} verified`,
      rankerCoverageLabel: `${activeRankers} of 4 categories live`,
    },
    trends,
    insights,
  };
}
