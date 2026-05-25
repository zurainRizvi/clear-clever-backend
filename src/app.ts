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
import { renderAffiliateWizard } from './controllers/affiliateController';
import { asyncPublicHandler } from './controllers/authController';
import { insurerRouter } from './routes/insurer';
import { adminRouter } from './routes/admin';
import { claimsRouter } from './routes/claims';
import { notificationsRouter } from './routes/notifications';
import { purchaseRouter } from './routes/purchase';
import { purchasesRouter } from './routes/purchases';
import { conversationsRouter } from './routes/conversations';
import { supportRouter } from './routes/support';

export function createApp(env: Env) {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'script-src': ["'self'", "'unsafe-inline'"],
        },
      },
    })
  );
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
  app.use('/api/insurer', insurerRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/purchase', purchaseRouter);
  app.use('/api/purchases', purchasesRouter);
  app.use('/api/claims', claimsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/conversations', conversationsRouter);
  app.use('/api/support', supportRouter);

  app.get('/affiliate/:insurerSlug', asyncPublicHandler(renderAffiliateWizard));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
