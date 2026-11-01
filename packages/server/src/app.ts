import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import type Database from 'better-sqlite3';
import type { HandshakeRegistry } from './auth/handshake.js';
import type { SessionStore } from './auth/sessions.js';
import { sessionMiddleware, csrfMiddleware } from './auth/middleware.js';
import { authRouter } from './routes/auth.js';
import { sitesRouter } from './routes/sites.js';
import { scansRouter } from './routes/scans.js';
import { detectionsRouter } from './routes/detections.js';
import { dashboardRouter } from './routes/dashboard.js';
import { vendorAllowlistRouter } from './routes/vendor-allowlist.js';

export function createApp(db: Database.Database, registry: HandshakeRegistry, store: SessionStore, triggerScan?: (siteId: number, url: string) => Promise<void>): express.Express {
  const app = express();
  if (process.env.NODE_ENV !== 'production') app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  // Middleware normalizes paths itself, so it is mounted without a path prefix
  const api = express.Router();
  api.use(sessionMiddleware(store));
  api.use(csrfMiddleware(store));

  api.get('/api/health', (_req, res) => { res.json({ status: 'ok' }); });
  api.use('/api/auth', authRouter(registry, store));
  api.use('/api/sites', sitesRouter(db, triggerScan));
  api.use('/api/scans', scansRouter(db));
  api.use('/api/detections', detectionsRouter(db));
  api.use('/api/dashboard', dashboardRouter(db));
  api.use('/api/vendor-allowlist', vendorAllowlistRouter(db));

  app.use(api);

  const uiDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../ui/dist');
  app.use(express.static(uiDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(uiDist, 'index.html'));
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}
