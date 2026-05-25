import type { Response } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { ClaimRequest } from '../models/ClaimRequest';
import { Lead } from '../models/Lead';
import { Policy } from '../models/Policy';
import { Purchase } from '../models/Purchase';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import { successResponse } from '../utils/apiResponse';

export type FraudCategory = 'account' | 'claims' | 'commerce' | 'catalog';

export interface FraudSignal {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  subject: string;
  detail: string;
  detectedAt: string;
  link?: string;
}

async function accountSignals(): Promise<FraudSignal[]> {
  const signals: FraudSignal[] = [];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const duplicateEmails = await User.aggregate<{ _id: string; count: number }>([
    { $group: { _id: { $toLower: '$email' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 10 },
  ]);

  for (const row of duplicateEmails) {
    signals.push({
      id: `dup-email-${row._id}`,
      type: 'Duplicate email registration',
      severity: 'high',
      subject: row._id,
      detail: `${row.count} accounts share this email pattern`,
      detectedAt: new Date().toISOString(),
      link: '/admin-dashboard/users',
    });
  }

  const pendingInsurers = await User.countDocuments({
    role: 'insurer',
    status: 'pendingVerification',
  });
  if (pendingInsurers > 0) {
    signals.push({
      id: 'pending-insurers',
      type: 'Unverified provider accounts',
      severity: 'medium',
      subject: `${pendingInsurers} insurer(s)`,
      detail: 'Providers awaiting super admin approval — review before granting access',
      detectedAt: new Date().toISOString(),
      link: '/admin-dashboard/approvals',
    });
  }

  const recentInactive = await User.countDocuments({
    status: 'inactive',
    updatedAt: { $gte: sevenDaysAgo },
  });
  if (recentInactive >= 3) {
    signals.push({
      id: 'inactive-spike',
      type: 'Account deactivation spike',
      severity: 'medium',
      subject: `${recentInactive} accounts`,
      detail: 'Multiple accounts deactivated in the last 7 days',
      detectedAt: new Date().toISOString(),
      link: '/admin-dashboard/users',
    });
  }

  return signals;
}

async function claimSignals(): Promise<FraudSignal[]> {
  const signals: FraudSignal[] = [];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const frequentClaimants = await ClaimRequest.aggregate<{
    _id: mongoose.Types.ObjectId;
    count: number;
  }>([
    { $match: { createdAt: { $gte: sevenDaysAgo } } },
    { $group: { _id: '$userId', count: { $sum: 1 } } },
    { $match: { count: { $gte: 3 } } },
    { $limit: 10 },
  ]);

  for (const row of frequentClaimants) {
    const user = await User.findById(row._id);
    signals.push({
      id: `claim-freq-${row._id}`,
      type: 'Unusual claim frequency',
      severity: 'high',
      subject: user?.email ?? String(row._id),
      detail: `${row.count} claims filed in the last 7 days`,
      detectedAt: new Date().toISOString(),
      link: '/admin-dashboard/fraud',
    });
  }

  const rejectedCount = await ClaimRequest.countDocuments({ status: 'rejected' });
  if (rejectedCount >= 5) {
    signals.push({
      id: 'rejected-claims-volume',
      type: 'High rejected claim volume',
      severity: 'medium',
      subject: `${rejectedCount} rejected claims`,
      detail: 'Review insurers with elevated rejection rates',
      detectedAt: new Date().toISOString(),
    });
  }

  return signals;
}

async function commerceSignals(): Promise<FraudSignal[]> {
  const signals: FraudSignal[] = [];

  const pendingPurchases = await Purchase.countDocuments({ status: 'pending' });
  if (pendingPurchases >= 10) {
    signals.push({
      id: 'pending-purchases',
      type: 'Elevated pending purchases',
      severity: 'medium',
      subject: `${pendingPurchases} pending`,
      detail: 'Many purchases have not completed affiliate checkout',
      detectedAt: new Date().toISOString(),
    });
  }

  const leadSpikes = await Lead.aggregate<{
    _id: mongoose.Types.ObjectId;
    count: number;
  }>([
    {
      $match: {
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    },
    { $group: { _id: '$insurerProfileId', count: { $sum: 1 } } },
    { $match: { count: { $gte: 15 } } },
    { $limit: 5 },
  ]);

  for (const row of leadSpikes) {
    signals.push({
      id: `lead-spike-${row._id}`,
      type: 'Abnormal lead volume',
      severity: 'high',
      subject: `Insurer ${String(row._id).slice(-6)}`,
      detail: `${row.count} leads in the last 24 hours`,
      detectedAt: new Date().toISOString(),
    });
  }

  return signals;
}

async function catalogSignals(): Promise<FraudSignal[]> {
  const signals: FraudSignal[] = [];
  const stalePending = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const oldPending = await Policy.countDocuments({
    status: 'pending',
    createdAt: { $lte: stalePending },
  });
  if (oldPending > 0) {
    signals.push({
      id: 'stale-pending-policies',
      type: 'Policies pending too long',
      severity: 'medium',
      subject: `${oldPending} policies`,
      detail: 'Submissions pending admin review for more than 14 days',
      detectedAt: new Date().toISOString(),
      link: '/admin-dashboard/policies',
    });
  }

  const rejectionRate = await Policy.aggregate<{
    _id: mongoose.Types.ObjectId;
    total: number;
    rejected: number;
  }>([
    {
      $group: {
        _id: '$insurerProfileId',
        total: { $sum: 1 },
        rejected: {
          $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] },
        },
      },
    },
    { $match: { total: { $gte: 3 }, rejected: { $gte: 2 } } },
    { $limit: 5 },
  ]);

  for (const row of rejectionRate) {
    const rate = Math.round((row.rejected / row.total) * 100);
    signals.push({
      id: `reject-rate-${row._id}`,
      type: 'High policy rejection rate',
      severity: rate >= 50 ? 'high' : 'medium',
      subject: `Insurer ${String(row._id).slice(-6)}`,
      detail: `${row.rejected} of ${row.total} policies rejected (${rate}%)`,
      detectedAt: new Date().toISOString(),
      link: '/admin-dashboard/approvals',
    });
  }

  return signals;
}

const collectors: Record<FraudCategory, () => Promise<FraudSignal[]>> = {
  account: accountSignals,
  claims: claimSignals,
  commerce: commerceSignals,
  catalog: catalogSignals,
};

export async function getFraudSignals(req: AuthenticatedRequest, res: Response): Promise<void> {
  const category = (req.query.category as FraudCategory) || 'account';
  const collect = collectors[category] ?? accountSignals;
  const signals = await collect();

  res.status(200).json(
    successResponse('Fraud signals retrieved', {
      category,
      count: signals.length,
      signals,
    })
  );
}
