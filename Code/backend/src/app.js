import express from 'express';
import { fileURLToPath } from 'node:url';
import { HttpError } from './http.js';
import { organizerRoutes } from './organizers.js';
import { publicRoutes } from './registration.js';

const organizerUi = fileURLToPath(new URL('../../organizer-frontend/', import.meta.url));
const publicUi = fileURLToPath(new URL('../../frontend/dist/', import.meta.url));

export function createApp(db, config) {
  const app = express();
  app.disable('x-powered-by');
  if (config.proxyHops) app.set('trust proxy', config.proxyHops);
  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
    });
    next();
  });
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.method === 'POST' && !config.allowedOrigins.includes(req.get('Origin'))) {
      return next(new HttpError(403, 'This request must come from the Trinity Showdown site.'));
    }
    next();
  }, express.json({ limit: '16kb', inflate: false }));

  app.get('/api/health', async (_req, res) => {
    try {
      await db.query('SELECT 1 FROM trinity.editions LIMIT 1');
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'database unavailable' });
    }
  });
  app.use('/api/public', publicRoutes(db, config));
  app.use('/api/organizer', organizerRoutes(db, config));
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Endpoint unavailable.')));
  app.use('/organizer', (_req, res, next) => {
    res.set({
      'X-Robots-Tag': 'noindex, nofollow',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'",
    });
    next();
  }, express.static(organizerUi));
  app.use(express.static(publicUi));
  app.use((error, _req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error instanceof HttpError || [400, 413, 415].includes(error.status) ? error.status : 500;
    if (status === 500) console.error('Request failed', error.code ?? error.name);
    const publicErrors = {
      400: 'The request is invalid.', 413: 'The request is too large.', 415: 'This request format is unsupported.',
    };
    res.status(status).json({ error: error instanceof HttpError ? error.message :
      publicErrors[status] ?? 'Something went wrong. Please try again.' });
  });
  return app;
}
