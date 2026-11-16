import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
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
import { exportRouter } from './modules/export/export.routes.js';
import { usersRouter } from './modules/users/users.module.js';
import { settingsRouter } from './modules/settings/settings.module.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

export function createApp() {
  const app = express();
  if (env.TRUST_PROXY) app.set('trust proxy', /^\d+$/.test(env.TRUST_PROXY) ? Number(env.TRUST_PROXY) : env.TRUST_PROXY === 'true');
  // HSTS / upgrade-insecure-requests only make sense behind TLS; sent over plain HTTP they would break an internal install.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hsts: env.FORCE_HTTPS,
      contentSecurityPolicy: { directives: { upgradeInsecureRequests: env.FORCE_HTTPS ? [] : null } },
    }),
  );
  app.use(compression());
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  // Every legitimate body (page layouts are the largest) is far below this; a small cap also bounds validation work.
  app.use(express.json({ limit: '512kb' }));
  // Never log credentials: the render token travels in the query string.
  morgan.token('safe-url', (req) => String((req as express.Request).originalUrl ?? req.url).replace(/([?&]token=)[^&\s]*/gi, '$1[redacted]'));
  if (env.NODE_ENV !== 'test') app.use(morgan(':method :safe-url :status :response-time ms'));

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

  const limit = (perMinute: number) => rateLimit({ windowMs: 60_000, limit: perMinute, standardHeaders: true, legacyHeaders: false });
  app.use('/api', limit(600));
  app.use('/api/export', limit(12)); // each export starts a browser
  app.use(['/api/media/upload', '/api/media/bulk-upload'], limit(60));
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
  app.use('/api/export', exportRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/settings', settingsRouter);

  // Production: serve the built web app from the API so one process (and one URL) does everything,
  // including the /render route the PDF exporter opens.
  const index = path.join(env.webDist, 'index.html');
  if (fs.existsSync(index)) {
    app.use(express.static(env.webDist, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api\/|uploads\/).*/, (_req, res) => res.sendFile(index));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
