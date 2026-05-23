import type { Request, Response } from 'express';
import { loadEnv } from '../config/env';
import { InsurerProfile } from '../models/InsurerProfile';
import { Policy } from '../models/Policy';
import { Purchase } from '../models/Purchase';
import { AppError } from '../utils/apiResponse';
import { renderAffiliatePage } from '../views/affiliatePage';

export async function renderAffiliateWizard(req: Request, res: Response): Promise<void> {
  const env = loadEnv();
  const insurerSlug = String(req.params.insurerSlug).toLowerCase();
  const purchaseId = typeof req.query.purchaseId === 'string' ? req.query.purchaseId : '';
  const token = typeof req.query.token === 'string' ? req.query.token : '';

  if (!purchaseId) {
    throw new AppError(400, 'purchaseId query parameter is required');
  }

  const purchase = await Purchase.findById(purchaseId);
  if (!purchase) {
    throw new AppError(404, 'Purchase not found');
  }

  const insurer = await InsurerProfile.findById(purchase.insurerProfileId);
  if (!insurer || insurer.slug !== insurerSlug) {
    throw new AppError(404, 'Affiliate page not found for this purchase');
  }

  const policy = await Policy.findById(purchase.policyId);
  if (!policy) {
    throw new AppError(404, 'Policy not found for this purchase');
  }

  const answerSummary = Object.entries(purchase.answers ?? {})
    .map(([key, value]) => `<li><strong>${escapeHtml(key)}:</strong> ${escapeHtml(String(value))}</li>`)
    .join('');

  const html = renderAffiliatePage({
    apiPublicUrl: env.API_PUBLIC_URL,
    clientUrl: env.CLIENT_URL,
    insurerSlug: insurer.slug,
    insurerName: insurer.companyName,
    insurerExternalUrl: `https://www.${insurer.slug.replace(/-insurance$/, '')}.com.pk`,
    policyName: policy.name,
    premiumMonthlyPkr: policy.premiumMonthlyPkr.toLocaleString('en-PK'),
    purchaseId: String(purchase._id),
    token,
    paymentProcessed: Boolean(purchase.paymentProcessedAt),
    completed: purchase.status === 'completed',
    answerSummaryHtml: answerSummary || '<li>No questionnaire answers provided</li>',
  });

  res.status(200).type('html').send(html);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
