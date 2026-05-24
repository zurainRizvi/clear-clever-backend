import { Router } from 'express';
import { getDatabaseStatus } from '../config/db';
import { isSmtpConfigured, loadEnv } from '../config/env';
import { getSmtpProbeResult } from '../config/smtpStatus';
import { successResponse } from '../utils/apiResponse';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  const env = loadEnv();
  const dbStatus = getDatabaseStatus();
  const smtpConfigured = isSmtpConfigured(env);
  const smtpProbe = getSmtpProbeResult();

  res.status(200).json(
    successResponse('ClearClever API is healthy', {
      service: 'clearclever-api',
      environment: env.NODE_ENV,
      database: dbStatus,
      smtp: {
        configured: smtpConfigured,
        ready: smtpProbe?.ok === true,
        error: smtpProbe && !smtpProbe.ok ? smtpProbe.error : undefined,
      },
      timestamp: new Date().toISOString(),
    })
  );
});
