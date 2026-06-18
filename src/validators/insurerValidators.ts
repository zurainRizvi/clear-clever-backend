import { body, param } from 'express-validator';
import { POLICY_CATEGORY_SLUGS } from '../constants/categories';
import { POLICY_QUESTION_TYPES } from '../models/Policy';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validateProfilePhotoDataUrl(value: string | null): boolean {
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
}

export const insurerPolicyIdValidator = param('id')
  .trim()
  .notEmpty()
  .withMessage('Policy id is required')
  .isMongoId()
  .withMessage('Policy id must be a valid id');

export const createInsurerPolicyValidators = [
  body('slug')
    .trim()
    .notEmpty()
    .withMessage('Slug is required')
    .matches(slugPattern)
    .withMessage('Slug must be lowercase letters, numbers, and hyphens only')
    .isLength({ max: 80 })
    .withMessage('Slug must be at most 80 characters'),
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 200 }),
  body('category')
    .trim()
    .notEmpty()
    .withMessage('Category is required')
    .isIn([...POLICY_CATEGORY_SLUGS])
    .withMessage(`Category must be one of: ${POLICY_CATEGORY_SLUGS.join(', ')}`),
  body('description').trim().notEmpty().withMessage('Description is required').isLength({ max: 4000 }),
  body('premiumMonthlyPkr').isFloat({ min: 0 }).withMessage('Monthly premium must be a non-negative number'),
  body('premiumYearlyPkr').isFloat({ min: 0 }).withMessage('Yearly premium must be a non-negative number'),
  body('coverageSummary')
    .trim()
    .notEmpty()
    .withMessage('Coverage summary is required')
    .isLength({ max: 1000 }),
  body('features').isArray({ min: 1 }).withMessage('At least one feature is required'),
  body('features.*').trim().notEmpty().withMessage('Each feature must be non-empty').isLength({ max: 200 }),
  body('featureSections').optional().isArray().withMessage('Feature sections must be an array'),
  body('featureSections.*.id').optional().trim().notEmpty(),
  body('featureSections.*.title').optional().trim().notEmpty().isLength({ max: 120 }),
  body('featureSections.*.rows').optional().isArray(),
  body('deductiblePkr').isFloat({ min: 0 }).withMessage('Deductible must be a non-negative number'),
  body('questions').optional().isArray().withMessage('Questions must be an array'),
  body('questions.*.id').optional().trim().notEmpty().withMessage('Question id is required'),
  body('questions.*.text').optional().trim().notEmpty().withMessage('Question text is required'),
  body('questions.*.type')
    .optional()
    .isIn([...POLICY_QUESTION_TYPES])
    .withMessage(`Question type must be one of: ${POLICY_QUESTION_TYPES.join(', ')}`),
  body('questions.*.options').optional().isArray(),
  body('questions.*.required').optional().isBoolean(),
  body('status')
    .optional()
    .custom(() => {
      throw new Error('Status cannot be set by insurers');
    }),
];

export const insurerClaimIdValidator = param('id')
  .trim()
  .notEmpty()
  .withMessage('Claim id is required')
  .isMongoId()
  .withMessage('Claim id must be a valid id');

export const updateInsurerClaimValidators = [
  insurerClaimIdValidator,
  body('status')
    .trim()
    .isIn(['in_review', 'needs_info', 'approved', 'rejected'])
    .withMessage('Status must be in_review, needs_info, approved, or rejected'),
  body('revert').optional().isBoolean().withMessage('revert must be a boolean'),
  body('comment')
    .optional()
    .trim()
    .isLength({ min: 3, max: 2000 })
    .withMessage('Comment must be between 3 and 2000 characters'),
];

export const createInsurerProfileValidators = [
  body('companyName')
    .trim()
    .notEmpty()
    .withMessage('Company name is required')
    .isLength({ max: 160 })
    .withMessage('Company name must be at most 160 characters'),
  body('slug')
    .trim()
    .notEmpty()
    .withMessage('Slug is required')
    .matches(slugPattern)
    .withMessage('Slug must be lowercase letters, numbers, and hyphens only')
    .isLength({ max: 80 })
    .withMessage('Slug must be at most 80 characters'),
  body('contactPhone')
    .trim()
    .notEmpty()
    .withMessage('Contact phone is required')
    .isLength({ max: 20 })
    .withMessage('Contact phone must be at most 20 characters'),
  body('description').optional().trim().isLength({ max: 2000 }),
  body('websiteUrl').optional().trim().isLength({ max: 500 }),
  body('profilePhotoDataUrl')
    .optional({ nullable: true })
    .custom(validateProfilePhotoDataUrl),
];

export const updateInsurerProfileValidators = [
  body('contactEmail').optional().trim().isEmail().withMessage('Contact email must be valid'),
  body('contactPhone')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Contact phone is required')
    .isLength({ max: 20 }),
  body('description').optional().trim().isLength({ max: 2000 }),
  body('profilePhotoDataUrl')
    .optional({ nullable: true })
    .custom(validateProfilePhotoDataUrl),
];

export const updateInsurerPolicyValidators = [
  insurerPolicyIdValidator,
  body('slug')
    .optional()
    .trim()
    .matches(slugPattern)
    .withMessage('Slug must be lowercase letters, numbers, and hyphens only')
    .isLength({ max: 80 }),
  body('name').optional().trim().notEmpty().isLength({ max: 200 }),
  body('category')
    .optional()
    .trim()
    .isIn([...POLICY_CATEGORY_SLUGS])
    .withMessage(`Category must be one of: ${POLICY_CATEGORY_SLUGS.join(', ')}`),
  body('description').optional().trim().notEmpty().isLength({ max: 4000 }),
  body('premiumMonthlyPkr').optional().isFloat({ min: 0 }),
  body('premiumYearlyPkr').optional().isFloat({ min: 0 }),
  body('coverageSummary').optional().trim().notEmpty().isLength({ max: 1000 }),
  body('features').optional().isArray({ min: 1 }),
  body('features.*').optional().trim().notEmpty().isLength({ max: 200 }),
  body('featureSections').optional().isArray(),
  body('deductiblePkr').optional().isFloat({ min: 0 }),
  body('questions').optional().isArray(),
  body('questions.*.id').optional().trim().notEmpty(),
  body('questions.*.text').optional().trim().notEmpty(),
  body('questions.*.type').optional().isIn([...POLICY_QUESTION_TYPES]),
  body('status')
    .optional()
    .custom(() => {
      throw new Error('Status cannot be set by insurers');
    }),
];
