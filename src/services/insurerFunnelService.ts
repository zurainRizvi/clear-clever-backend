import type { LeadSource } from './leadTrackingService';
import type { ILeadDocument } from '../models/Lead';
import type { IPurchaseDocument } from '../models/Purchase';
import { inInsurerRange, type InsurerDateRange } from './insurerDateRange';

export interface QuestionnaireRow {
  userId: string;
  updatedAt: Date;
}

export interface InsurerFunnelStep {
  name: string;
  users: number;
  conversion?: string;
  dropOff?: number;
}

function leadSource(lead: ILeadDocument): LeadSource | null {
  const raw = lead.metadata?.source;
  if (typeof raw === 'string') {
    return raw as LeadSource;
  }
  if (lead.type === 'purchase') return 'purchase';
  if (lead.type === 'favorite') return 'favorite';
  if (lead.type === 'inquiry') return 'recommend';
  return null;
}

function usersMatching(
  leads: ILeadDocument[],
  range: InsurerDateRange,
  predicate: (lead: ILeadDocument, source: LeadSource | null) => boolean
): Set<string> {
  const ids = new Set<string>();
  for (const lead of leads) {
    if (!inInsurerRange(lead.createdAt, range)) continue;
    const source = leadSource(lead);
    if (predicate(lead, source)) {
      ids.add(String(lead.userId));
    }
  }
  return ids;
}

function intersectSets(base: Set<string>, subset: Set<string>): Set<string> {
  const result = new Set<string>();
  for (const id of base) {
    if (subset.has(id)) result.add(id);
  }
  return result;
}

function pctBetween(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '100%' : '0%';
  const pct = Math.min(100, Math.round((current / previous) * 100));
  return `${pct}%`;
}

export function buildInsurerFunnel(input: {
  currentLeads: ILeadDocument[];
  purchases: IPurchaseDocument[];
  questionnaireResponses: QuestionnaireRow[];
  range: InsurerDateRange;
}): { steps: InsurerFunnelStep[] } {
  const { currentLeads, purchases, questionnaireResponses, range } = input;

  const questionnaireUsers = new Set<string>();
  for (const row of questionnaireResponses) {
    if (inInsurerRange(row.updatedAt, range)) {
      questionnaireUsers.add(row.userId);
    }
  }

  const recommendedUsers = usersMatching(
    currentLeads,
    range,
    (lead, source) => lead.type === 'inquiry' && source === 'recommend'
  );

  const engagedUsers = usersMatching(currentLeads, range, (_lead, source) =>
    source === 'favorite' || source === 'compare' || source === 'message'
  );

  const checkoutLeadUsers = usersMatching(
    currentLeads,
    range,
    (_lead, source) => source === 'checkout'
  );
  const checkoutPurchaseUsers = new Set<string>();
  for (const purchase of purchases) {
    if (inInsurerRange(purchase.createdAt, range)) {
      checkoutPurchaseUsers.add(String(purchase.userId));
    }
  }
  const checkoutUsers = new Set([...checkoutLeadUsers, ...checkoutPurchaseUsers]);

  const paymentUsers = new Set<string>();
  for (const purchase of purchases) {
    if (
      purchase.paymentProcessedAt &&
      inInsurerRange(purchase.paymentProcessedAt, range)
    ) {
      paymentUsers.add(String(purchase.userId));
    }
  }

  const purchasedLeadUsers = usersMatching(
    currentLeads,
    range,
    (lead, source) => lead.type === 'purchase' || source === 'purchase'
  );
  const completedPurchaseUsers = new Set<string>();
  for (const purchase of purchases) {
    if (
      purchase.status === 'completed' &&
      purchase.completedAt &&
      inInsurerRange(purchase.completedAt, range)
    ) {
      completedPurchaseUsers.add(String(purchase.userId));
    }
  }
  const purchasedUsers = new Set([...purchasedLeadUsers, ...completedPurchaseUsers]);

  const stepSets = [
    questionnaireUsers,
    intersectSets(questionnaireUsers, recommendedUsers),
    intersectSets(intersectSets(questionnaireUsers, recommendedUsers), engagedUsers),
    intersectSets(
      intersectSets(intersectSets(questionnaireUsers, recommendedUsers), engagedUsers),
      checkoutUsers
    ),
    intersectSets(
      intersectSets(
        intersectSets(intersectSets(questionnaireUsers, recommendedUsers), engagedUsers),
        checkoutUsers
      ),
      paymentUsers
    ),
    intersectSets(
      intersectSets(
        intersectSets(
          intersectSets(intersectSets(questionnaireUsers, recommendedUsers), engagedUsers),
          checkoutUsers
        ),
        paymentUsers
      ),
      purchasedUsers
    ),
  ];

  const stepNames = [
    'Shared needs (questionnaire)',
    'Saw your policies (recommended)',
    'Engaged',
    'Started checkout',
    'Payment submitted',
    'Policy purchased',
  ];

  const stepCounts = stepSets.map((set) => set.size);

  const steps: InsurerFunnelStep[] = stepNames.map((name, index) => {
    const users = stepCounts[index] ?? 0;
    const previousUsers = index === 0 ? users : (stepCounts[index - 1] ?? 0);
    const dropOff = index === 0 ? undefined : Math.max(0, previousUsers - users);
    return {
      name,
      users,
      conversion: index === 0 ? undefined : pctBetween(users, previousUsers),
      dropOff,
    };
  });

  return { steps };
}

export function countLeadSources(
  leads: ILeadDocument[],
  range: InsurerDateRange
): Map<LeadSource, number> {
  const counts = new Map<LeadSource, number>();
  for (const lead of leads) {
    if (!inInsurerRange(lead.createdAt, range)) continue;
    const source = leadSource(lead);
    if (!source) continue;
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }
  return counts;
}

export function uniqueSeekersInRange(
  leads: ILeadDocument[],
  range: InsurerDateRange
): Set<string> {
  const ids = new Set<string>();
  for (const lead of leads) {
    if (inInsurerRange(lead.createdAt, range)) {
      ids.add(String(lead.userId));
    }
  }
  return ids;
}

export function uniquePurchasersInRange(
  leads: ILeadDocument[],
  purchases: IPurchaseDocument[],
  range: InsurerDateRange
): Set<string> {
  const ids = new Set<string>();
  for (const lead of leads) {
    if (!inInsurerRange(lead.createdAt, range)) continue;
    if (lead.type === 'purchase') {
      ids.add(String(lead.userId));
    }
  }
  for (const purchase of purchases) {
    if (purchase.status === 'completed' && purchase.completedAt) {
      if (inInsurerRange(purchase.completedAt, range)) {
        ids.add(String(purchase.userId));
      }
    }
  }
  return ids;
}

export function questionnaireUsersInRange(
  questionnaireResponses: QuestionnaireRow[],
  range: InsurerDateRange
): Set<string> {
  const ids = new Set<string>();
  for (const row of questionnaireResponses) {
    if (inInsurerRange(row.updatedAt, range)) {
      ids.add(row.userId);
    }
  }
  return ids;
}
