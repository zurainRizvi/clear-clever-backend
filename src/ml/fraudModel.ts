import fs from 'fs';
import {
  encodeFraudFeatures,
  logisticProbability,
  standardizeFeatures,
  topModelFactors,
} from './featureEncoding';
import { resolveArtifactPath } from './artifactPaths';
import type { FraudMlRawFeatures, FraudMlScore, LogisticRegressionArtifact } from './types';

let cachedArtifact: LogisticRegressionArtifact | null | undefined;

function loadArtifact(): LogisticRegressionArtifact | null {
  if (cachedArtifact !== undefined) {
    return cachedArtifact;
  }
  try {
    const raw = fs.readFileSync(resolveArtifactPath('fraud'), 'utf8');
    cachedArtifact = JSON.parse(raw) as LogisticRegressionArtifact;
  } catch {
    cachedArtifact = null;
  }
  return cachedArtifact;
}

export function resetFraudModelCache(): void {
  cachedArtifact = undefined;
}

export function scoreFraudFromFeatures(raw: FraudMlRawFeatures): FraudMlScore | null {
  const artifact = loadArtifact();
  if (!artifact) {
    return null;
  }

  const vector = encodeFraudFeatures(raw, artifact);
  const scaled = standardizeFeatures(vector, artifact);
  const fraudProbability = logisticProbability(scaled, artifact);

  return {
    mlScore: Math.round(fraudProbability * 100),
    mlFactors: topModelFactors(scaled, artifact),
    mlModelVersion: artifact.version,
  };
}
