import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { initDb, seedVendorAllowlist } from '../src/db.js';
import { HandshakeRegistry } from '../src/auth/handshake.js';
import { SessionStore } from '../src/auth/sessions.js';
import type Database from 'better-sqlite3';
import type { Express } from 'express';

describe('API routes', () => {
  let db: Database.Database;
  let app: Express;
  let registry: HandshakeRegistry;
  let store: SessionStore;
  let cookies: string[];

  beforeEach(async () => {
    db = initDb(':memory:');
    seedVendorAllowlist(db);
    registry = new HandshakeRegistry();
    store = new SessionStore();
    app = createApp(db, registry, store);

    registry.register('test-token');
    const res = await request(app).post('/api/auth/exchange').send({ token: 'test-token' });
    cookies = res.headers['set-cookie'] as unknown as string[];
  });

  function authed(method: 'get' | 'post' | 'patch' | 'delete', url: string) {
    const req = request(app)[method](url).set('Cookie', cookies);
    if (method !== 'get') {
      const csrfCookie = cookies.find(c => c.startsWith('anasnare_csrf='));
      const csrfToken = csrfCookie?.split('=')[1]?.split(';')[0] ?? '';
      req.set('X-CSRF-Token', csrfToken);
    }
    return req;
  }

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/sites');
    expect(res.status).toBe(401);
  });

  it('GET /api/health is exempt from auth', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });

  describe('sites', () => {
    it('creates and lists sites', async () => {
      const create = await authed('post', '/api/sites').send({ fqdn: 'example.com', display_name: 'Example' });
      expect(create.status).toBe(201);
      expect(create.body.fqdn).toBe('example.com');

      const list = await authed('get', '/api/sites');
      expect(list.status).toBe(200);
      expect(list.body.data).toHaveLength(1);
      expect(list.body.total).toBe(1);
    });

    it('updates a site with PATCH', async () => {
      const create = await authed('post', '/api/sites').send({ fqdn: 'example.com' });
      const patch = await authed('patch', `/api/sites/${create.body.id}`).send({ scan_interval_seconds: 300 });
      expect(patch.status).toBe(200);
      expect(patch.body.scan_interval_seconds).toBe(300);
    });

    it('deletes a site', async () => {
      const create = await authed('post', '/api/sites').send({ fqdn: 'example.com' });
      const del = await authed('delete', `/api/sites/${create.body.id}`);
      expect(del.status).toBe(204);
    });
  });

  describe('vendor-allowlist', () => {
    it('lists seeded vendors', async () => {
      const res = await authed('get', '/api/vendor-allowlist');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.total).toBe(res.body.data.length);
    });

    it('adds and removes a custom vendor', async () => {
      const create = await authed('post', '/api/vendor-allowlist').send({ domain_pattern: '*.custom.com', vendor_name: 'Custom' });
      expect(create.status).toBe(201);
      expect(create.body.is_builtin).toBe(0);
      const del = await authed('delete', `/api/vendor-allowlist/${create.body.id}`);
      expect(del.status).toBe(204);
    });

    it('prevents deleting built-in vendors', async () => {
      const list = await authed('get', '/api/vendor-allowlist');
      const builtin = list.body.data.find((e: { is_builtin: number }) => e.is_builtin === 1);
      const del = await authed('delete', `/api/vendor-allowlist/${builtin.id}`);
      expect(del.status).toBe(403);
    });
  });

  describe('dashboard', () => {
    it('returns aggregate stats', async () => {
      const res = await authed('get', '/api/dashboard');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total_sites');
      expect(res.body).toHaveProperty('tier1_24h');
      expect(res.body).toHaveProperty('top_threat_scripts');
    });
  });
});
