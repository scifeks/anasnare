import { Router } from 'express';
import type Database from 'better-sqlite3';
import * as db from '../db.js';
import { parseId } from './query.js';

const HOSTNAME_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

function isValidFqdn(value: string): boolean {
  if (!HOSTNAME_RE.test(value)) return false;
  // Reject IP addresses and localhost
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(value)) return false;
  if (/^localhost$/i.test(value)) return false;
  return true;
}

export function sitesRouter(database: Database.Database, triggerScan?: (siteId: number, url: string) => Promise<void>): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const sites = db.listSites(database);
    res.json({ data: sites, total: sites.length });
  });

  router.post('/', (req, res) => {
    const { fqdn, display_name, scan_interval_seconds, retention_days } = req.body ?? {};
    if (!fqdn || typeof fqdn !== 'string') {
      res.status(400).json({ error: 'fqdn required' });
      return;
    }
    if (!isValidFqdn(fqdn)) {
      res.status(400).json({ error: 'Invalid hostname. Must be a valid public FQDN, not an IP address or localhost.' });
      return;
    }
    try {
      res.status(201).json(db.createSite(database, fqdn, display_name, scan_interval_seconds, retention_days));
    } catch (err) {
      if (err instanceof Error && err.message.includes('UNIQUE')) {
        res.status(409).json({ error: 'Site already exists' });
        return;
      }
      throw err;
    }
  });

  router.get('/:id', (req, res) => {
    const id = parseId(req);
    const site = id === undefined ? undefined : db.getSite(database, id);
    if (!site) {
      res.status(404).json({ error: 'Site not found' });
      return;
    }
    res.json(site);
  });

  router.patch('/:id', (req, res) => {
    const id = parseId(req);
    try {
      const site = id === undefined ? undefined : db.updateSite(database, id, req.body ?? {});
      if (!site) {
        res.status(404).json({ error: 'Site not found' });
        return;
      }
      res.json(site);
    } catch (err) {
      if (err instanceof Error && err.message.includes('UNIQUE')) {
        res.status(409).json({ error: 'FQDN already exists' });
        return;
      }
      throw err;
    }
  });

  router.delete('/:id', (req, res) => {
    const id = parseId(req);
    if (id === undefined || !db.deleteSite(database, id)) {
      res.status(404).json({ error: 'Site not found' });
      return;
    }
    res.status(204).end();
  });

  router.post('/:id/scan', (req, res) => {
    const id = parseId(req);
    const site = id === undefined ? undefined : db.getSite(database, id);
    if (!site) {
      res.status(404).json({ error: 'Site not found' });
      return;
    }
    if (!triggerScan) {
      res.status(501).json({ error: 'Scanner not available' });
      return;
    }
    triggerScan(site.id, `https://${site.fqdn}`).catch((err: unknown) => {
      console.error(`Manual scan failed for site ${site.id}:`, err);
    });
    res.json({ message: 'Scan triggered' });
  });

  return router;
}
