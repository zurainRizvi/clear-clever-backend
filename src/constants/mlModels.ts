export const ML_MODEL_IDS = [
  'claim_risk',
  'fraud',
  'policy_ranker_home',
  'policy_ranker_auto',
  'policy_ranker_life',
  'policy_ranker_pet',
] as const;

export type MlModelId = (typeof ML_MODEL_IDS)[number];

export const ML_DEFAULT_VERSIONS: Record<MlModelId, string> = {
  claim_risk: 'claim_risk_v1',
  fraud: 'fraud_v1',
  policy_ranker_home: 'policy_ranker_home_v1',
  policy_ranker_auto: 'policy_ranker_auto_v1',
  policy_ranker_life: 'policy_ranker_life_v1',
  policy_ranker_pet: 'policy_ranker_pet_v1',
};

export function isMlModelId(value: string): value is MlModelId {
  return (ML_MODEL_IDS as readonly string[]).includes(value);
}
