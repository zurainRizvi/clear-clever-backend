import type { Response } from 'express';
import { loadEnv } from '../config/env';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import { InsurerProfile } from '../models/InsurerProfile';
import { Policy } from '../models/Policy';
import { Purchase } from '../models/Purchase';
import { signToken } from '../services/auth';
import { completePurchase } from '../services/purchaseCompletion';
import { toPurchaseSummary } from '../services/purchasePresentation';
import { AppError, successResponse } from '../utils/apiResponse';

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

  const purchase = await Purchase.create({
    userId: req.user!._id,
    policyId: policy._id,
    insurerProfileId: insurer._id,
    affiliateSlug: insurer.slug,
    answers: answers ?? {},
    status: 'pending',
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
  const purchases = await Purchase.find({ userId: req.user!._id }).sort({ createdAt: -1 });
  const items = await Promise.all(purchases.map((purchase) => toPurchaseSummary(purchase)));

  res.status(200).json(
    successResponse('Purchases retrieved', {
      count: items.length,
      purchases: items,
    })
  );
}
