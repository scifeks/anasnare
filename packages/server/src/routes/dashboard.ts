import { Router } from 'express';
import type Database from 'better-sqlite3';
import * as db from '../db.js';

export function dashboardRouter(database: Database.Database): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(db.getDashboardStats(database));
  });

  router.get('/timeline', (req, res) => {
    const siteId = typeof req.query.site_id === 'string' ? parseInt(req.query.site_id, 10) : NaN;
    const days = typeof req.query.days === 'string' ? parseInt(req.query.days, 10) : NaN;
    res.json(db.getTimeline(
      database,
      Number.isNaN(siteId) ? undefined : siteId,
      Number.isNaN(days) ? undefined : Math.max(1, Math.min(days, 90)),
    ));
  });

  return router;
}
