import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import type { Env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth';
import { categoriesRouter } from './routes/categories';
import {
  compareRouter,
  policiesRouter,
  questionsRouter,
  recommendRouter,
} from './routes/discovery';
import { favoritesRouter } from './routes/favorites';
import { healthRouter } from './routes/health';

export function createApp(env: Env) {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  }

  app.get('/', (_req, res) => {
    res.json({
      success: true,
      message: 'ClearClever API',
      data: { docs: '/api/health' },
    });
  });

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/questions', questionsRouter);
  app.use('/api/recommend', recommendRouter);
  app.use('/api/compare', compareRouter);
  app.use('/api/policies', policiesRouter);
  app.use('/api/favorites', favoritesRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
