import { body } from 'express-validator';
import { OTP_PURPOSES, SELF_SERVICE_ROLES, USER_ROLES } from '../constants/roles';

/** Pakistan mobile: 03XXXXXXXXX or +923XXXXXXXXX */
const PK_PHONE_REGEX = /^(?:\+92|0)?3[0-9]{9}$/;

export function normalizePkPhone(raw: string): string {
  const digits = raw.replace(/[\s-]/g, '');
  if (digits.startsWith('+92')) return digits;
  if (digits.startsWith('92') && digits.length === 12) return `+${digits}`;
  if (digits.startsWith('0')) return `+92${digits.slice(1)}`;
  return digits;
}

export const signupValidators = [
  body('fullName').trim().notEmpty().withMessage('fullName is required').isLength({ max: 120 }),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('phone is required')
    .custom((value: string) => {
      const normalized = normalizePkPhone(value);
      if (!PK_PHONE_REGEX.test(normalized)) {
        throw new Error('phone must be a valid Pakistan mobile number (e.g. 03001234567)');
      }
      return true;
    }),
  body('password')
    .isLength({ min: 8 })
    .withMessage('password must be at least 8 characters'),
];

export const loginValidators = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('password is required'),
];

export const otpSendValidators = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('purpose')
    .isIn(OTP_PURPOSES)
    .withMessage(`purpose must be one of: ${OTP_PURPOSES.join(', ')}`),
];

export const otpVerifyValidators = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('purpose')
    .isIn(OTP_PURPOSES)
    .withMessage(`purpose must be one of: ${OTP_PURPOSES.join(', ')}`),
  body('code')
    .trim()
    .matches(/^\d{6}$/)
    .withMessage('code must be a 6-digit number'),
];

export const setRoleValidators = [
  body('role')
    .isIn(SELF_SERVICE_ROLES)
    .withMessage(`role must be one of: ${SELF_SERVICE_ROLES.join(', ')}`),
];

export const updateMeValidators = [
  body('profilePhotoDataUrl')
    .optional({ nullable: true })
    .custom((value: string | null) => {
      if (value === null || value === '') return true;
      if (typeof value !== 'string') {
        throw new Error('profilePhotoDataUrl must be a string');
      }
      if (!value.startsWith('data:image/')) {
        throw new Error('profilePhotoDataUrl must be an image data URL');
      }
      if (value.length > 7_000_000) {
        throw new Error('profilePhotoDataUrl must be smaller than 7 MB');
      }
      return true;
    }),
  body('notificationPreferences').optional().isObject().withMessage('notificationPreferences must be an object'),
  body('notificationPreferences.emailUpdates')
    .optional()
    .isBoolean()
    .withMessage('emailUpdates must be boolean'),
  body('notificationPreferences.claimAlerts')
    .optional()
    .isBoolean()
    .withMessage('claimAlerts must be boolean'),
  body('notificationPreferences.policyReminders')
    .optional()
    .isBoolean()
    .withMessage('policyReminders must be boolean'),
];

export { USER_ROLES, PK_PHONE_REGEX };
