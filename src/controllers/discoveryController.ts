import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import { InsurerProfile } from '../models/InsurerProfile';
import { Policy } from '../models/Policy';
import { enrichPolicies, toPublicPolicy } from '../services/policyPresentation';
import {
  assertAnswersForQuestions,
  getCategoryQuestions,
  parseCategoryForRecommend,
} from '../services/questionsService';
import { scorePolicies } from '../services/recommendationService';
import { AppError, successResponse } from '../utils/apiResponse';

export async function getQuestions(req: AuthenticatedRequest, res: Response): Promise<void> {
  const category = String(req.params.category);
  const result = await getCategoryQuestions(category);

  res.status(200).json(successResponse('Questions retrieved', result));
}

export async function recommendPolicies(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { category, answers } = req.body as {
    category: string;
    answers: Record<string, unknown>;
  };

  const policyCategory = parseCategoryForRecommend(category);
  if (!policyCategory) {
    res.status(200).json(
      successResponse('Category is not available for recommendations', {
        category: 'others',
        available: false,
        recommendations: [],
      })
    );
    return;
  }

  const questionSet = await getCategoryQuestions(policyCategory);
  assertAnswersForQuestions(answers, questionSet.questions);

  const approvedPolicies = await Policy.find({
    category: policyCategory,
    status: 'approved',
  });

  const publicPolicies = await enrichPolicies(approvedPolicies);
  const recommendations = scorePolicies(
    approvedPolicies,
    publicPolicies,
    questionSet.questions,
    answers
  );

  res.status(200).json(
    successResponse('Recommendations generated', {
      category: policyCategory,
      available: true,
      recommendations,
    })
  );
}

export async function comparePolicies(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { policyIds } = req.body as { policyIds: string[] };
  const uniqueIds = [...new Set(policyIds)];

  if (uniqueIds.length !== policyIds.length) {
    throw new AppError(400, 'Validation failed', ['policyIds: duplicate IDs are not allowed']);
  }

  const policies = await Policy.find({ _id: { $in: uniqueIds } });
  if (policies.length !== uniqueIds.length) {
    throw new AppError(400, 'One or more policies were not found', [
      'policyIds: all policies must exist',
    ]);
  }

  const unapproved = policies.filter((policy) => policy.status !== 'approved');
  if (unapproved.length > 0) {
    throw new AppError(400, 'Only approved policies can be compared', [
      'policyIds: all policies must be approved',
    ]);
  }

  const publicPolicies = await enrichPolicies(policies);
  const order = new Map(uniqueIds.map((id, index) => [id, index]));
  publicPolicies.sort(
    (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
  );

  res.status(200).json(
    successResponse('Policy comparison ready', {
      count: publicPolicies.length,
      policies: publicPolicies,
    })
  );
}

export async function getPolicyById(req: AuthenticatedRequest, res: Response): Promise<void> {
  const policy = await Policy.findById(req.params.id);
  if (!policy) {
    throw new AppError(404, 'Policy not found');
  }
  if (policy.status !== 'approved') {
    throw new AppError(404, 'Policy not found');
  }

  const insurer = await InsurerProfile.findById(policy.insurerProfileId);
  if (!insurer) {
    throw new AppError(404, 'Policy not found');
  }

  res.status(200).json(
    successResponse('Policy retrieved', {
      policy: toPublicPolicy(policy, insurer),
    })
  );
}
