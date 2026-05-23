import type { PolicyCategorySlug } from '../constants/categories';
import type { IPolicyDocument } from '../models/Policy';
import type { IPolicyQuestion } from '../models/Policy';
import type { PublicPolicy } from './policyPresentation';

export interface RecommendationInput {
  category: PolicyCategorySlug;
  answers: Record<string, unknown>;
}

export interface ScoredRecommendation {
  policy: PublicPolicy;
  score: number;
  matchReasons: string[];
}

/**
 * Rule-based recommendation scoring (max 100 points per policy):
 * - affordability (40pts): lower monthly premium relative to the most expensive candidate
 * - coverageFit (35pts): numeric answers aligned with policy premium tier
 * - featureRichness (25pts): more product features relative to peers
 */
const WEIGHTS = {
  affordability: 40,
  coverageFit: 35,
  featureRichness: 25,
} as const;

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function numericAnswerValues(answers: Record<string, unknown>): number[] {
  return Object.values(answers)
    .map((value) => toNumber(value))
    .filter((value): value is number => value !== null && value > 0);
}

function coverageFitScore(policy: IPolicyDocument, answers: Record<string, unknown>): number {
  const numericValues = numericAnswerValues(answers);
  if (numericValues.length === 0) {
    return WEIGHTS.coverageFit * 0.5;
  }

  const referenceValue = Math.max(...numericValues);
  const annualPremium = policy.premiumYearlyPkr;
  const ratio = annualPremium / referenceValue;

  // Ideal annual premium is roughly 0.8%–2.5% of declared asset/income value.
  if (ratio >= 0.008 && ratio <= 0.025) {
    return WEIGHTS.coverageFit;
  }

  const distance =
    ratio < 0.008 ? 0.008 - ratio : ratio > 0.025 ? ratio - 0.025 : 0;
  const penalty = Math.min(distance * 400, WEIGHTS.coverageFit);
  return Math.max(WEIGHTS.coverageFit - penalty, 0);
}

function affordabilityScore(
  policy: IPolicyDocument,
  maxPremiumMonthly: number,
  minPremiumMonthly: number
): number {
  if (maxPremiumMonthly === minPremiumMonthly) {
    return WEIGHTS.affordability;
  }

  const normalized =
    (maxPremiumMonthly - policy.premiumMonthlyPkr) / (maxPremiumMonthly - minPremiumMonthly);
  return normalized * WEIGHTS.affordability;
}

function featureRichnessScore(
  policy: IPolicyDocument,
  maxFeatureCount: number
): number {
  if (maxFeatureCount === 0) {
    return 0;
  }
  return (policy.features.length / maxFeatureCount) * WEIGHTS.featureRichness;
}

function singleChoiceBonus(
  policy: IPolicyDocument,
  questions: IPolicyQuestion[],
  answers: Record<string, unknown>
): number {
  let bonus = 0;
  for (const question of questions) {
    if (question.type !== 'single') {
      continue;
    }
    const answer = answers[question.id];
    if (typeof answer !== 'string') {
      continue;
    }
    const normalized = answer.toLowerCase();
    const featureHit = policy.features.some((feature) =>
      feature.toLowerCase().includes(normalized.split(' ')[0] ?? '')
    );
    if (featureHit) {
      bonus += 2;
    }
  }
  return Math.min(bonus, 5);
}

function buildMatchReasons(
  scores: { affordability: number; coverageFit: number; featureRichness: number }
): string[] {
  const reasons: string[] = [];
  if (scores.affordability >= WEIGHTS.affordability * 0.7) {
    reasons.push('Competitive monthly premium');
  }
  if (scores.coverageFit >= WEIGHTS.coverageFit * 0.7) {
    reasons.push('Good fit for your declared value');
  }
  if (scores.featureRichness >= WEIGHTS.featureRichness * 0.7) {
    reasons.push('Strong feature set');
  }
  if (reasons.length === 0) {
    reasons.push('Matches your category preferences');
  }
  return reasons;
}

export function scorePolicies(
  policies: IPolicyDocument[],
  publicPolicies: PublicPolicy[],
  questions: IPolicyQuestion[],
  answers: Record<string, unknown>
): ScoredRecommendation[] {
  if (policies.length === 0) {
    return [];
  }

  const maxPremiumMonthly = Math.max(...policies.map((p) => p.premiumMonthlyPkr));
  const minPremiumMonthly = Math.min(...policies.map((p) => p.premiumMonthlyPkr));
  const maxFeatureCount = Math.max(...policies.map((p) => p.features.length), 1);

  const publicById = new Map(publicPolicies.map((policy) => [policy.id, policy]));

  const scored = policies.map((policy) => {
    const affordability = affordabilityScore(policy, maxPremiumMonthly, minPremiumMonthly);
    const coverageFit = coverageFitScore(policy, answers);
    const featureRichness = featureRichnessScore(policy, maxFeatureCount);
    const bonus = singleChoiceBonus(policy, questions, answers);
    const score = Math.round(affordability + coverageFit + featureRichness + bonus);

    return {
      policy: publicById.get(String(policy._id))!,
      score,
      matchReasons: buildMatchReasons({
        affordability,
        coverageFit,
        featureRichness,
      }),
    };
  });

  return scored.sort((a, b) => b.score - a.score || a.policy.premiumMonthlyPkr - b.policy.premiumMonthlyPkr);
}
