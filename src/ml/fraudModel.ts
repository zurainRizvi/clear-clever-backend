import fs from 'fs';
import path from 'path';
import {
  encodeFraudFeatures,
  logisticProbability,
  standardizeFeatures,
  topModelFactors,
} from './featureEncoding';
import type { FraudMlRawFeatures, FraudMlScore, LogisticRegressionArtifact } from './types';

const ARTIFACT_PATH = path.join(__dirname, 'artifacts', 'fraud_v1.json');

let cachedArtifact: LogisticRegressionArtifact | null | undefined;

function loadArtifact(): LogisticRegressionArtifact | null {
  if (cachedArtifact !== undefined) {
    return cachedArtifact;
  }
  try {
    const raw = fs.readFileSync(ARTIFACT_PATH, 'utf8');
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
