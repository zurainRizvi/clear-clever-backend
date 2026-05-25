export const PURCHASE_STATUSES = ['pending', 'completed'] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  'purchase_success',
  'insurer_email',
  'call_scheduled',
  'call_rescheduled',
  'claim_submitted',
  'claim_status',
  'policy_review',
  'account_review',
  'support_inquiry',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const EMAIL_LOG_STATUSES = ['sent', 'failed'] as const;
export type EmailLogStatus = (typeof EMAIL_LOG_STATUSES)[number];

export const CALL_SCHEDULE_STATUSES = ['scheduled', 'completed', 'cancelled'] as const;
export type CallScheduleStatus = (typeof CALL_SCHEDULE_STATUSES)[number];
