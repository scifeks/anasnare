import { Router } from 'express';
import type Database from 'better-sqlite3';
import * as db from '../db.js';
import { parseId, parseListOptions } from './query.js';

export function detectionsRouter(database: Database.Database): Router {
  const router = Router();

  router.get('/', (req, res) => {
    res.json(db.listDetections(database, parseListOptions(req)));
  });

  router.get('/by-script', (req, res) => {
    const url = req.query.url;
    if (typeof url !== 'string' || url === '') {
      res.status(400).json({ error: 'url required' });
      return;
    }
    res.json(db.listDetectionsByScript(database, url, parseListOptions(req)));
  });

  router.get('/by-campaign', (req, res) => {
    res.json(db.listDetectionsByCampaign(database, parseListOptions(req)));
  });

  router.get('/:id', (req, res) => {
    const id = parseId(req);
    const detection = id === undefined ? undefined : db.getDetection(database, id);
    if (!detection) {
      res.status(404).json({ error: 'Detection not found' });
      return;
    }
    res.json(detection);
  });

  return router;
}
