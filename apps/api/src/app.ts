import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { restaurantRouter } from './modules/restaurant/restaurant.routes.js';
import { logosRouter } from './modules/logos/logos.routes.js';
import { categoriesRouter } from './modules/categories/categories.routes.js';
import { itemsRouter } from './modules/items/items.routes.js';
import { mediaRouter } from './modules/media/media.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { themesRouter } from './modules/themes/themes.module.js';
import { backgroundsRouter } from './modules/backgrounds/backgrounds.module.js';
import { combosRouter } from './modules/combos/combos.module.js';
import { pagesRouter } from './modules/pages/pages.module.js';
import { sectionsRouter } from './modules/sections/sections.routes.js';
import { versionsRouter } from './modules/versions/versions.module.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

export function createApp() {
  const app = express();
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  if (env.NODE_ENV !== 'test') app.use(morgan('dev'));

  // Uploaded files: uuid names never change content, so they can be cached hard.
  // `sandbox` CSP neutralises any script that might hide in an SVG opened directly.
  app.use(
    '/uploads',
    express.static(env.uploadDir, {
      maxAge: '30d',
      immutable: true,
      index: false,
      dotfiles: 'deny',
      setHeaders: (res) => res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox"),
    }),
  );

  app.use('/api', rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: true, legacyHeaders: false }));
  app.get('/api/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));
  app.use('/api/auth', authRouter);
  app.use('/api/restaurant', restaurantRouter);
  app.use('/api/logos', logosRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/menu-items', itemsRouter);
  app.use('/api/media', mediaRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/themes', themesRouter);
  app.use('/api/backgrounds', backgroundsRouter);
  app.use('/api/combos', combosRouter);
  app.use('/api/menu-pages', pagesRouter);
  app.use('/api/menu-sections', sectionsRouter);
  app.use('/api/menu-versions', versionsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
