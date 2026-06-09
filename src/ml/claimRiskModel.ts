import fs from 'fs';
import path from 'path';
import {
  encodeClaimRiskFeatures,
  humanizeFactor,
  logisticProbability,
  standardizeFeatures,
} from './featureEncoding';
import type { ClaimRiskRawFeatures, LogisticRegressionArtifact, MlRiskLevel, MlRiskResult } from './types';

const ARTIFACT_PATH = path.join(__dirname, 'artifacts', 'claim_risk_v1.json');

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

export function resetClaimRiskModelCache(): void {
  cachedArtifact = undefined;
}

function toRiskLevel(approvalProbability: number): MlRiskLevel {
  if (approvalProbability >= 0.65) {
    return 'low';
  }
  if (approvalProbability >= 0.4) {
    return 'medium';
  }
  return 'high';
}

function topFactors(
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

export function scoreClaimRiskFromFeatures(raw: ClaimRiskRawFeatures): MlRiskResult | null {
  const artifact = loadArtifact();
  if (!artifact) {
    return null;
  }

  const vector = encodeClaimRiskFeatures(raw, artifact);
  const scaled = standardizeFeatures(vector, artifact);
  const highRiskProbability = logisticProbability(scaled, artifact);
  const approvalProbability = 1 - highRiskProbability;

  return {
    score: Math.round(highRiskProbability * 100),
    level: toRiskLevel(approvalProbability),
    approvalProbability: Math.round(approvalProbability * 1000) / 1000,
    topFactors: topFactors(scaled, artifact),
    modelVersion: artifact.version,
  };
}

export function getClaimRiskArtifactMeta(): Pick<LogisticRegressionArtifact, 'version' | 'trainedAt'> | null {
  const artifact = loadArtifact();
  if (!artifact) {
    return null;
  }
  return { version: artifact.version, trainedAt: artifact.trainedAt };
}
