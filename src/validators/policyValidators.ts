import { body } from 'express-validator';
import { POLICY_CATEGORY_SLUGS } from '../constants/categories';
import { POLICY_STATUSES } from '../constants/policyStatus';

export const policyCategoryValidator = body('category')
  .trim()
  .notEmpty()
  .withMessage('Category is required')
  .isIn([...POLICY_CATEGORY_SLUGS])
  .withMessage(`Category must be one of: ${POLICY_CATEGORY_SLUGS.join(', ')}`);

export const policyStatusValidator = body('status')
  .optional()
  .trim()
  .isIn([...POLICY_STATUSES])
  .withMessage(`Status must be one of: ${POLICY_STATUSES.join(', ')}`);
