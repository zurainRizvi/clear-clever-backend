export const POLICY_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type PolicyStatus = (typeof POLICY_STATUSES)[number];
