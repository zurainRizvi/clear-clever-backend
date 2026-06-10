import { Purchase } from '../models/Purchase';
import type { IUserDocument } from '../models/User';
import { cnicMatches } from '../utils/cnic';
import { namesMatch } from './identityVerificationService';

export interface PolicyLinkageResult {
  hasCompletedPurchases: boolean;
  linkedPolicyCount: number;
  linkedPolicyNames: string[];
  policyNameMatch: boolean;
  policyCnicMatch: boolean;
  policyLinked: boolean;
  note: string;
}

function readContactName(
  answers: Record<string, unknown> | undefined,
  fallback: string
): string {
  const value = answers?.contact_full_name;
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function readContactCnic(
  answers: Record<string, unknown> | undefined,
  fallback?: string
): string | undefined {
  const value = answers?.contact_cnic;
  if (typeof value === 'string' && value.trim()) return value.trim();
  return fallback?.trim() || undefined;
}

export async function evaluatePolicyLinkage(
  user: IUserDocument,
  extractedName?: string
): Promise<PolicyLinkageResult> {
  const purchases = await Purchase.find({ userId: user._id, status: 'completed' })
    .populate('policyId', 'name')
    .lean();

  if (purchases.length === 0) {
    return {
      hasCompletedPurchases: false,
      linkedPolicyCount: 0,
      linkedPolicyNames: [],
      policyNameMatch: false,
      policyCnicMatch: false,
      policyLinked: false,
      note:
        'Complete at least one policy purchase first. Full KYC passes only when your CNIC matches the policyholder details on that purchase.',
    };
  }

  const linkedPolicyNames = purchases
    .map((purchase) => {
      const policy = purchase.policyId as { name?: string } | null;
      return policy?.name?.trim();
    })
    .filter((name): name is string => Boolean(name));

  const contactNames = purchases.map((purchase) =>
    readContactName(purchase.answers as Record<string, unknown>, user.fullName)
  );
  const contactCnics = purchases
    .map((purchase) =>
      readContactCnic(purchase.answers as Record<string, unknown>, user.cnic ?? undefined)
    )
    .filter((cnic): cnic is string => Boolean(cnic));

  const policyNameMatch = extractedName
    ? contactNames.some((name) => namesMatch(name, extractedName))
    : false;
  const policyCnicMatch = user.cnic
    ? contactCnics.some((cnic) => cnicMatches(user.cnic, cnic))
    : false;
  const policyLinked = policyNameMatch && policyCnicMatch;

  let note = 'Your CNIC photo must match the name and CNIC used when you purchased your policy.';
  if (policyLinked) {
    note = `Identity aligned with ${linkedPolicyNames.length} purchased polic${
      linkedPolicyNames.length === 1 ? 'y' : 'ies'
    }: ${linkedPolicyNames.slice(0, 3).join(', ')}${linkedPolicyNames.length > 3 ? '…' : ''}.`;
  } else if (!policyNameMatch && !policyCnicMatch) {
    note =
      'Name and CNIC on your ID do not match the policyholder details on your purchased policies.';
  } else if (!policyNameMatch) {
    note = 'Name on your CNIC does not match the policyholder name on your purchased policies.';
  } else if (!policyCnicMatch) {
    note = 'CNIC on your ID does not match the CNIC used when you purchased your policies.';
  }

  return {
    hasCompletedPurchases: true,
    linkedPolicyCount: purchases.length,
    linkedPolicyNames,
    policyNameMatch,
    policyCnicMatch,
    policyLinked,
    note,
  };
}
