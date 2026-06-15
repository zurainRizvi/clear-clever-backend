export const PURCHASE_STATUSES = ['pending', 'completed', 'revoked', 'terminated'] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  'purchase_success',
  'insurer_email',
  'call_scheduled',
  'call_rescheduled',
  'claim_submitted',
  'claim_status',
  'premium_reminder',
  'claim_reminder',
  'approval_reminder',
  'policy_completion',
  'call_reminder',
  'policy_review',
  'account_review',
  'support_inquiry',
  'new_lead',
  'purchase_revoked',
  'purchase_terminated',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const EMAIL_LOG_STATUSES = ['sent', 'failed'] as const;
export type EmailLogStatus = (typeof EMAIL_LOG_STATUSES)[number];

export const CALL_SCHEDULE_STATUSES = ['scheduled', 'completed', 'cancelled'] as const;
export type CallScheduleStatus = (typeof CALL_SCHEDULE_STATUSES)[number];

export const SCHEDULE_TYPES = ['agent_call', 'survey_visit'] as const;
export type ScheduleType = (typeof SCHEDULE_TYPES)[number];

export const PREFERRED_TIME_SLOTS = [
  '9:00 AM – 12:00 PM',
  '12:00 PM – 1:00 PM',
  '1:00 PM – 5:00 PM',
  '5:00 PM – 8:00 PM',
] as const;
export type PreferredTimeSlot = (typeof PREFERRED_TIME_SLOTS)[number];
