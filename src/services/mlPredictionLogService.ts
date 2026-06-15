import type { MlRiskResult } from '../ml/types';
import { MlPredictionLog } from '../models/MlPredictionLog';

export async function logClaimRiskPrediction(
  claimId: string,
  mlRisk: MlRiskResult,
  actualOutcome: 'approved' | 'rejected'
): Promise<void> {
  await MlPredictionLog.findOneAndUpdate(
    { referenceId: claimId },
    {
      domain: 'claim_risk',
      referenceId: claimId,
      predictedScore: mlRisk.score,
      predictedLevel: mlRisk.level,
      approvalProbability: mlRisk.approvalProbability,
      modelVersion: mlRisk.modelVersion,
      actualOutcome,
      loggedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export interface ClaimRiskCalibrationSummary {
  windowDays: number;
  sampleSize: number;
  predictedHighRiskRatePct: number;
  actualRejectionRatePct: number;
  calibrationGapPct: number;
}

export async function getClaimRiskCalibrationSummary(
  windowDays = 30
): Promise<ClaimRiskCalibrationSummary> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const logs = await MlPredictionLog.find({ loggedAt: { $gte: since } }).lean();

  if (logs.length === 0) {
    return {
      windowDays,
      sampleSize: 0,
      predictedHighRiskRatePct: 0,
      actualRejectionRatePct: 0,
      calibrationGapPct: 0,
    };
  }

  const highRiskCount = logs.filter((log) => log.predictedScore >= 50).length;
  const rejectedCount = logs.filter((log) => log.actualOutcome === 'rejected').length;

  const predictedHighRiskRatePct = Math.round((highRiskCount / logs.length) * 1000) / 10;
  const actualRejectionRatePct = Math.round((rejectedCount / logs.length) * 1000) / 10;

  return {
    windowDays,
    sampleSize: logs.length,
    predictedHighRiskRatePct,
    actualRejectionRatePct,
    calibrationGapPct:
      Math.round(Math.abs(predictedHighRiskRatePct - actualRejectionRatePct) * 10) / 10,
  };
}

export async function getClaimRiskCalibrationTrend(
  windowDays = 30
): Promise<Array<{ date: string; predictedHighRiskRatePct: number; actualRejectionRatePct: number }>> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const logs = await MlPredictionLog.find({ loggedAt: { $gte: since } })
    .sort({ loggedAt: 1 })
    .lean();

  const buckets = new Map<
    string,
    { predictedHighRisk: number; rejected: number; total: number }
  >();

  for (const log of logs) {
    const date = log.loggedAt.toISOString().slice(0, 10);
    const bucket = buckets.get(date) ?? { predictedHighRisk: 0, rejected: 0, total: 0 };
    bucket.total += 1;
    if (log.predictedScore >= 50) {
      bucket.predictedHighRisk += 1;
    }
    if (log.actualOutcome === 'rejected') {
      bucket.rejected += 1;
    }
    buckets.set(date, bucket);
  }

  return [...buckets.entries()].map(([date, bucket]) => ({
    date,
    predictedHighRiskRatePct:
      bucket.total > 0 ? Math.round((bucket.predictedHighRisk / bucket.total) * 1000) / 10 : 0,
    actualRejectionRatePct:
      bucket.total > 0 ? Math.round((bucket.rejected / bucket.total) * 1000) / 10 : 0,
  }));
}
