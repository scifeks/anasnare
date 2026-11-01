import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import open from 'open';
import { createApp } from './app.js';
import { createScheduler, runScan, runSiteScan } from '@anasnare/scanner';
import type { DbOperations } from '@anasnare/scanner';
import {
  initDb, seedVendorAllowlist, listSites, getScan, createScan, completeScan,
  insertDetection, insertScanScript, insertAdSlot, getActiveAllowlistPatterns, runRetentionCleanup,
} from './db.js';
import { HandshakeRegistry } from './auth/handshake.js';
import { SessionStore } from './auth/sessions.js';

const PORT = Number(process.env.PORT) || 3000;
const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'anasnare.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = initDb(DB_PATH);
seedVendorAllowlist(db);
const registry = new HandshakeRegistry();
const store = new SessionStore();

const dbOps: DbOperations = {
  listSites: () => listSites(db),
  getScan: (id) => getScan(db, id),
  createScan: (siteId, pageUrl) => createScan(db, siteId, pageUrl),
  completeScan: (scanId, status, detectionCount, scriptsAnalyzed, errorMessage) => {
    completeScan(db, scanId, status, detectionCount, scriptsAnalyzed, errorMessage);
  },
  insertDetection: (det) => insertDetection(db, det as Parameters<typeof insertDetection>[1]),
  insertScanScript: (ss) => insertScanScript(db, { ...ss, initiator_chain: ss.initiator_chain ?? undefined, script_hash: ss.script_hash ?? undefined } as Parameters<typeof insertScanScript>[1]),
  insertAdSlot: (slot) => insertAdSlot(db, slot),
  getActiveAllowlistPatterns: () => getActiveAllowlistPatterns(db),
  runRetentionCleanup: () => runRetentionCleanup(db),
};

const triggerScan = (siteId: number, url: string) => runSiteScan(dbOps, runScan, siteId, new URL(url).hostname);
const app = createApp(db, registry, store, triggerScan);

if (process.env.NODE_ENV === 'production') {
  const uiDist = path.join(import.meta.dirname, '../../ui/dist');
  app.use(express.static(uiDist));
  app.get('*', (_req, res) => { res.sendFile(path.join(uiDist, 'index.html')); });
}

const token = crypto.randomBytes(16).toString('hex');
registry.register(token);

const HOST = process.env.HOST || '127.0.0.1';
const server = app.listen(PORT, HOST, async () => {
  const url = `http://localhost:${PORT}/?token=${token}`;
  console.log(`Anasnare is running at:\n  ${url}\n`);
  open(url).catch(() => {});
});

const scheduler = createScheduler(dbOps, runScan);
scheduler.start();

function shutdown() {
  console.log('\nShutting down...');
  scheduler.stop();
  server.close(() => { db.close(); process.exit(0); });
  // Force exit if open connections block a graceful close
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
