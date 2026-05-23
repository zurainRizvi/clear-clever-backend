import { body, param, query } from 'express-validator';

export const createPurchaseValidators = [
  body('policyId')
    .trim()
    .notEmpty()
    .withMessage('Policy id is required')
    .isMongoId()
    .withMessage('Policy id must be a valid id'),
  body('answers').optional().isObject().withMessage('Answers must be an object'),
];

export const purchaseIdParamValidator = param('id')
  .trim()
  .notEmpty()
  .withMessage('Purchase id is required')
  .isMongoId()
  .withMessage('Purchase id must be a valid id');

export const processPaymentValidators = [
  purchaseIdParamValidator,
  body('cardholderName')
    .trim()
    .notEmpty()
    .withMessage('Cardholder name is required')
    .isLength({ min: 2, max: 120 })
    .withMessage('Cardholder name must be between 2 and 120 characters'),
  body('cardLast4')
    .trim()
    .matches(/^\d{4}$/)
    .withMessage('Card last 4 digits must be exactly 4 numbers'),
  body('cardExpiry')
    .trim()
    .matches(/^(0[1-9]|1[0-2])\/\d{2}$/)
    .withMessage('Card expiry must be in MM/YY format'),
];

export const completePurchaseQueryValidators = [
  query('purchaseId')
    .trim()
    .notEmpty()
    .withMessage('purchaseId query parameter is required')
    .isMongoId()
    .withMessage('purchaseId must be a valid id'),
];

export const notificationIdValidator = param('id')
  .trim()
  .notEmpty()
  .withMessage('Notification id is required')
  .isMongoId()
  .withMessage('Notification id must be a valid id');
