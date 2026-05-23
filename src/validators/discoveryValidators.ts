import { body, param } from 'express-validator';
import { CATEGORY_SLUGS } from '../constants/categories';

export const categoryParamValidator = param('category')
  .trim()
  .notEmpty()
  .withMessage('Category is required')
  .isIn([...CATEGORY_SLUGS])
  .withMessage(`Category must be one of: ${CATEGORY_SLUGS.join(', ')}`);

export const recommendValidators = [
  body('category')
    .trim()
    .notEmpty()
    .withMessage('Category is required')
    .isIn([...CATEGORY_SLUGS])
    .withMessage(`Category must be one of: ${CATEGORY_SLUGS.join(', ')}`),
  body('answers')
    .exists()
    .withMessage('Answers are required')
    .isObject()
    .withMessage('Answers must be an object'),
];

export const compareValidators = [
  body('policyIds')
    .isArray({ min: 1 })
    .withMessage('policyIds must be a non-empty array'),
  body('policyIds')
    .custom((value: unknown) => {
      if (!Array.isArray(value)) {
        return true;
      }
      if (value.length > 4) {
        throw new Error('You can compare at most 4 policies at once');
      }
      return true;
    }),
  body('policyIds.*')
    .trim()
    .notEmpty()
    .withMessage('Each policy ID is required')
    .isMongoId()
    .withMessage('Each policy ID must be a valid MongoDB ObjectId'),
];

export const policyIdParamValidator = param('id')
  .trim()
  .notEmpty()
  .withMessage('Policy ID is required')
  .isMongoId()
  .withMessage('Policy ID must be a valid MongoDB ObjectId');

export const favoritePolicyIdValidator = param('policyId')
  .trim()
  .notEmpty()
  .withMessage('Policy ID is required')
  .isMongoId()
  .withMessage('Policy ID must be a valid MongoDB ObjectId');

export const addFavoriteValidators = [
  body('policyId')
    .trim()
    .notEmpty()
    .withMessage('Policy ID is required')
    .isMongoId()
    .withMessage('Policy ID must be a valid MongoDB ObjectId'),
];
