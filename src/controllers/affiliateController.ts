import type { Request, Response } from 'express';
import { loadEnv } from '../config/env';
import { InsurerProfile } from '../models/InsurerProfile';
import { Policy } from '../models/Policy';
import { Purchase } from '../models/Purchase';
import { isCheckoutTokenValid } from '../services/checkoutToken';
import { renderAffiliateErrorPage, renderAffiliatePage } from '../views/affiliatePage';

export async function renderAffiliateWizard(req: Request, res: Response): Promise<void> {
  const env = loadEnv();
  const insurerSlug = String(req.params.insurerSlug).toLowerCase();
  const purchaseId = typeof req.query.purchaseId === 'string' ? req.query.purchaseId : '';
  const token = typeof req.query.token === 'string' ? req.query.token : '';

  if (!purchaseId) {
    res
      .status(400)
      .type('html')
      .send(
        renderAffiliateErrorPage(
          'Missing purchase reference',
          'This checkout link is incomplete. Start again from Compare Policies on ClearClever.',
          env.CLIENT_URL
        )
      );
    return;
  }

  const purchase = await Purchase.findById(purchaseId);
  if (!purchase) {
    res
      .status(404)
      .type('html')
      .send(
        renderAffiliateErrorPage(
          'Purchase not found',
          'We could not find this purchase. It may have expired or the link is invalid.',
          env.CLIENT_URL
        )
      );
    return;
  }

  if (!token || !isCheckoutTokenValid(purchase, token)) {
    res
      .status(401)
      .type('html')
      .send(
        renderAffiliateErrorPage(
          'Checkout link expired',
          'This checkout link is invalid or expired. Start again from Compare Policies on ClearClever.',
          env.CLIENT_URL
        )
      );
    return;
  }

  const insurer = await InsurerProfile.findById(purchase.insurerProfileId);
  if (!insurer || insurer.slug !== insurerSlug) {
    res
      .status(404)
      .type('html')
      .send(
        renderAffiliateErrorPage(
          'Checkout unavailable',
          'This insurer checkout link does not match your purchase. Return to ClearClever and try again.',
          env.CLIENT_URL
        )
      );
    return;
  }

  const policy = await Policy.findById(purchase.policyId);
  if (!policy) {
    res
      .status(404)
      .type('html')
      .send(
        renderAffiliateErrorPage(
          'Policy not found',
          'The policy for this purchase is no longer available.',
          env.CLIENT_URL
        )
      );
    return;
  }

  const rawStep = typeof req.query.step === 'string' ? Number.parseInt(req.query.step, 10) : 1;
  let step = Number.isFinite(rawStep) ? rawStep : 1;
  if (step < 1) step = 1;
  if (step > 4) step = 4;
  if (step > 1 && !purchase.paymentProcessedAt && step > 2) step = 2;
  if (step > 3 && !purchase.paymentProcessedAt) step = 2;
  if (purchase.status === 'completed') step = 4;

  const answers = (purchase.answers ?? {}) as Record<string, unknown>;
  const answerFieldsHtml = Object.entries(answers)
    .map(([key, value]) => {
      const label = escapeHtml(formatAnswerKey(key));
      const fieldName = escapeHtml(key);
      const fieldValue = escapeHtml(String(value ?? ''));
      return `<label>${label}
        <input name="${fieldName}" value="${fieldValue}" />
      </label>`;
    })
    .join('');

  const html = renderAffiliatePage({
    apiPublicUrl: env.API_PUBLIC_URL,
    clientUrl: env.CLIENT_URL,
    insurerSlug: insurer.slug,
    insurerName: insurer.companyName,
    insurerDescription: insurer.description,
    insurerExternalUrl:
      insurer.websiteUrl?.trim() ||
      `https://www.${insurer.slug.replace(/-insurance$/, '')}.com.pk`,
    policyName: policy.name,
    coverageSummary: policy.coverageSummary,
    premiumMonthlyPkr: policy.premiumMonthlyPkr.toLocaleString('en-PK'),
    premiumYearlyPkr: policy.premiumYearlyPkr.toLocaleString('en-PK'),
    purchaseId: String(purchase._id),
    token,
    step,
    paymentProcessed: Boolean(purchase.paymentProcessedAt),
    completed: purchase.status === 'completed',
    answers,
    answerFieldsHtml:
      answerFieldsHtml ||
      '<p class="muted">No questionnaire answers provided. You can continue to payment.</p>',
  });

  res.status(200).type('html').send(html);
}

function formatAnswerKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
