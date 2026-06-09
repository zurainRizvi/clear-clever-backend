import type { Types } from 'mongoose';
import { Lead } from '../models/Lead';
import { Policy } from '../models/Policy';
import { Purchase } from '../models/Purchase';
import { User } from '../models/User';
import { demographicsChipFromKyc } from './kycDemographicsService';
import { getLatestKycByUserIds } from './kycService';

export interface InsurerCustomerLeadItem {
  id: string;
  type: string;
  status: string;
  seenAt?: string;
  isNew: boolean;
  summary: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  policy?: {
    id: string;
    slug: string;
    name: string;
    category: string;
  };
}

export interface InsurerCustomerPurchaseItem {
  id: string;
  status: string;
  completedAt?: string;
  createdAt: string;
  policy?: {
    id: string;
    slug: string;
    name: string;
    category: string;
    premiumMonthlyPkr?: number;
    premiumYearlyPkr?: number;
  };
}

export interface InsurerCustomerDemographics {
  gender?: string;
  ageBand?: string;
  province?: string;
  district?: string;
  kycStatus: string;
  kycScore?: number;
}

export interface InsurerCustomerGroup {
  seeker: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
  };
  demographics?: InsurerCustomerDemographics;
  leads: InsurerCustomerLeadItem[];
  purchases: InsurerCustomerPurchaseItem[];
  isNew: boolean;
  latestActivityAt: string;
}

export async function buildInsurerCustomerGroups(
  insurerProfileId: Types.ObjectId | string
): Promise<InsurerCustomerGroup[]> {
  const [leads, purchases] = await Promise.all([
    Lead.find({ insurerProfileId }).sort({ createdAt: -1 }),
    Purchase.find({
      insurerProfileId,
      status: { $in: ['completed', 'terminated'] },
    }).sort({ createdAt: -1 }),
  ]);

  const userIds = [
    ...new Set([
      ...leads.map((lead) => String(lead.userId)),
      ...purchases.map((purchase) => String(purchase.userId)),
    ]),
  ];
  const policyIds = [
    ...new Set([
      ...leads.filter((lead) => lead.policyId).map((lead) => String(lead.policyId)),
      ...purchases.map((purchase) => String(purchase.policyId)),
    ]),
  ];

  const [users, policies] = await Promise.all([
    User.find({ _id: { $in: userIds } }),
    policyIds.length > 0
      ? Policy.find({ _id: { $in: policyIds }, insurerProfileId })
      : Promise.resolve([]),
  ]);

  const userById = new Map(users.map((user) => [String(user._id), user]));
  const policyById = new Map(policies.map((policy) => [String(policy._id), policy]));
  const kycByUser = await getLatestKycByUserIds(userIds);

  const groups = new Map<string, InsurerCustomerGroup>();

  function demographicsForUser(userId: string): InsurerCustomerDemographics | undefined {
    const kyc = kycByUser.get(userId);
    if (!kyc) return undefined;
    return demographicsChipFromKyc(kyc);
  }

  for (const lead of leads) {
    const user = userById.get(String(lead.userId));
    if (!user) continue;

    const emailKey = user.email.trim().toLowerCase();
    const policy = lead.policyId ? policyById.get(String(lead.policyId)) : undefined;
    const leadItem: InsurerCustomerLeadItem = {
      id: String(lead._id),
      type: lead.type,
      status: lead.status,
      seenAt: lead.seenAt?.toISOString(),
      isNew: lead.status === 'new' && !lead.seenAt,
      summary: lead.summary ?? '',
      metadata: lead.metadata as Record<string, unknown> | undefined,
      createdAt: lead.createdAt.toISOString(),
      policy: policy
        ? {
            id: String(policy._id),
            slug: policy.slug,
            name: policy.name,
            category: policy.category,
          }
        : undefined,
    };

    const existing = groups.get(emailKey);
    if (existing) {
      existing.leads.push(leadItem);
      existing.isNew = existing.isNew || leadItem.isNew;
      if (leadItem.createdAt > existing.latestActivityAt) {
        existing.latestActivityAt = leadItem.createdAt;
      }
      continue;
    }

    groups.set(emailKey, {
      seeker: {
        id: String(user._id),
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
      },
      demographics: demographicsForUser(String(user._id)),
      leads: [leadItem],
      purchases: [],
      isNew: leadItem.isNew,
      latestActivityAt: leadItem.createdAt,
    });
  }

  for (const purchase of purchases) {
    const user = userById.get(String(purchase.userId));
    if (!user) continue;

    const emailKey = user.email.trim().toLowerCase();
    const policy = policyById.get(String(purchase.policyId));
    const purchaseItem: InsurerCustomerPurchaseItem = {
      id: String(purchase._id),
      status: purchase.status,
      completedAt: purchase.completedAt?.toISOString(),
      createdAt: purchase.createdAt.toISOString(),
      policy: policy
        ? {
            id: String(policy._id),
            slug: policy.slug,
            name: policy.name,
            category: policy.category,
            premiumMonthlyPkr: policy.premiumMonthlyPkr,
            premiumYearlyPkr: policy.premiumYearlyPkr,
          }
        : undefined,
    };

    const activityAt = purchase.completedAt?.toISOString() ?? purchase.createdAt.toISOString();
    const existing = groups.get(emailKey);
    if (existing) {
      existing.purchases.push(purchaseItem);
      if (activityAt > existing.latestActivityAt) {
        existing.latestActivityAt = activityAt;
      }
      continue;
    }

    groups.set(emailKey, {
      seeker: {
        id: String(user._id),
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
      },
      demographics: demographicsForUser(String(user._id)),
      leads: [],
      purchases: [purchaseItem],
      isNew: false,
      latestActivityAt: activityAt,
    });
  }

  return [...groups.values()].sort(
    (a, b) => new Date(b.latestActivityAt).getTime() - new Date(a.latestActivityAt).getTime()
  );
}
