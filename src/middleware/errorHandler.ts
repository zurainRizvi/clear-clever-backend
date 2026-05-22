import type { NextFunction, Request, Response } from 'express';
import { AppError, errorResponse } from '../utils/apiResponse';
import { loadEnv } from '../config/env';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json(
    errorResponse('Route not found', [`${req.method} ${req.originalUrl} does not exist`])
  );
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const env = loadEnv();
  const isProduction = env.NODE_ENV === 'production';

  if (err instanceof AppError) {
    res.status(err.statusCode).json(errorResponse(err.message, err.errors));
    return;
  }

  if (err && typeof err === 'object' && 'statusCode' in err) {
    const status = Number((err as { statusCode?: number }).statusCode) || 500;
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred';
    res.status(status).json(errorResponse(message));
    return;
  }

  console.error('[ClearClever] Unhandled error:', err);
  res.status(500).json(
    errorResponse(
      'Internal server error',
      isProduction ? [] : [err instanceof Error ? err.message : String(err)]
    )
  );
}
