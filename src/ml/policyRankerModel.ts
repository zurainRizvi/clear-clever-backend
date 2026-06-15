import fs from 'fs';
import { encodeArtifactFeatures, logisticProbability, standardizeFeatures } from './featureEncoding';
import { resolveArtifactPath } from './artifactPaths';
import type { PolicyRankerArtifact, PolicyRankerCategory, PolicyRankerRawFeatures } from './types';

const cache = new Map<PolicyRankerCategory, PolicyRankerArtifact | null | undefined>();

function loadArtifact(category: PolicyRankerCategory): PolicyRankerArtifact | null {
  if (cache.has(category)) {
    return cache.get(category) ?? null;
  }
  const modelId = `policy_ranker_${category}` as const;
  const filePath = resolveArtifactPath(modelId);
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as PolicyRankerArtifact;
    cache.set(category, parsed);
    return parsed;
  } catch {
    cache.set(category, null);
    return null;
  }
}

export function resetPolicyRankerModelCache(): void {
  cache.clear();
}

export function scorePolicyMatchProbability(
  category: PolicyRankerCategory,
  raw: PolicyRankerRawFeatures
): number | null {
  const artifact = loadArtifact(category);
  if (!artifact) {
    return null;
  }

  const vector = encodeArtifactFeatures(
    raw as unknown as Record<string, number | string>,
    artifact.numericFeatures,
    artifact
  );
  const scaled = standardizeFeatures(vector, artifact);
  return logisticProbability(scaled, artifact);
}

export function getPolicyRankerMeta(
  category: PolicyRankerCategory
): Pick<PolicyRankerArtifact, 'version' | 'trainedAt' | 'category'> | null {
  const artifact = loadArtifact(category);
  if (!artifact) {
    return null;
  }
  return {
    version: artifact.version,
    trainedAt: artifact.trainedAt,
    category: artifact.category,
  };
}

export function hasPolicyRankerModel(category: PolicyRankerCategory): boolean {
  return loadArtifact(category) !== null;
}
