export const USER_ROLES = ['user', 'insurer', 'admin', 'superadmin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Roles a new user may choose after OTP (Figma role-selection screen). */
export const SELF_SERVICE_ROLES: UserRole[] = ['user', 'insurer'];

export const USER_STATUSES = ['pendingVerification', 'active', 'inactive'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const OTP_PURPOSES = ['signup', 'reset'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];
