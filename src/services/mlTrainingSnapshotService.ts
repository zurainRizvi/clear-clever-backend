import type { Types } from 'mongoose';
import type { FraudCategory, FraudSignal } from '../controllers/fraudSignalsController';
import { isDemoUserEmail } from '../constants/demoUsers';
import { buildClaimRiskFeatures } from '../ml/claimFeatureBuilder';
import { buildFraudMlFeatures } from '../ml/fraudFeatureBuilder';
import {
  buildPolicyRankerFeatures,
  isPolicyRankerCategory,
} from '../ml/recommendationFeatureBuilder';
import type { ClaimStatus, IClaimRequestDocument } from '../models/ClaimRequest';
import {
  FraudSignalResolution,
  type FraudResolution,
} from '../models/FraudSignalResolution';
import { MlTrainingSnapshot } from '../models/MlTrainingSnapshot';
import type { IPolicyDocument } from '../models/Policy';
import type { IPurchaseDocument } from '../models/Purchase';
import { User } from '../models/User';

function claimRiskLabel(status: ClaimStatus): number | null {
  if (status === 'rejected') {
    return 1;
  }
  if (status === 'approved') {
    return 0;
  }
  return null;
}

function fraudResolutionLabel(resolution: FraudResolution): number {
  return resolution === 'confirmed_fraud' ? 1 : 0;
}

async function shouldCaptureForUser(userId: Types.ObjectId | string): Promise<boolean> {
  const user = await User.findById(userId).select('email').lean();
  if (!user?.email) {
    return false;
  }
  return !isDemoUserEmail(user.email);
}

export async function captureClaimRiskTrainingSnapshot(
  claim: IClaimRequestDocument,
  status: ClaimStatus
): Promise<void> {
  const label = claimRiskLabel(status);
  if (label === null) {
    return;
  }
  if (!(await shouldCaptureForUser(claim.userId))) {
    return;
  }

  const features = await buildClaimRiskFeatures(claim);
  await MlTrainingSnapshot.findOneAndUpdate(
    { domain: 'claim_risk', referenceKey: String(claim._id) },
    {
      domain: 'claim_risk',
      referenceKey: String(claim._id),
      label,
      features,
      source: 'production',
      capturedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function captureFraudTrainingSnapshot(
  signal: FraudSignal,
  category: FraudCategory,
  resolution: FraudResolution
): Promise<void> {
  const features = buildFraudMlFeatures(signal, category);
  const referenceKey = `${category}:${signal.id}`;

  await MlTrainingSnapshot.findOneAndUpdate(
    { domain: 'fraud', referenceKey },
    {
      domain: 'fraud',
      referenceKey,
      label: fraudResolutionLabel(resolution),
      features,
      source: 'production',
      capturedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function capturePolicyRankerTrainingSnapshot(
  purchase: IPurchaseDocument,
  policy: IPolicyDocument
): Promise<void> {
  if (!isPolicyRankerCategory(policy.category)) {
    return;
  }
  if (!(await shouldCaptureForUser(purchase.userId))) {
    return;
  }

  const answers = (purchase.answers ?? {}) as Record<string, unknown>;
  const features = buildPolicyRankerFeatures(policy.category, answers, policy);
  const referenceKey = `${String(purchase._id)}:${policy.category}`;

  await MlTrainingSnapshot.findOneAndUpdate(
    { domain: 'policy_ranker', referenceKey },
    {
      domain: 'policy_ranker',
      referenceKey,
      label: 1,
      features: {
        category: policy.category,
        ...features,
      },
      category: policy.category,
      source: 'production',
      capturedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function resolveFraudSignal(
  signalId: string,
  category: FraudCategory,
  resolution: FraudResolution,
  resolvedBy: Types.ObjectId,
  signal: FraudSignal
): Promise<void> {
  const now = new Date();
  await FraudSignalResolution.findOneAndUpdate(
    { signalId, category },
    {
      signalId,
      category,
      resolution,
      resolvedBy,
      resolvedAt: now,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await captureFraudTrainingSnapshot(signal, category, resolution);
}
