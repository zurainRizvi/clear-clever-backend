import { body, param } from 'express-validator';
import { USER_ROLES } from '../constants/roles';

const staffAssignableRoles = USER_ROLES.filter((role) => role !== 'superadmin');

export const adminPolicyIdValidator = param('id')
  .trim()
  .notEmpty()
  .withMessage('Policy id is required')
  .isMongoId()
  .withMessage('Policy id must be a valid id');

export const adminUserIdValidator = param('id')
  .trim()
  .notEmpty()
  .withMessage('User id is required')
  .isMongoId()
  .withMessage('User id must be a valid id');

export const rejectPolicyValidators = [
  adminPolicyIdValidator,
  body('reason').optional().trim().isLength({ max: 1000 }).withMessage('Reason must be at most 1000 characters'),
];

export const changeUserRoleValidators = [
  adminUserIdValidator,
  body('role')
    .trim()
    .notEmpty()
    .withMessage('Role is required')
    .isIn(staffAssignableRoles)
    .withMessage(`Role must be one of: ${staffAssignableRoles.join(', ')}`),
];

export const rejectInsurerValidators = [
  adminUserIdValidator,
  body('reason').optional().trim().isLength({ max: 1000 }).withMessage('Reason must be at most 1000 characters'),
];

export const fraudCategoryValidator = param('category')
  .trim()
  .isIn(['account', 'claims', 'commerce', 'catalog'])
  .withMessage('Category must be account, claims, commerce, or catalog');

export const resolveFraudSignalValidators = [
  fraudCategoryValidator,
  body('signalId').trim().notEmpty().withMessage('signalId is required'),
  body('resolution')
    .trim()
    .isIn(['confirmed_fraud', 'false_positive', 'dismissed'])
    .withMessage('resolution must be confirmed_fraud, false_positive, or dismissed'),
];

export const mlRetrainModelValidators = [
  body('modelId')
    .trim()
    .notEmpty()
    .withMessage('modelId is required')
    .isIn([
      'claim_risk',
      'fraud',
      'policy_ranker_home',
      'policy_ranker_auto',
      'policy_ranker_life',
      'policy_ranker_pet',
    ])
    .withMessage('Invalid modelId'),
];
