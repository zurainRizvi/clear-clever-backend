import { body, param } from 'express-validator';
import { CLAIM_TYPES } from '../models/ClaimRequest';

export const createClaimValidators = [
  body('purchaseId')
    .trim()
    .notEmpty()
    .withMessage('Purchase id is required')
    .isMongoId()
    .withMessage('Purchase id must be a valid id'),
  body('claimType')
    .trim()
    .isIn([...CLAIM_TYPES])
    .withMessage(`Claim type must be one of: ${CLAIM_TYPES.join(', ')}`),
  body('incidentDate')
    .trim()
    .isISO8601()
    .withMessage('Incident date must be a valid date'),
  body('estimatedAmountPkr')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Estimated amount must be a positive number'),
  body('description')
    .trim()
    .isLength({ min: 5, max: 4000 })
    .withMessage('Description must be between 5 and 4000 characters'),
];

export const claimIdParamValidator = param('id')
  .trim()
  .notEmpty()
  .withMessage('Claim id is required')
  .isMongoId()
  .withMessage('Claim id must be a valid id');
