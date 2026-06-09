import type { IClaimRequestDocument } from '../models/ClaimRequest';
import { buildClaimRiskFeatures } from '../ml/claimFeatureBuilder';
import { scoreClaimRiskFromFeatures } from '../ml/claimRiskModel';
import type { MlRiskResult } from '../ml/types';

export async function scoreClaimRisk(claim: IClaimRequestDocument): Promise<MlRiskResult | null> {
  const features = await buildClaimRiskFeatures(claim);
  return scoreClaimRiskFromFeatures(features);
}
