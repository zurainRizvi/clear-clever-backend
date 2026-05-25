import { Router } from 'express';
import { asyncHandler } from '../controllers/authController';
import { getDatabaseStatus } from '../config/db';
import { isBrevoConfigured, isSmtpConfigured, loadEnv } from '../config/env';
import { getSmtpProbeResult } from '../config/smtpStatus';
import { getEmailProvider, isOutboundEmailConfigured } from '../services/emailDelivery';
import { getInfrastructureHealth } from '../services/infrastructureHealth';
import { successResponse } from '../utils/apiResponse';

export const healthRouter = Router();

healthRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const env = loadEnv();
    const dbStatus = getDatabaseStatus();
    const emailProbe = getSmtpProbeResult();
    const provider = getEmailProvider(env);
    const infrastructure = await getInfrastructureHealth();

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
          brevoKeySet: isBrevoConfigured(env),
          smtpVarsSet: isSmtpConfigured(env),
          hint:
            !isBrevoConfigured(env) && env.NODE_ENV === 'production'
              ? 'Add BREVO_API_KEY on Render, Save, then Manual Deploy (env changes do not apply until redeploy).'
              : !emailProbe?.ok && isBrevoConfigured(env)
                ? 'Brevo key is set but verify failed — check API key and that sender Gmail is verified in Brevo.'
                : undefined,
          renderFreeTierNote:
            provider === 'smtp' && env.NODE_ENV === 'production'
              ? 'Gmail SMTP is blocked on Render free tier; set BREVO_API_KEY or upgrade Render.'
              : undefined,
        },
        infrastructure,
        timestamp: new Date().toISOString(),
      })
    );
  })
);
