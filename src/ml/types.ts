export type MlRiskLevel = 'low' | 'medium' | 'high';

export interface MlRiskResult {
  score: number;
  level: MlRiskLevel;
  approvalProbability: number;
  topFactors: string[];
  modelVersion: string;
}

export interface LogisticRegressionArtifact {
  version: string;
  modelType: 'logistic_regression';
  trainedAt: string;
  featureOrder: string[];
  numericFeatures: string[];
  categoricalFeatures: Record<string, string[]>;
  scaler: {
    mean: number[];
    scale: number[];
  };
  coefficients: number[];
  intercept: number;
  threshold: number;
}

export interface ClaimRiskRawFeatures {
  claim_type: string;
  policy_category: string;
  estimated_amount_pkr: number;
  description_length: number;
  days_incident_to_submit: number;
  amount_to_premium_ratio: number;
  user_claims_7d: number;
  user_claims_30d: number;
  user_rejected_claims: number;
  city_region: string;
}

export type FraudCategorySlug = 'account' | 'claims' | 'commerce' | 'catalog';

export interface FraudMlRawFeatures {
  signal_type: string;
  fraud_category: FraudCategorySlug;
  severity_encoded: number;
  account_age_days: number;
  related_entity_count: number;
}

export interface FraudMlScore {
  mlScore: number;
  mlFactors: string[];
  mlModelVersion: string;
}

export interface FraudMlSummary {
  averageScore: number;
  highConfidenceCount: number;
  modelVersion: string;
}

export type PolicyRankerCategory = 'home' | 'auto' | 'life' | 'pet';

export interface PolicyRankerArtifact extends LogisticRegressionArtifact {
  category: PolicyRankerCategory;
}

export interface PolicyRankerRawFeatures {
  user_value_pkr: number;
  policy_premium_monthly_pkr: number;
  policy_feature_count: number;
  policy_deductible_pkr: number;
  premium_to_value_ratio: number;
  city_region: string;
  property_type?: string;
  occupancy?: string;
  vehicle_type?: string;
  coverage_type?: string;
  coverage_goal?: string;
  age_band?: string;
  pet_type?: string;
  vaccination_status?: string;
}
