import { Router } from 'express';
import type Database from 'better-sqlite3';
import * as db from '../db.js';
import { parseId } from './query.js';

export function vendorAllowlistRouter(database: Database.Database): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const entries = db.listVendorAllowlist(database);
    res.json({ data: entries, total: entries.length });
  });

  router.post('/', (req, res) => {
    const { domain_pattern, vendor_name } = req.body ?? {};
    if (typeof domain_pattern !== 'string' || !domain_pattern || typeof vendor_name !== 'string' || !vendor_name) {
      res.status(400).json({ error: 'domain_pattern and vendor_name required' });
      return;
    }
    try {
      res.status(201).json(db.createVendorEntry(database, domain_pattern, vendor_name));
    } catch (err) {
      if (err instanceof Error && err.message.includes('UNIQUE')) {
        res.status(409).json({ error: 'Entry already exists' });
        return;
      }
      throw err;
    }
  });

  router.patch('/:id', (req, res) => {
    const id = parseId(req);
    try {
      const entry = id === undefined ? undefined : db.updateVendorEntry(database, id, req.body ?? {});
      if (!entry) {
        res.status(404).json({ error: 'Entry not found' });
        return;
      }
      res.json(entry);
    } catch (err) {
      if (err instanceof Error && err.message.includes('UNIQUE')) {
        res.status(409).json({ error: 'Entry already exists' });
        return;
      }
      throw err;
    }
  });

  router.delete('/:id', (req, res) => {
    const id = parseId(req);
    const existing = id === undefined ? undefined : db.getVendorEntry(database, id);
    if (id === undefined || !existing) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    if (existing.is_builtin === 1) {
      res.status(403).json({ error: 'Built-in entries cannot be deleted' });
      return;
    }
    db.deleteVendorEntry(database, id);
    res.status(204).end();
  });

  return router;
}
