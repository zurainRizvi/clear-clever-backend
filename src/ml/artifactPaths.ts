import fs from 'fs';
import path from 'path';
import { ML_DEFAULT_VERSIONS, type MlModelId } from '../constants/mlModels';

const ARTIFACT_ROOT = path.join(__dirname, 'artifacts');

let activeVersionCache = new Map<MlModelId, string>();

function artifactFileName(version: string): string {
  return `${version}.json`;
}

export function getArtifactDirectory(): string {
  return ARTIFACT_ROOT;
}

export function getCandidateArtifactDirectory(): string {
  return path.join(ARTIFACT_ROOT, 'candidates');
}

export function setActiveVersionCache(entries: Map<MlModelId, string>): void {
  activeVersionCache = new Map(entries);
}

export function setActiveVersion(modelId: MlModelId, version: string): void {
  activeVersionCache.set(modelId, version);
}

export function resolveArtifactPath(modelId: MlModelId): string {
  const version = activeVersionCache.get(modelId) ?? ML_DEFAULT_VERSIONS[modelId];
  const activePath = path.join(ARTIFACT_ROOT, artifactFileName(version));
  if (fs.existsSync(activePath)) {
    return activePath;
  }
  return path.join(ARTIFACT_ROOT, artifactFileName(ML_DEFAULT_VERSIONS[modelId]));
}

export function readMetaMetrics(version: string) {
  const metaPath = path.join(ARTIFACT_ROOT, `${version}.meta.json`);
  try {
    const raw = fs.readFileSync(metaPath, 'utf8');
    return JSON.parse(raw) as { metrics?: Record<string, number> };
  } catch {
    return null;
  }
}

export function copyCandidateArtifactToActive(candidateVersion: string): void {
  const candidateArtifact = path.join(getCandidateArtifactDirectory(), `${candidateVersion}.json`);
  const candidateMeta = path.join(getCandidateArtifactDirectory(), `${candidateVersion}.meta.json`);
  const activeArtifact = path.join(ARTIFACT_ROOT, `${candidateVersion}.json`);
  const activeMeta = path.join(ARTIFACT_ROOT, `${candidateVersion}.meta.json`);

  fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
  fs.copyFileSync(candidateArtifact, activeArtifact);
  if (fs.existsSync(candidateMeta)) {
    fs.copyFileSync(candidateMeta, activeMeta);
  }
}

export function removeCandidateArtifact(candidateVersion: string): void {
  const candidateArtifact = path.join(getCandidateArtifactDirectory(), `${candidateVersion}.json`);
  const candidateMeta = path.join(getCandidateArtifactDirectory(), `${candidateVersion}.meta.json`);
  if (fs.existsSync(candidateArtifact)) {
    fs.unlinkSync(candidateArtifact);
  }
  if (fs.existsSync(candidateMeta)) {
    fs.unlinkSync(candidateMeta);
  }
}

export function writeCandidateArtifactFiles(
  candidateVersion: string,
  artifact: Record<string, unknown>,
  meta: Record<string, unknown>
): void {
  const candidateDir = getCandidateArtifactDirectory();
  fs.mkdirSync(candidateDir, { recursive: true });
  fs.writeFileSync(
    path.join(candidateDir, `${candidateVersion}.json`),
    JSON.stringify(artifact, null, 2)
  );
  fs.writeFileSync(
    path.join(candidateDir, `${candidateVersion}.meta.json`),
    JSON.stringify(meta, null, 2)
  );
}
