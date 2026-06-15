import type { Response } from 'express';
import { loadEnv } from '../config/env';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import { CallSchedule } from '../models/CallSchedule';
import { InsurerProfile } from '../models/InsurerProfile';
import { Notification } from '../models/Notification';
import { Policy } from '../models/Policy';
import { Purchase } from '../models/Purchase';
import { QuestionnaireResponse } from '../models/QuestionnaireResponse';
import { signToken } from '../services/auth';
import { getCategoryQuestions } from '../services/questionsService';
import { saveQuestionnaireResponse } from '../services/questionnaireMemory';
import {
  hasMeaningfulAnswers,
  mergeQuestionnaireAnswers,
  stripContactFields,
} from '../services/questionnaireAnswers';
import { trackCheckoutLead } from '../services/leadTrackingService';
import { completePurchase } from '../services/purchaseCompletion';
import { toPurchaseSummary } from '../services/purchasePresentation';
import { assignUserCnic } from '../services/userCnicService';
import { assertUserKycVerified } from '../services/kycService';
import { AppError, successResponse } from '../utils/apiResponse';
import { isValidCnicFormat, normalizeCnic } from '../utils/cnic';

export async function createPurchase(req: AuthenticatedRequest, res: Response): Promise<void> {
  const env = loadEnv();
  const { policyId, answers } = req.body as {
    policyId: string;
    answers?: Record<string, unknown>;
  };

  const policy = await Policy.findById(policyId);
  if (!policy || policy.status !== 'approved') {
    throw new AppError(404, 'Policy not found');
  }

  const insurer = await InsurerProfile.findById(policy.insurerProfileId);
  if (!insurer) {
    throw new AppError(500, 'Policy insurer profile is missing');
  }

  await assertUserKycVerified(req.user!._id);

  const purchaseAnswers = answers ?? {};

  const rawContactCnic = purchaseAnswers.contact_cnic;
  if (typeof rawContactCnic === 'string' && rawContactCnic.trim()) {
    if (!isValidCnicFormat(rawContactCnic)) {
      throw new AppError(400, 'Validation failed', [
        'contact_cnic must be a valid Pakistan CNIC (e.g. 42101-1234567-1)',
      ]);
    }
    await assignUserCnic(req.user!, rawContactCnic);
    purchaseAnswers.contact_cnic = normalizeCnic(rawContactCnic);
  }

  if (!req.user!.cnic?.trim()) {
    throw new AppError(400, 'CNIC is required to purchase a policy', [
      'Add your CNIC in the purchase contact details before checkout.',
    ]);
  }

  const questionnaireAnswers = stripContactFields(purchaseAnswers);
  if (hasMeaningfulAnswers(questionnaireAnswers)) {
    const questionSet = await getCategoryQuestions(policy.category);
    const existing = await QuestionnaireResponse.findOne({
      userId: req.user!._id,
      category: policy.category,
    });
    await saveQuestionnaireResponse({
      userId: req.user!._id,
      category: policy.category,
      answers: mergeQuestionnaireAnswers(existing?.answers as Record<string, unknown> | undefined, questionnaireAnswers),
      questions: questionSet.questions,
    });
  }

  const purchase = await Purchase.create({
    userId: req.user!._id,
    policyId: policy._id,
    insurerProfileId: insurer._id,
    affiliateSlug: insurer.slug,
    answers: purchaseAnswers,
    status: 'pending',
  });

  await trackCheckoutLead({
    userId: req.user!._id,
    policyId: policy._id,
    insurerProfileId: insurer._id,
    policyName: policy.name,
    category: policy.category,
    purchaseId: String(purchase._id),
  });

  const token = signToken(env, req.user!);
  const redirectUrl = new URL(`${env.API_PUBLIC_URL}/affiliate/${insurer.slug}`);
  redirectUrl.searchParams.set('purchaseId', String(purchase._id));
  redirectUrl.searchParams.set('token', token);

  res.status(201).json(
    successResponse('Purchase initiated', {
      purchaseId: String(purchase._id),
      redirectUrl: redirectUrl.toString(),
      affiliateSlug: insurer.slug,
    })
  );
}

