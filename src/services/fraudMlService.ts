import type { FraudCategory, FraudSignal } from '../controllers/fraudSignalsController';
import { buildFraudMlFeatures } from '../ml/fraudFeatureBuilder';
import { scoreFraudFromFeatures } from '../ml/fraudModel';
import type { FraudMlSummary } from '../ml/types';

export type EnrichedFraudSignal = FraudSignal & {
  mlScore?: number;
  mlFactors?: string[];
  mlModelVersion?: string;
};

export function enrichFraudSignalsWithMl(
  signals: FraudSignal[],
  category: FraudCategory
): { signals: EnrichedFraudSignal[]; mlSummary: FraudMlSummary | null } {
  const enriched: EnrichedFraudSignal[] = signals.map((signal) => {
    const features = buildFraudMlFeatures(signal, category);
    const ml = scoreFraudFromFeatures(features);
    if (!ml) {
      return signal;
    }
    return {
      ...signal,
      mlScore: ml.mlScore,
      mlFactors: ml.mlFactors,
      mlModelVersion: ml.mlModelVersion,
    };
  });

  const scored = enriched.filter((signal) => typeof signal.mlScore === 'number');
  if (scored.length === 0) {
    return { signals: enriched, mlSummary: null };
  }

  const averageScore = Math.round(
    scored.reduce((sum, signal) => sum + (signal.mlScore ?? 0), 0) / scored.length
  );
  const highConfidenceCount = scored.filter((signal) => (signal.mlScore ?? 0) >= 70).length;
  const modelVersion = scored[0]?.mlModelVersion ?? 'fraud_v1';

  return {
    signals: enriched,
    mlSummary: {
      averageScore,
      highConfidenceCount,
      modelVersion,
    },
  };
}
