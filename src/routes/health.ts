import { Router } from 'express';
import { getDatabaseStatus } from '../config/db';
import { loadEnv } from '../config/env';
import { successResponse } from '../utils/apiResponse';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  const env = loadEnv();
  const dbStatus = getDatabaseStatus();

  res.status(200).json(
    successResponse('ClearClever API is healthy', {
      service: 'clearclever-api',
      environment: env.NODE_ENV,
      database: dbStatus,
      timestamp: new Date().toISOString(),
    })
  );
});
