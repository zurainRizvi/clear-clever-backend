import type { FraudSignal } from '../controllers/fraudSignalsController';
import type { FraudCategorySlug, FraudMlRawFeatures } from './types';

const SIGNAL_TYPE_BY_LABEL: Record<string, string> = {
  'Duplicate email registration': 'duplicate_email',
  'Unverified provider accounts': 'unverified_provider',
  'Account deactivation spike': 'inactive_spike',
  'Unusual claim frequency': 'claim_burst',
  'High rejected claim volume': 'rejected_claims_volume',
  'Elevated pending purchases': 'pending_purchases',
  'Abnormal lead volume': 'lead_spike',
  'Policies pending too long': 'stale_pending_policies',
  'High policy rejection rate': 'reject_rate',
};

const SEVERITY_ENCODED: Record<FraudSignal['severity'], number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function parseLargestCount(...texts: string[]): number {
  let max = 1;
  for (const text of texts) {
    const matches = text.match(/\d+/g);
    if (!matches) continue;
    for (const match of matches) {
      const value = Number.parseInt(match, 10);
      if (Number.isFinite(value) && value > max) {
        max = value;
      }
    }
  }
  return max;
}

function inferAccountAgeDays(signal: FraudSignal): number {
  if (signal.id.startsWith('dup-email-') || signal.id.startsWith('claim-freq-')) {
    return 21;
  }
  if (signal.type === 'Unverified provider accounts') {
    return 45;
  }
  return 240;
}

export function buildFraudMlFeatures(
  signal: FraudSignal,
  category: FraudCategorySlug
): FraudMlRawFeatures {
  return {
    signal_type: SIGNAL_TYPE_BY_LABEL[signal.type] ?? 'other',
    fraud_category: category,
    severity_encoded: SEVERITY_ENCODED[signal.severity],
    account_age_days: inferAccountAgeDays(signal),
    related_entity_count: parseLargestCount(signal.subject, signal.detail),
  };
}
