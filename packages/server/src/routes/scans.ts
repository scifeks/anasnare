import { Router } from 'express';
import type Database from 'better-sqlite3';
import * as db from '../db.js';
import { parseId, parseListOptions } from './query.js';

export function scansRouter(database: Database.Database): Router {
  const router = Router();

  router.get('/', (req, res) => {
    res.json(db.listScans(database, parseListOptions(req)));
  });

  router.get('/:id', (req, res) => {
    const id = parseId(req);
    const scan = id === undefined ? undefined : db.getScan(database, id);
    if (!scan) {
      res.status(404).json({ error: 'Scan not found' });
      return;
    }
    res.json(scan);
  });

  router.get('/:id/ad-slots', (req, res) => {
    const id = parseId(req);
    if (id === undefined || !db.getScan(database, id)) {
      res.status(404).json({ error: 'Scan not found' });
      return;
    }
    const data = db.listAdSlots(database, id);
    res.json({ data, total: data.length });
  });

  return router;
}
