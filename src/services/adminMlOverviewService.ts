import fs from 'fs';
import path from 'path';
import { ClaimRequest } from '../models/ClaimRequest';
import { QuestionnaireResponse } from '../models/QuestionnaireResponse';
import type { PolicyRankerCategory } from '../ml/types';
import { getAssistantUsageSummary } from './assistantUsageTracker';

export interface AdminMlOverview {
  geminiUsage: ReturnType<typeof getAssistantUsageSummary>;
  models: {
    claimRiskLoaded: boolean;
    claimRiskVersion: string | null;
    policyRankerCategories: string[];
  };
  claims: {
    total: number;
    withIntelligenceReport: number;
    last24h: number;
  };
  questionnaires: {
    totalResponses: number;
    uniqueUsers: number;
  };
}

const ARTIFACT_DIR = path.join(__dirname, '../ml/artifacts');

function claimRiskModelStatus(): { loaded: boolean; version: string | null } {
  const filePath = path.join(ARTIFACT_DIR, 'claim_risk_v1.json');
  if (!fs.existsSync(filePath)) {
    return { loaded: false, version: null };
  }
  try {
    const artifact = JSON.parse(fs.readFileSync(filePath, 'utf8')) as { version?: string };
    return { loaded: true, version: artifact.version ?? 'claim_risk_v1' };
  } catch {
    return { loaded: false, version: null };
  }
}

function loadedPolicyRankerCategories(): string[] {
  const categories: PolicyRankerCategory[] = ['home', 'auto', 'life', 'pet'];
  return categories.filter((category) =>
    fs.existsSync(path.join(ARTIFACT_DIR, `policy_ranker_${category}_v1.json`))
  );
}

export async function buildAdminMlOverview(): Promise<AdminMlOverview> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const claimRisk = claimRiskModelStatus();

  const [totalClaims, withReport, last24hClaims, questionnaireDocs] = await Promise.all([
    ClaimRequest.countDocuments(),
    ClaimRequest.countDocuments({ intelligenceReport: { $exists: true, $ne: null } }),
    ClaimRequest.countDocuments({ createdAt: { $gte: since24h } }),
    QuestionnaireResponse.find().select('userId').lean(),
  ]);

  const uniqueQuestionnaireUsers = new Set(questionnaireDocs.map((doc) => String(doc.userId)));

  return {
    geminiUsage: getAssistantUsageSummary(),
    models: {
      claimRiskLoaded: claimRisk.loaded,
      claimRiskVersion: claimRisk.version,
      policyRankerCategories: loadedPolicyRankerCategories(),
    },
    claims: {
      total: totalClaims,
      withIntelligenceReport: withReport,
      last24h: last24hClaims,
    },
    questionnaires: {
      totalResponses: questionnaireDocs.length,
      uniqueUsers: uniqueQuestionnaireUsers.size,
    },
  };
}
