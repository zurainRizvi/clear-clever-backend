import type { PolicyCategorySlug } from '../constants/categories';
import type { IPolicyDocument, IPolicyQuestion } from '../models/Policy';
import {
  buildPolicyRankerFeatures,
  isPolicyRankerCategory,
} from '../ml/recommendationFeatureBuilder';
import { scorePolicyMatchProbability } from '../ml/policyRankerModel';
import type { PublicPolicy } from './policyPresentation';
import { scorePolicies, type ScoredRecommendation } from './recommendationService';

export type RankingMethod = 'rules' | 'hybrid';

export interface HybridScoredRecommendation extends ScoredRecommendation {
  ruleScore: number;
  mlConfidence?: number;
  mlRank?: number;
  rankingMethod: RankingMethod;
  modelVersion?: string;
}

/** Blend weights documented in ML plan Part F. */
export const HYBRID_RULE_WEIGHT = 0.3;
export const HYBRID_ML_WEIGHT = 0.7;

export function scorePoliciesHybrid(
  category: PolicyCategorySlug,
  policies: IPolicyDocument[],
  publicPolicies: PublicPolicy[],
  questions: IPolicyQuestion[],
  answers: Record<string, unknown>
): HybridScoredRecommendation[] {
  const ruleScored = scorePolicies(policies, publicPolicies, questions, answers);

  if (!isPolicyRankerCategory(category)) {
    return ruleScored.map((rec) => ({
      ...rec,
      ruleScore: rec.score,
      rankingMethod: 'rules',
    }));
  }

  const policyById = new Map(policies.map((policy) => [String(policy._id), policy]));

  const blended = ruleScored.map((rec) => {
    const policy = policyById.get(rec.policy.id);
    if (!policy) {
      return {
        ...rec,
        ruleScore: rec.score,
        rankingMethod: 'rules' as const,
      };
    }

    const features = buildPolicyRankerFeatures(category, answers, policy);
    const mlProbability = scorePolicyMatchProbability(category, features);
    const mlConfidence =
      mlProbability !== null ? Math.round(mlProbability * 1000) / 10 : undefined;
    const mlComponent = (mlProbability ?? 0.5) * 100;
    const finalScore = Math.round(HYBRID_RULE_WEIGHT * rec.score + HYBRID_ML_WEIGHT * mlComponent);

    return {
      ...rec,
      score: finalScore,
      ruleScore: rec.score,
      mlConfidence,
      rankingMethod: 'hybrid' as const,
      modelVersion:
        mlProbability !== null ? `policy_ranker_${category}_v1` : undefined,
    };
  });

  blended.sort(
    (a, b) =>
      b.score - a.score ||
      a.policy.premiumMonthlyPkr - b.policy.premiumMonthlyPkr ||
      a.policy.name.localeCompare(b.policy.name)
  );

  return blended.map((rec, index) => ({
    ...rec,
    mlRank: index + 1,
  }));
}
