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
  answerHighlights?: AnswerHighlight[];
}

export interface AnswerHighlight {
  questionText: string;
  userAnswer: string;
  policyAlignment: string;
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

function answerTokens(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => answerTokens(item));
  }
  if (typeof value === 'string') {
    return [value.toLowerCase()];
  }
  return [];
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
    if (question.type !== 'single' && question.type !== 'multi') {
      continue;
    }
    const answer = answers[question.id];
    const normalizedAnswers = answerTokens(answer);
    if (normalizedAnswers.length === 0) {
      continue;
    }
    const featureHit = normalizedAnswers.some((normalized) =>
      policy.features.some((feature) =>
        feature.toLowerCase().includes(normalized.split(' ')[0] ?? '')
      )
    );
    if (featureHit) {
      bonus += 2;
    }
  }
  return Math.min(bonus, 5);
}

function formatAnswerValue(value: unknown, otherKey?: unknown): string {
  if (Array.isArray(value)) {
    const parts = value.map((v) => String(v));
    if (typeof otherKey === 'string' && otherKey.trim()) {
      return parts.join(', ') + ` (${otherKey.trim()})`;
    }
    return parts.join(', ');
  }
  if (typeof value === 'number') {
    return `Rs ${Math.round(value).toLocaleString('en-PK')}`;
  }
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return '';
}

function policyAlignmentForAnswer(
  policy: IPolicyDocument,
  question: IPolicyQuestion,
  answerText: string
): string {
  const normalized = answerText.toLowerCase();
  const featureHit = policy.features.some((feature) =>
    normalized.split(/[\s,]+/).some((token) => token.length > 2 && feature.toLowerCase().includes(token))
  );
  if (featureHit) {
    return 'This policy includes related coverage in its features';
  }
  if (question.id.includes('city') || question.id.includes('location')) {
    return 'Location noted for regional coverage assessment';
  }
  if (question.id.includes('risk') || question.id.includes('security')) {
    return 'Your risk priorities were considered in ranking';
  }
  if (question.id.includes('vehicle') || question.id.includes('pet')) {
    return 'Aligned with your stated coverage needs';
  }
  return 'Factored into your personalized ranking';
}

function isQuestionRelevantToCategory(questionId: string, category: IPolicyDocument['category']): boolean {
  if (questionId.includes('pet') && category !== 'pet') return false;
  if (
    (questionId.includes('vehicle') || questionId.includes('motor') || questionId === 'owns_vehicle') &&
    category !== 'auto'
  ) {
    return false;
  }
  if (
    (questionId.includes('property') || questionId.includes('contents') || questionId.includes('security')) &&
    category !== 'home'
  ) {
    return false;
  }
  if (questionId.includes('life') && category !== 'life') return false;
  return true;
}

export function buildAnswerHighlights(
  questions: IPolicyQuestion[],
  answers: Record<string, unknown>,
  policy: IPolicyDocument
): AnswerHighlight[] {
  const highlights: AnswerHighlight[] = [];

  for (const question of questions) {
    if (!isQuestionRelevantToCategory(question.id, policy.category)) continue;

    const value = answers[question.id];
    const otherDetail = answers[`${question.id}_other`];
    const answerText = formatAnswerValue(value, otherDetail);
    if (!answerText) continue;

    highlights.push({
      questionText: question.text,
      userAnswer: answerText,
      policyAlignment: policyAlignmentForAnswer(policy, question, answerText),
    });
    if (highlights.length >= 4) break;
  }

  return highlights;
}

function buildMatchReasons(
  scores: { affordability: number; coverageFit: number; featureRichness: number },
  answers: Record<string, unknown>,
  category: IPolicyDocument['category']
): string[] {
  const reasons: string[] = [];
  const vehicleTokens = [
    ...answerTokens(answers.vehicle_type),
    ...answerTokens(answers.owns_vehicle),
  ];
  const vehicleModel = typeof answers.vehicle_make_model === 'string' ? answers.vehicle_make_model : '';
  const petTokens = [...answerTokens(answers.pet_type), ...answerTokens(answers.has_pet)];

  const city =
    typeof answers.city === 'string'
      ? answers.city
      : typeof answers.registration_city === 'string'
        ? answers.registration_city
        : typeof answers.property_city === 'string'
          ? answers.property_city
          : '';
  if (city.trim()) {
    reasons.push(`Coverage options suited to your location in ${city.trim()}`);
  }

  if (category === 'home') {
    const riskAnswers = answerTokens(answers.risk_area);
    if (riskAnswers.some((t) => t.includes('flood'))) {
      reasons.push('Flood and rainwater risks you mentioned were prioritized');
    }
    if (riskAnswers.some((t) => t.includes('theft') || t.includes('burglary'))) {
      reasons.push('Theft protection aligned with your security concerns');
    }

    const securityFeatures = answerTokens(answers.security_features);
    if (securityFeatures.length > 0 && !securityFeatures.some((t) => t.includes('no special'))) {
      reasons.push('Your home security setup was considered in matching');
    }

    const propertyType = typeof answers.property_type === 'string' ? answers.property_type : '';
    if (propertyType) {
      reasons.push(`Suitable for ${propertyType.toLowerCase()} properties like yours`);
    }

    const contentsCover = typeof answers.contents_cover === 'string' ? answers.contents_cover : '';
    if (contentsCover && !contentsCover.toLowerCase().includes('structure only')) {
      reasons.push('Contents coverage matches what you requested');
    }
  }

  if (category === 'auto') {
    const hasMotorcycle =
      vehicleTokens.some((token) => token.includes('motorcycle') || token.includes('bike')) ||
      vehicleModel.toLowerCase().includes('motorcycle');
    const hasCar = vehicleTokens.some(
      (token) =>
        token.includes('car') ||
        token.includes('suv') ||
        token.includes('4x4') ||
        token.includes('commercial')
    );

    if (hasMotorcycle) {
      reasons.push('Built for motorcycle owners based on your answers');
    }
    if (hasCar) {
      reasons.push('Designed around your car or commercial vehicle needs');
    }
  }

  if (category === 'pet') {
    for (const pet of ['dog', 'cat', 'bird'] as const) {
      if (petTokens.some((token) => token.includes(pet))) {
        reasons.push(`${pet.charAt(0).toUpperCase() + pet.slice(1)} care needs reflected in this match`);
      }
    }
    if (
      petTokens.some((token) => token.includes('other pet')) &&
      !reasons.some((reason) => reason.includes('care'))
    ) {
      const otherPet = typeof answers.pet_type_other === 'string' ? answers.pet_type_other.trim() : '';
      reasons.push(otherPet ? `Pet care for ${otherPet} considered` : 'Your pet care preferences included');
    }
  }

  if (scores.affordability >= WEIGHTS.affordability * 0.7) {
    reasons.push('Competitive premium for your budget');
  }
  if (scores.coverageFit >= WEIGHTS.coverageFit * 0.7) {
    reasons.push('Well matched to the value you declared');
  }
  if (scores.featureRichness >= WEIGHTS.featureRichness * 0.7) {
    reasons.push('Comprehensive feature set for your profile');
  }
  if (reasons.length === 0) {
    reasons.push('Matches your category and questionnaire preferences');
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
      matchReasons: buildMatchReasons(
        {
          affordability,
          coverageFit,
          featureRichness,
        },
        answers,
        policy.category
      ),
      answerHighlights: buildAnswerHighlights(questions, answers, policy),
    };
  });

  return scored.sort((a, b) => b.score - a.score || a.policy.premiumMonthlyPkr - b.policy.premiumMonthlyPkr);
}
