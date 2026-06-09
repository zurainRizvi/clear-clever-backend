import type {
  ClaimRiskRawFeatures,
  FraudMlRawFeatures,
  LogisticRegressionArtifact,
} from './types';

export const CLAIM_TYPES = [
  'accident',
  'theft',
  'damage',
  'medical',
  'pet_care',
  'home',
  'auto',
  'life',
  'pet',
  'other',
] as const;

export const POLICY_CATEGORIES = ['home', 'auto', 'life', 'pet', 'others'] as const;

export const CITY_REGIONS = ['punjab', 'sindh', 'kpk', 'balochistan', 'islamabad', 'other'] as const;

const CITY_TO_REGION: Record<string, (typeof CITY_REGIONS)[number]> = {
  lahore: 'punjab',
  faisalabad: 'punjab',
  rawalpindi: 'punjab',
  multan: 'punjab',
  gujranwala: 'punjab',
  sialkot: 'punjab',
  karachi: 'sindh',
  hyderabad: 'sindh',
  sukkur: 'sindh',
  peshawar: 'kpk',
  abbottabad: 'kpk',
  mardan: 'kpk',
  quetta: 'balochistan',
  islamabad: 'islamabad',
};

export function bucketCityRegion(city: unknown): (typeof CITY_REGIONS)[number] {
  if (typeof city !== 'string' || !city.trim()) {
    return 'other';
  }
  const key = city.trim().toLowerCase();
  return CITY_TO_REGION[key] ?? 'other';
}

export function encodeClaimRiskFeatures(
  raw: ClaimRiskRawFeatures,
  artifact: LogisticRegressionArtifact
): number[] {
  const values: Record<string, number> = {
    estimated_amount_pkr: raw.estimated_amount_pkr,
    description_length: raw.description_length,
    days_incident_to_submit: raw.days_incident_to_submit,
    amount_to_premium_ratio: raw.amount_to_premium_ratio,
    user_claims_7d: raw.user_claims_7d,
    user_claims_30d: raw.user_claims_30d,
    user_rejected_claims: raw.user_rejected_claims,
  };

  const rawRecord = raw as unknown as Record<string, unknown>;
  for (const [field, options] of Object.entries(artifact.categoricalFeatures)) {
    const selected = String(rawRecord[field] ?? 'other');
    for (const option of options) {
      values[`${field}__${option}`] = selected === option ? 1 : 0;
    }
  }

  return artifact.featureOrder.map((name) => values[name] ?? 0);
}

export function standardizeFeatures(vector: number[], artifact: LogisticRegressionArtifact): number[] {
  return vector.map((value, index) => {
    const scale = artifact.scaler.scale[index] || 1;
    const mean = artifact.scaler.mean[index] ?? 0;
    return (value - mean) / scale;
  });
}

export function logisticProbability(
  scaledVector: number[],
  artifact: LogisticRegressionArtifact
): number {
  let logit = artifact.intercept;
  for (let i = 0; i < scaledVector.length; i += 1) {
    logit += scaledVector[i] * artifact.coefficients[i];
  }
  return 1 / (1 + Math.exp(-logit));
}

export function humanizeFactor(featureName: string): string {
  if (featureName.includes('__')) {
    const [field, value] = featureName.split('__');
    return `${field.replace(/_/g, ' ')}: ${value}`;
  }
  return featureName.replace(/_/g, ' ');
}

export function encodeArtifactFeatures(
  raw: Record<string, number | string>,
  numericFeatures: string[],
  artifact: LogisticRegressionArtifact
): number[] {
  const values: Record<string, number> = {};
  for (const key of numericFeatures) {
    values[key] = Number(raw[key] ?? 0);
  }

  const rawRecord = raw as Record<string, unknown>;
  for (const [field, options] of Object.entries(artifact.categoricalFeatures)) {
    const selected = String(rawRecord[field] ?? 'other');
    for (const option of options) {
      values[`${field}__${option}`] = selected === option ? 1 : 0;
    }
  }

  return artifact.featureOrder.map((name) => values[name] ?? 0);
}

export function encodeFraudFeatures(
  raw: FraudMlRawFeatures,
  artifact: LogisticRegressionArtifact
): number[] {
  return encodeArtifactFeatures(
    {
      severity_encoded: raw.severity_encoded,
      account_age_days: raw.account_age_days,
      related_entity_count: raw.related_entity_count,
      signal_type: raw.signal_type,
      fraud_category: raw.fraud_category,
    },
    artifact.numericFeatures,
    artifact
  );
}

export function topModelFactors(
  scaledVector: number[],
  artifact: LogisticRegressionArtifact,
  limit = 3
): string[] {
  const contributions = artifact.featureOrder.map((featureName, index) => ({
    featureName,
    impact: scaledVector[index] * artifact.coefficients[index],
  }));
  return contributions
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
    .slice(0, limit)
    .map((row) => humanizeFactor(row.featureName));
}
