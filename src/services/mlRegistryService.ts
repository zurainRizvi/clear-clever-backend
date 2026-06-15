import type { Types } from 'mongoose';
import { ML_DEFAULT_VERSIONS, ML_MODEL_IDS, type MlModelId } from '../constants/mlModels';
import {
  MlModelRegistry,
  type MlCandidateReport,
  type MlCandidateReportMetrics,
} from '../models/MlModelRegistry';
import type { LogisticRegressionArtifact, PolicyRankerArtifact } from '../ml/types';
import { resetClaimRiskModelCache } from '../ml/claimRiskModel';
import { resetFraudModelCache } from '../ml/fraudModel';
import { resetPolicyRankerModelCache } from '../ml/policyRankerModel';
import {
  copyCandidateArtifactToActive,
  readMetaMetrics,
  removeCandidateArtifact,
  setActiveVersion,
  setActiveVersionCache,
  writeCandidateArtifactFiles,
} from '../ml/artifactPaths';

type ArtifactPayload = LogisticRegressionArtifact | PolicyRankerArtifact;

export {
  getArtifactDirectory,
  getCandidateArtifactDirectory,
  resolveArtifactPath,
} from '../ml/artifactPaths';

export async function refreshMlRegistryCache(): Promise<void> {
  const docs = await MlModelRegistry.find({}).lean();
  const cache = new Map<MlModelId, string>();
  for (const doc of docs) {
    cache.set(doc.modelId as MlModelId, doc.activeVersion);
  }
  setActiveVersionCache(cache);
}

export async function ensureMlRegistryDefaults(): Promise<void> {
  for (const modelId of ML_MODEL_IDS) {
    const defaultVersion = ML_DEFAULT_VERSIONS[modelId];
    await MlModelRegistry.findOneAndUpdate(
      { modelId },
      {
        $setOnInsert: {
          modelId,
          activeVersion: defaultVersion,
          activeMetrics: readMetaMetrics(defaultVersion)?.metrics as MlCandidateReportMetrics | undefined,
        },
      },
      { upsert: true, new: true }
    );
  }
  await refreshMlRegistryCache();
}

function invalidateInferenceCaches(): void {
  resetClaimRiskModelCache();
  resetFraudModelCache();
  resetPolicyRankerModelCache();
}

function computeMetricDelta(
  baseline: MlCandidateReportMetrics | undefined,
  candidate: MlCandidateReportMetrics
): Partial<MlCandidateReportMetrics> {
  if (!baseline) {
    return {};
  }
  const keys: Array<Exclude<keyof MlCandidateReportMetrics, 'confusion_matrix'>> = [
    'accuracy',
    'roc_auc',
    'precision',
    'recall',
    'f1',
  ];
  const delta: Partial<MlCandidateReportMetrics> = {};
  for (const key of keys) {
    const base = baseline[key];
    const next = candidate[key];
    if (typeof base === 'number' && typeof next === 'number') {
      delta[key] = Math.round((next - base) * 10000) / 10000;
    }
  }
  return delta;
}

export async function uploadCandidateModel(params: {
  modelId: MlModelId;
  candidateVersion: string;
  artifact: ArtifactPayload;
  meta: Record<string, unknown>;
  report: MlCandidateReport;
}): Promise<void> {
  writeCandidateArtifactFiles(
    params.candidateVersion,
    params.artifact as unknown as Record<string, unknown>,
    params.meta
  );

  const existing = await MlModelRegistry.findOne({ modelId: params.modelId }).lean();
  const activeMetrics =
    existing?.activeMetrics ??
    (readMetaMetrics(existing?.activeVersion ?? ML_DEFAULT_VERSIONS[params.modelId])?.metrics as
      | MlCandidateReportMetrics
      | undefined);

  await MlModelRegistry.findOneAndUpdate(
    { modelId: params.modelId },
    {
      candidateVersion: params.candidateVersion,
      candidateReport: {
        ...params.report,
        activeMetrics,
        delta: computeMetricDelta(activeMetrics, params.report.metrics),
      },
      candidateUploadedAt: new Date(),
      lastRetrainAt: new Date(params.report.trainedAt),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function promoteCandidateModel(
  modelId: MlModelId,
  promotedBy: Types.ObjectId
): Promise<void> {
  const doc = await MlModelRegistry.findOne({ modelId });
  if (!doc?.candidateVersion || !doc.candidateReport) {
    throw new Error('No candidate model is available to promote');
  }

  copyCandidateArtifactToActive(doc.candidateVersion);

  doc.activeVersion = doc.candidateVersion;
  doc.activeMetrics = doc.candidateReport.metrics;
  doc.promotedAt = new Date();
  doc.promotedBy = promotedBy;
  doc.candidateVersion = undefined;
  doc.candidateReport = undefined;
  doc.candidateUploadedAt = undefined;
  await doc.save();

  setActiveVersion(modelId, doc.activeVersion);
  invalidateInferenceCaches();
}

export async function keepCandidateModel(modelId: MlModelId): Promise<void> {
  const doc = await MlModelRegistry.findOne({ modelId });
  if (!doc?.candidateVersion) {
    return;
  }

  removeCandidateArtifact(doc.candidateVersion);

  doc.candidateVersion = undefined;
  doc.candidateReport = undefined;
  doc.candidateUploadedAt = undefined;
  await doc.save();
}

export interface MlRetrainModelReport {
  modelId: MlModelId;
  title: string;
  activeVersion: string;
  candidateVersion?: string;
  activeMetrics?: MlCandidateReportMetrics;
  candidateReport?: MlCandidateReport;
  hasCandidate: boolean;
}

export async function getMlRetrainReport(): Promise<{
  generatedAt: string;
  models: MlRetrainModelReport[];
}> {
  await ensureMlRegistryDefaults();
  const docs = await MlModelRegistry.find({}).sort({ modelId: 1 }).lean();

  const titles: Record<MlModelId, string> = {
    claim_risk: 'Claim risk scorer',
    fraud: 'Fraud likelihood scorer',
    policy_ranker_home: 'Home policy ranker',
    policy_ranker_auto: 'Auto policy ranker',
    policy_ranker_life: 'Life policy ranker',
    policy_ranker_pet: 'Pet policy ranker',
  };

  return {
    generatedAt: new Date().toISOString(),
    models: docs.map((doc) => ({
      modelId: doc.modelId as MlModelId,
      title: titles[doc.modelId as MlModelId],
      activeVersion: doc.activeVersion,
      candidateVersion: doc.candidateVersion,
      activeMetrics: doc.activeMetrics,
      candidateReport: doc.candidateReport,
      hasCandidate: Boolean(doc.candidateVersion && doc.candidateReport),
    })),
  };
}

export async function getRegistryEntry(modelId: MlModelId) {
  await ensureMlRegistryDefaults();
  return MlModelRegistry.findOne({ modelId }).lean();
}
