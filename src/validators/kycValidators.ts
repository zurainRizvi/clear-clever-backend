import { body } from 'express-validator';
import { isValidCnicFormat } from '../utils/cnic';

export const deriveKycValidators = [
  body('cnic')
    .optional()
    .isString()
    .trim()
    .custom((value: string) => {
      if (!value) return true;
      if (!isValidCnicFormat(value)) {
        throw new Error('cnic must be a valid Pakistan CNIC (e.g. 42101-1234567-1)');
      }
      return true;
    }),
];

export const verifyKycValidators = [
  body('attachment')
    .exists({ checkNull: true })
    .withMessage('attachment is required')
    .isObject()
    .withMessage('attachment must be an object'),
  body('attachment.mimeType')
    .isString()
    .withMessage('attachment.mimeType is required'),
  body('attachment.dataBase64')
    .isString()
    .withMessage('attachment.dataBase64 is required'),
];