export async function updatePurchaseAnswers(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { answers } = req.body as { answers: Record<string, unknown> };

  const purchase = await Purchase.findById(req.params.id);
  if (!purchase) {
    throw new AppError(404, 'Purchase not found');
  }
  if (String(purchase.userId) !== String(req.user!._id)) {
    throw new AppError(403, 'You do not have permission to update this purchase');
  }
  if (purchase.status !== 'pending') {
    throw new AppError(400, 'Only pending purchases can be updated');
  }

  purchase.answers = answers;
  await purchase.save();

  res.status(200).json(
    successResponse('Purchase answers updated', {
      purchaseId: String(purchase._id),
      answers: purchase.answers,
    })
  );
}

export async function processPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
  const purchase = await Purchase.findById(req.params.id);
  if (!purchase) {
    throw new AppError(404, 'Purchase not found');
  }
  if (String(purchase.userId) !== String(req.user!._id)) {
    throw new AppError(403, 'You do not have permission to process payment for this purchase');
  }
  if (purchase.status === 'completed') {
    throw new AppError(400, 'Purchase is already completed');
  }

  purchase.paymentProcessedAt = new Date();
  await purchase.save();

  res.status(200).json(
    successResponse('Payment processed', {
      purchaseId: String(purchase._id),
      paymentProcessedAt: purchase.paymentProcessedAt.toISOString(),
    })
  );
}

export async function completePurchaseHandler(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const env = loadEnv();
  const purchaseId = String(req.query.purchaseId);
  const result = await completePurchase(purchaseId, req.user!._id);
  const summary = await toPurchaseSummary(result.purchase);

  const redirectTarget = new URL(`${env.CLIENT_URL}/dashboard/purchases`);
  redirectTarget.searchParams.set('purchaseId', purchaseId);
  redirectTarget.searchParams.set('completed', '1');

  const acceptsHtml = req.headers.accept?.includes('text/html');

  if (acceptsHtml) {
    res.redirect(302, redirectTarget.toString());
    return;
  }

  res.status(200).json(
    successResponse(
      result.alreadyCompleted ? 'Purchase was already completed' : 'Purchase completed',
      {
        alreadyCompleted: result.alreadyCompleted,
        redirectUrl: redirectTarget.toString(),
        purchase: summary,
        notificationsCreated: result.notifications.length,
      }
    )
  );
}

export async function listPurchases(req: AuthenticatedRequest, res: Response): Promise<void> {
  const purchases = await Purchase.find({
    userId: req.user!._id,
    status: { $ne: 'revoked' },
  }).sort({ createdAt: -1 });
  const items = await Promise.all(purchases.map((purchase) => toPurchaseSummary(purchase)));

  res.status(200).json(
    successResponse('Purchases retrieved', {
      count: items.length,
      purchases: items,
    })
  );
}

export async function rescheduleCall(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { scheduledDate, scheduledTime } = req.body as {
    scheduledDate: string;
    scheduledTime: string;
  };

  const purchase = await Purchase.findOne({
    _id: req.params.id,
    userId: req.user!._id,
    status: 'completed',
  });
  if (!purchase) {
    throw new AppError(404, 'Completed purchase not found');
  }

  const scheduledAt = parsePktDateTime(scheduledDate, scheduledTime);
  if (!scheduledAt || scheduledAt.getTime() <= Date.now()) {
    throw new AppError(400, 'Validation failed', [
      'scheduledAt: Choose a future date and time in Pakistan Standard Time',
    ]);
  }

  const callSchedule = await CallSchedule.findOneAndUpdate(
    { purchaseId: purchase._id, scheduleType: 'agent_call' },
    {
      userId: purchase.userId,
      insurerId: purchase.insurerProfileId,
      purchaseId: purchase._id,
      scheduleType: 'agent_call',
      scheduledAt,
      status: 'scheduled',
      notes: 'Rescheduled by policy seeker',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await Notification.create({
    userId: purchase.userId,
    type: 'call_rescheduled',
    title: 'Agent call rescheduled',
    body: `Your ClearClever agent call is now scheduled for ${scheduledAt.toISOString()}.`,
    metadata: {
      purchaseId: String(purchase._id),
      scheduledAt: scheduledAt.toISOString(),
      callScheduleId: String(callSchedule._id),
    },
  });

  res.status(200).json(
    successResponse('Agent call rescheduled', {
      purchase: await toPurchaseSummary(purchase),
    })
  );
}

function parsePktDateTime(scheduledDate: string, scheduledTime: string): Date | null {
  const date = new Date(`${scheduledDate}T${scheduledTime}:00+05:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}
