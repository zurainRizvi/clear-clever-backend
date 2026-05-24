import { Router } from 'express';
import { getDatabaseStatus } from '../config/db';
import { loadEnv } from '../config/env';
import { getSmtpProbeResult } from '../config/smtpStatus';
import { getEmailProvider, isOutboundEmailConfigured } from '../services/emailDelivery';
import { successResponse } from '../utils/apiResponse';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  const env = loadEnv();
  const dbStatus = getDatabaseStatus();
  const emailProbe = getSmtpProbeResult();
  const provider = getEmailProvider(env);

  res.status(200).json(
    successResponse('ClearClever API is healthy', {
      service: 'clearclever-api',
      environment: env.NODE_ENV,
      database: dbStatus,
      email: {
        provider,
        configured: isOutboundEmailConfigured(env),
        ready: emailProbe?.ok === true,
        error: emailProbe && !emailProbe.ok ? emailProbe.error : undefined,
        renderFreeTierNote:
          provider === 'smtp' && env.NODE_ENV === 'production'
            ? 'Gmail SMTP is blocked on Render free tier; set BREVO_API_KEY or upgrade Render.'
            : undefined,
      },
      timestamp: new Date().toISOString(),
    })
  );
});
